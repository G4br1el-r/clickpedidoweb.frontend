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
import type { Produto } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { usePreferenciasMesas } from "@/lib/admin/preferencias-mesas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaMesas } from "./pagina-mesas"

vi.mock("react-to-print", () => ({ useReactToPrint: () => () => {} }))

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

/** Abre a tela de mesas já com a gaveta da mesa `numero` (pelo endereço). */
async function abrirMesa(numero: number) {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  const usuario = userEvent.setup()
  render(
    <Provedores endereco={`?mesa=${numero}`}>
      <PaginaMesas />
    </Provedores>,
  )
  const gaveta = await screen.findByRole(
    "dialog",
    { name: new RegExp(`^Mesa ${numero}\\b`) },
    {
      timeout: 8000,
    },
  )
  return { usuario, gaveta: within(gaveta) }
}

const cartao = (numero: number) =>
  screen.findByRole("button", { name: new RegExp(`^Mesa ${numero}\\b`) })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  localStorage.clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useGarcom.setState(useGarcom.getInitialState(), true)
  usePreferenciasMesas.setState(usePreferenciasMesas.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("ComandaMesa: abrir a mesa", () => {
  test("a mesa livre 11 pergunta pessoas, garçom e cliente, e abre com a comanda vazia", async () => {
    const { usuario, gaveta } = await abrirMesa(11)
    await usuario.type(gaveta.getByRole("spinbutton", { name: "Pessoas" }), "2")
    await usuario.click(gaveta.getByRole("combobox", { name: "Garçom" }))
    await usuario.click(await screen.findByRole("option", { name: "Bia" }))
    await usuario.type(gaveta.getByRole("textbox", { name: "Cliente (opcional)" }), "Carla")
    await usuario.click(gaveta.getByRole("button", { name: "Abrir mesa" }))

    expect(await screen.findByText("Mesa 11 aberta.")).toBeInTheDocument()
    expect(await gaveta.findByText(/A comanda está vazia/)).toBeInTheDocument()
    await usuario.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(await cartao(11)).toHaveTextContent("Ocupada")
    expect(await cartao(11)).toHaveTextContent("2 pessoas")
    const mesa = (await api().mesas.listar()).find((item) => item.numero === 11)
    const comanda = await api().pedidos.buscar(mesa?.pedidoAtivoId ?? 0)
    expect(comanda).toMatchObject({
      cliente: { nome: "Carla" },
      mesa: { garcom: "Bia", pessoas: 2 },
    })
  })

  test("mais pessoas que lugares avisa e deixa abrir", async () => {
    const { usuario, gaveta } = await abrirMesa(11)
    await usuario.type(gaveta.getByRole("spinbutton", { name: "Pessoas" }), "3")
    expect(gaveta.getByText("A mesa 11 tem 2 lugares.")).toBeInTheDocument()
    await usuario.clear(gaveta.getByRole("spinbutton", { name: "Pessoas" }))
    await usuario.type(gaveta.getByRole("spinbutton", { name: "Pessoas" }), "2")
    expect(gaveta.queryByText("A mesa 11 tem 2 lugares.")).not.toBeInTheDocument()
  })

  test("sem pessoas ou sem garçom, Abrir mesa fica desabilitado", async () => {
    const primeira = await abrirMesa(11)
    expect(primeira.gaveta.getByRole("button", { name: "Abrir mesa" })).toBeDisabled()
    await primeira.usuario.type(primeira.gaveta.getByRole("spinbutton", { name: "Pessoas" }), "2")
    expect(primeira.gaveta.getByRole("button", { name: "Abrir mesa" })).toBeDisabled()
  })

  test("o garçom guardado neste aparelho já vem marcado", async () => {
    useGarcom.setState({ nome: "Rafa" })
    const { gaveta } = await abrirMesa(11)
    expect(gaveta.getByRole("combobox", { name: "Garçom" })).toHaveTextContent("Rafa")
  })
})

describe("ComandaMesa: adicionar itens", () => {
  async function produtoSimples() {
    const lista = await api().produtos.listar()
    return lista.find((produto) => produto.grupos.length === 0 && produto.disponivel) as Produto
  }

  test("Adicionar itens abre o catálogo com a bandeja; enviar para a cozinha lança a rodada", async () => {
    const { simples } = { simples: await produtoSimples() }
    const mesa = (await api().mesas.listar()).find((item) => item.numero === 11)
    await api().mesas.abrir(mesa?.id ?? "", { pessoas: 2, garcom: "Bia" })
    const { usuario, gaveta } = await abrirMesa(11)

    await usuario.click(await gaveta.findByRole("button", { name: "Adicionar itens" }))
    const janela = within(await screen.findByRole("dialog", { name: "Adicionar itens · Mesa 11" }))
    const cartaoProduto = within(janela.getByRole("list", { name: "Produtos" }))
      .getByText(simples.nome, { exact: false, selector: "span" })
      .closest("button") as HTMLButtonElement
    await usuario.click(cartaoProduto)
    const bandeja = within(janela.getByRole("region", { name: "Bandeja" }))
    expect(bandeja.getByRole("listitem", { name: simples.nome })).toBeInTheDocument()
    await usuario.click(bandeja.getByRole("button", { name: "Enviar para a cozinha" }))

    expect(await screen.findByText("Mesa 11: enviado para a cozinha.")).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Adicionar itens · Mesa 11" }),
      ).not.toBeInTheDocument(),
    )
    expect(await gaveta.findByRole("listitem", { name: simples.nome })).toBeInTheDocument()
    await usuario.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(async () => expect(await cartao(11)).toHaveAccessibleDescription(/^Na cozinha/))
  })

  test("adicionar itens na mesa 1, que pediu a conta, avisa que ela voltou para Ocupada", async () => {
    const simples = await produtoSimples()
    const { usuario, gaveta } = await abrirMesa(1)
    await usuario.click(await gaveta.findByRole("button", { name: "Adicionar itens" }))
    const janela = within(await screen.findByRole("dialog", { name: "Adicionar itens · Mesa 1" }))
    const cartaoProduto = within(janela.getByRole("list", { name: "Produtos" }))
      .getByText(simples.nome, { exact: false, selector: "span" })
      .closest("button") as HTMLButtonElement
    await usuario.click(cartaoProduto)
    await usuario.click(
      within(janela.getByRole("region", { name: "Bandeja" })).getByRole("button", {
        name: "Lançar na mesa",
      }),
    )
    expect(
      await screen.findByText("A mesa 1 tinha pedido a conta e voltou para Ocupada."),
    ).toBeInTheDocument()
  })
})
