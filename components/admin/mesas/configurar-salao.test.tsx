import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaMesas } from "./pagina-mesas"

vi.mock("react-to-print", () => ({ useReactToPrint: () => vi.fn() }))

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter hasMemory>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

const api = () => servidorDo("pizzaria")

async function abrirPainel() {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  const usuario = userEvent.setup()
  render(
    <Provedores>
      <PaginaMesas />
    </Provedores>,
  )
  await screen.findByRole("list", { name: "Salão" }, { timeout: 8000 })
  await usuario.click(screen.getByRole("button", { name: "Configurar salão" }))
  const painel = await screen.findByRole("dialog", { name: "Configurar salão" })
  return { usuario, painel: within(painel) }
}

beforeEach(async () => {
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Configurar salão", () => {
  test("o botão do cabeçalho abre o painel com a configuração do servidor", async () => {
    const { painel } = await abrirPainel()

    expect(
      painel
        .getAllByRole("textbox", { name: "Nome da área" })
        .map((c) => (c as HTMLInputElement).value),
    ).toEqual(["Salão", "Varanda", "Balcão"])
    expect(
      painel
        .getAllByRole("textbox", { name: "Nome do garçom" })
        .map((c) => (c as HTMLInputElement).value),
    ).toEqual(["Lucas", "Paula", "Rafa", "Bia"])
    expect(painel.getByRole("switch", { name: "Cobrar taxa de serviço" })).toBeChecked()
    expect(painel.getByLabelText("Taxa de serviço (%)")).toHaveValue(10)
    expect(painel.getByRole("switch", { name: "Cobrar couvert" })).toBeChecked()
    expect(painel.getByLabelText("Couvert por pessoa (R$)")).toHaveValue(8)
    expect(painel.getByRole("switch", { name: "Limpeza depois de fechar a conta" })).toBeChecked()
    expect(painel.getByLabelText("Sem pedido (min)")).toHaveValue(15)
  })

  test("adicionar a área Terraço e salvar grava no servidor e avisa", async () => {
    const { usuario, painel } = await abrirPainel()

    await usuario.click(painel.getByRole("button", { name: "Adicionar área" }))
    const campo = painel.getAllByRole("textbox", { name: "Nome da área" }).at(-1) as HTMLElement
    await usuario.type(campo, "Terraço")
    await usuario.click(painel.getByRole("button", { name: "Salvar" }))

    expect(await screen.findByText("Salão salvo.")).toBeInTheDocument()
    const salao = await api().salao.config()
    expect(salao.areas.map((area) => [area.nome, area.ordem])).toEqual([
      ["Salão", 0],
      ["Varanda", 1],
      ["Balcão", 2],
      ["Terraço", 3],
    ])
    expect(salao.areas[3].id).toMatch(/^area-/)
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Configurar salão" })).not.toBeInTheDocument(),
    )
  })

  test("excluir a área que tem mesas mostra o erro do servidor e mantém o painel aberto", async () => {
    const { usuario, painel } = await abrirPainel()

    await usuario.click(painel.getByRole("button", { name: "Excluir área Varanda" }))
    await usuario.click(painel.getByRole("button", { name: "Salvar" }))

    expect(
      await screen.findByText("Mova as mesas da área Varanda antes de excluí-la."),
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Configurar salão" })).toBeInTheDocument()
    expect((await api().salao.config()).areas).toHaveLength(3)
  })

  test("desligar um garçom tira ele do filtro de garçom da grade", async () => {
    const { usuario, painel } = await abrirPainel()

    await usuario.click(painel.getByRole("switch", { name: "Garçom Paula ativo" }))
    await usuario.click(painel.getByRole("button", { name: "Salvar" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Configurar salão" })).not.toBeInTheDocument(),
    )

    await usuario.click(screen.getByRole("combobox", { name: "Garçom" }))
    const opcoes = (await screen.findAllByRole("option")).map((opcao) => opcao.textContent)
    expect(opcoes).toEqual(["Todos os garçons", "Lucas", "Rafa", "Bia"])
  })

  test("a taxa de 25% mostra o erro do esquema e não salva", async () => {
    const { usuario, painel } = await abrirPainel()

    const taxa = painel.getByLabelText("Taxa de serviço (%)")
    await usuario.clear(taxa)
    await usuario.type(taxa, "25")
    await usuario.click(painel.getByRole("button", { name: "Salvar" }))

    expect(await screen.findByText("A taxa de serviço vai de 0% a 20%.")).toBeInTheDocument()
    expect((await api().salao.config()).taxaServico.percentual).toBe(10)
  })

  test("o couvert desligado esconde o campo de valor", async () => {
    const { usuario, painel } = await abrirPainel()

    await usuario.click(painel.getByRole("switch", { name: "Cobrar couvert" }))

    expect(painel.queryByLabelText("Couvert por pessoa (R$)")).not.toBeInTheDocument()
  })

  test("reservas, QR e funções Pro não aparecem e voltam iguais no que é salvo", async () => {
    const antes = await api().salao.config()
    const { usuario, painel } = await abrirPainel()

    expect(painel.queryByText(/reserva|QR|mapa/i)).not.toBeInTheDocument()
    await usuario.click(painel.getByRole("switch", { name: "Limpeza depois de fechar a conta" }))
    await usuario.click(painel.getByRole("button", { name: "Salvar" }))
    await screen.findByText("Salão salvo.")

    const depois = await api().salao.config()
    expect(depois.limpeza).toBe(false)
    expect(depois.reservas).toEqual(antes.reservas)
    expect(depois.qr).toEqual(antes.qr)
    expect(depois.funcoes).toEqual(antes.funcoes)
  })
})
