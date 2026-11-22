import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { usePreferenciasMesas } from "@/lib/admin/preferencias-mesas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaMesas } from "./pagina-mesas"

// Impressora: a fronteira com o navegador.
vi.mock("react-to-print", () => ({ useReactToPrint: () => vi.fn() }))

// Cada teste monta a tela inteira da demonstração.
vi.setConfig({ testTimeout: 20_000 })

function Provedores({ children, endereco }: { children: ReactNode; endereco?: string }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter hasMemory searchParams={endereco}>
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

async function abrir(endereco?: string) {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  const usuario = userEvent.setup()
  render(
    <Provedores endereco={endereco}>
      <PaginaMesas />
    </Provedores>,
  )
  // Com ?mesa= a gaveta abre por cima e esconde a busca: vale ela.
  if (endereco?.includes("mesa=")) await screen.findByRole("dialog", {}, { timeout: 8000 })
  else await screen.findByRole("searchbox", { name: "Buscar mesa" }, { timeout: 8000 })
  return usuario
}

const cartao = (numero: number) =>
  screen.findByRole("button", { name: new RegExp(`^Mesa ${numero}\\b`) })

const menu = async (usuario: ReturnType<typeof userEvent.setup>, numero: number) => {
  await usuario.click(await screen.findByRole("button", { name: `Ações da mesa ${numero}` }))
  return within(await screen.findByRole("menu"))
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  localStorage.clear()
  usePreferenciasMesas.setState(usePreferenciasMesas.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const painel = async () =>
  within(await screen.findByRole("region", { name: "Reservas e espera" }, { timeout: 8000 }))

/** As linhas da lista, pelo texto de cada uma. */
const linhas = (lista: HTMLElement) =>
  within(lista)
    .getAllByRole("listitem")
    .map((item) => item.textContent)

async function novaReserva(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click((await painel()).getByRole("button", { name: "Nova reserva" }))
  return within(await screen.findByRole("dialog", { name: "Nova reserva" }))
}

describe("Mesas: painel das reservas do dia", () => {
  test("lista as reservas de hoje pelo horário, com as pessoas e a mesa", async () => {
    await abrir()
    const reservas = await (await painel()).findByRole("list", { name: "Reservas de hoje" })
    await waitFor(() => expect(within(reservas).getAllByRole("listitem")).toHaveLength(2))
    const [marina, roberto] = linhas(reservas)
    expect(marina).toMatch(/20:50.*Marina Costa.*2 pessoas.*Mesa 13/)
    expect(roberto).toMatch(/22:30.*Roberto Andrade.*6 pessoas.*Sem mesa/)
  })

  test("Nova reserva diz o que falta ao salvar", async () => {
    const usuario = await abrir()
    const janela = await novaReserva(usuario)
    await usuario.click(janela.getByRole("button", { name: "Salvar reserva" }))

    expect(janela.getByText("Informe o nome.")).toBeInTheDocument()
    expect(janela.getByText("Informe o horário.")).toBeInTheDocument()
    expect(janela.getByText("Informe de 1 a 99 pessoas.")).toBeInTheDocument()
    expect(janela.getByRole("textbox", { name: "Nome" })).toHaveAttribute("aria-invalid", "true")
  })

  test("com 4 pessoas às 21:00, sugere a mesa 8; usar e salvar mostra a reserva na lista", async () => {
    const usuario = await abrir()
    const janela = await novaReserva(usuario)
    await usuario.type(janela.getByRole("textbox", { name: "Nome" }), "Ana Lima")
    fireEvent.change(janela.getByLabelText("Horário"), { target: { value: "21:00" } })
    await usuario.type(janela.getByRole("spinbutton", { name: "Pessoas" }), "4")

    expect(janela.getByText("Sugestão: mesa 8, 4 lugares.")).toBeInTheDocument()
    await usuario.click(janela.getByRole("button", { name: "Usar a mesa 8" }))
    expect(janela.getByRole("combobox", { name: "Mesa" })).toHaveTextContent("Mesa 8")
    await usuario.click(janela.getByRole("button", { name: "Salvar reserva" }))

    expect(await screen.findByText("Reserva de Ana Lima salva.")).toBeInTheDocument()
    const reservas = (await painel()).getByRole("list", { name: "Reservas de hoje" })
    await waitFor(() => expect(linhas(reservas)[1]).toMatch(/21:00.*Ana Lima.*4 pessoas.*Mesa 8/))
  })

  test("Editar, Não compareceu e Cancelar pelo ⋯ da reserva", async () => {
    const usuario = await abrir()
    const acoes = async (nome: string) => {
      await usuario.click(
        await (await painel()).findByRole("button", { name: `Mais ações da reserva de ${nome}` }),
      )
      return within(await screen.findByRole("menu"))
    }
    await usuario.click((await acoes("Marina Costa")).getByRole("menuitem", { name: "Editar" }))
    const janela = within(await screen.findByRole("dialog", { name: "Editar reserva" }))
    expect(janela.getByRole("textbox", { name: "Nome" })).toHaveValue("Marina Costa")
    await usuario.clear(janela.getByRole("spinbutton", { name: "Pessoas" }))
    await usuario.type(janela.getByRole("spinbutton", { name: "Pessoas" }), "3")
    await usuario.click(janela.getByRole("button", { name: "Salvar reserva" }))
    expect(await screen.findByText("Reserva de Marina Costa salva.")).toBeInTheDocument()

    await usuario.click(
      (await acoes("Roberto Andrade")).getByRole("menuitem", { name: "Não compareceu" }),
    )
    await usuario.click(
      (await acoes("Marina Costa")).getByRole("menuitem", { name: "Cancelar reserva" }),
    )

    const reservas = (await painel()).getByRole("list", { name: "Reservas de hoje" })
    await waitFor(() => {
      const [marina, roberto] = linhas(reservas)
      expect(marina).toMatch(/Marina Costa.*3 pessoas.*Cancelada/)
      expect(roberto).toMatch(/Roberto Andrade.*Não compareceu/)
    })
  })

  test("passada a tolerância, a reserva das 20:50 diz Não compareceu", async () => {
    // A demonstração nasce às 20:30 (com a Marina às 20:50); a tela abre às 21:06.
    await api().reservas.listar()
    vi.setSystemTime(new Date(2026, 10, 13, 21, 6))
    await abrir()
    const reservas = await (await painel()).findByRole("list", { name: "Reservas de hoje" })
    await waitFor(() => expect(linhas(reservas)[0]).toMatch(/Marina Costa.*Não compareceu/))
  })

  test("o erro do servidor aparece no aviso", async () => {
    const usuario = await abrir()
    const janela = await novaReserva(usuario)
    await usuario.type(janela.getByRole("textbox", { name: "Nome" }), "Ana Lima")
    fireEvent.change(janela.getByLabelText("Horário"), { target: { value: "21:00" } })
    await usuario.type(janela.getByRole("spinbutton", { name: "Pessoas" }), "2")
    await usuario.click(janela.getByRole("combobox", { name: "Mesa" }))
    await usuario.click(await screen.findByRole("option", { name: /^Mesa 13\b/ }))
    await usuario.click(janela.getByRole("button", { name: "Salvar reserva" }))

    expect(await screen.findByText("A mesa 13 já tem reserva às 20:50.")).toBeInTheDocument()
  })
})
