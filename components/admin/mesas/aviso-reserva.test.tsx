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

const AVISO = "Reservada às 20:50 para Marina Costa, 2 pessoas."

/** Mesa 60 aberta pela Rafa com 1 Água, lançada sem cozinha. */
async function mesa60() {
  const mesa = await api().mesas.criar({ numero: 60 })
  return api().mesas.lancar({
    mesaId: mesa.id,
    garcom: "Rafa",
    enviarParaCozinha: false,
    itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
  })
}

describe("Mesas: confirmar a reserva ao abrir", () => {
  test("a gaveta da mesa 13 avisa a reserva, e Abrir mesmo assim abre", async () => {
    const usuario = await abrir("?mesa=13")
    const gaveta = within(await screen.findByRole("dialog", { name: "Mesa 13" }))
    expect(await gaveta.findByText(AVISO)).toBeInTheDocument()

    await usuario.type(gaveta.getByRole("spinbutton", { name: "Pessoas" }), "3")
    await usuario.click(gaveta.getByRole("combobox", { name: "Garçom" }))
    await usuario.click(await screen.findByRole("option", { name: "Rafa" }))
    await usuario.click(gaveta.getByRole("button", { name: "Abrir mesmo assim" }))

    expect(await screen.findByText("Mesa 13 aberta.")).toBeInTheDocument()
    const treze = (await api().mesas.listar()).find((mesa) => mesa.numero === 13)
    expect(treze?.status).toBe("ocupada")
  })

  test("Sentar Marina Costa senta a reserva na mesa 13, com o garçom", async () => {
    const usuario = await abrir("?mesa=13")
    const gaveta = within(await screen.findByRole("dialog", { name: "Mesa 13" }))
    await usuario.click(await gaveta.findByRole("combobox", { name: "Garçom" }))
    await usuario.click(await screen.findByRole("option", { name: "Bia" }))
    await usuario.click(gaveta.getByRole("button", { name: "Sentar Marina Costa" }))

    expect(await screen.findByText("Marina Costa na mesa 13.")).toBeInTheDocument()
    const [marina] = await api().reservas.listar()
    expect(marina.status).toBe("sentou")
    const treze = (await api().mesas.listar()).find((mesa) => mesa.numero === 13)
    const comanda = await api().pedidos.buscar(treze?.pedidoAtivoId ?? 0)
    expect(comanda?.mesa).toMatchObject({ garcom: "Bia", pessoas: 2 })
  })

  test("a mesa livre sem reserva continua com Abrir mesa", async () => {
    await abrir("?mesa=12")
    const gaveta = within(await screen.findByRole("dialog", { name: "Mesa 12" }))
    expect(await gaveta.findByRole("button", { name: "Abrir mesa" })).toBeInTheDocument()
    expect(gaveta.queryByText(/Reservada às/)).not.toBeInTheDocument()
  })
})

describe("Mesas: confirmar a reserva nas movimentações", () => {
  test("transferir a mesa 1 para a 13 avisa a reserva e transfere com Transferir mesmo assim", async () => {
    const usuario = await abrir()
    await usuario.click((await menu(usuario, 1)).getByRole("menuitem", { name: "Transferir" }))
    const janela = within(await screen.findByRole("dialog", { name: "Transferir a mesa 1" }))
    await usuario.click(janela.getByRole("combobox", { name: "Para a mesa" }))
    await usuario.click(await screen.findByRole("option", { name: "Mesa 13 · reservada 20:50" }))
    expect(janela.getByText(AVISO)).toBeInTheDocument()
    await usuario.click(janela.getByRole("button", { name: "Transferir mesmo assim" }))

    expect(await screen.findByText("Mesa 1 transferida para a mesa 13.")).toBeInTheDocument()
  })

  test("transferir itens para a 13 avisa a reserva e transfere com Transferir mesmo assim", async () => {
    await mesa60()
    const usuario = await abrir("?mesa=60")
    const gaveta = within(await screen.findByRole("dialog", { name: "Mesa 60" }))
    await usuario.click(await gaveta.findByRole("button", { name: "Transferir itens" }))
    const janela = within(
      await screen.findByRole("dialog", { name: "Transferir itens da mesa 60" }),
    )
    await usuario.type(janela.getByRole("spinbutton", { name: "1× Água" }), "1")
    await usuario.click(janela.getByRole("combobox", { name: "Para a mesa" }))
    await usuario.click(await screen.findByRole("option", { name: "Mesa 13 · reservada 20:50" }))
    expect(janela.getByText(AVISO)).toBeInTheDocument()
    await usuario.click(janela.getByRole("button", { name: "Transferir mesmo assim" }))

    expect(await screen.findByText("1× Água foi para a mesa 13.")).toBeInTheDocument()
  })

  test("juntar a 13 à mesa 1 avisa a reserva e junta com Juntar mesmo assim", async () => {
    const usuario = await abrir()
    await usuario.click((await menu(usuario, 1)).getByRole("menuitem", { name: "Juntar mesas" }))
    const janela = within(await screen.findByRole("dialog", { name: "Juntar à mesa 1" }))
    await usuario.click(janela.getByRole("checkbox", { name: /^Mesa 13 · reservada 20:50/ }))
    expect(janela.getByText(AVISO)).toBeInTheDocument()
    await usuario.click(janela.getByRole("button", { name: "Juntar mesmo assim" }))

    expect(await screen.findByText("Mesa 13 junto com a mesa 1.")).toBeInTheDocument()
    await waitFor(async () => expect(await cartao(13)).toHaveAccessibleDescription(/^Com a mesa 1/))
  })
})
