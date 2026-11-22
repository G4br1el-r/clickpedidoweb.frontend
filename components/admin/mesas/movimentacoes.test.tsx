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
  await screen.findByRole("searchbox", { name: "Buscar mesa" }, { timeout: 8000 })
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

describe("Mesas: mesas juntadas na grade", () => {
  test("a mesa 16 diz Com a mesa 15, e tocar nela abre a comanda da 15", async () => {
    const usuario = await abrir()

    const mesa16 = await cartao(16)
    expect(mesa16).toHaveAccessibleDescription(/^Com a mesa 15/)
    await usuario.click(mesa16)

    expect(await screen.findByRole("dialog", { name: "Mesa 15" })).toBeInTheDocument()
  })

  test("o filtro de estado oferece Juntada, e ?estado=juntada mostra só a 16", async () => {
    const usuario = await abrir("?estado=juntada")

    expect(await cartao(16)).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    await usuario.click(screen.getByRole("combobox", { name: "Estado" }))
    const opcoes = within(await screen.findByRole("listbox")).getAllByRole("option")
    expect(opcoes.map((opcao) => opcao.textContent)).toContain("Juntada")
  })
})

describe("Mesas: transferir, juntar e separar pelo menu ⋯", () => {
  test("transferir a mesa 1 para a 8 avisa com Desfazer; desfazer volta a comanda para a 1", async () => {
    const usuario = await abrir()
    await usuario.click((await menu(usuario, 1)).getByRole("menuitem", { name: "Transferir" }))
    const janela = within(await screen.findByRole("dialog", { name: "Transferir a mesa 1" }))
    await usuario.click(janela.getByRole("combobox", { name: "Para a mesa" }))
    await usuario.click(await screen.findByRole("option", { name: "Mesa 8" }))
    await usuario.click(janela.getByRole("button", { name: "Transferir" }))

    expect(await screen.findByText("Mesa 1 transferida para a mesa 8.")).toBeInTheDocument()
    await waitFor(async () => expect(await cartao(8)).toHaveAccessibleDescription(/^Pediu a conta/))
    await usuario.click(await screen.findByRole("button", { name: "Desfazer" }))

    expect(await screen.findByText("Desfeito.")).toBeInTheDocument()
    await waitFor(async () => expect(await cartao(1)).toHaveAccessibleDescription(/^Pediu a conta/))
    expect(await cartao(8)).toHaveAccessibleDescription(/^Livre/)
  })

  test("juntar a 8 à mesa 1 deixa a 8 Com a mesa 1; Separar no menu solta", async () => {
    const usuario = await abrir()
    await usuario.click((await menu(usuario, 1)).getByRole("menuitem", { name: "Juntar mesas" }))
    const janela = within(await screen.findByRole("dialog", { name: "Juntar à mesa 1" }))
    await usuario.click(janela.getByRole("checkbox", { name: /^Mesa 8\b/ }))
    await usuario.click(janela.getByRole("button", { name: "Juntar" }))

    expect(await screen.findByText("Mesa 8 junto com a mesa 1.")).toBeInTheDocument()
    await waitFor(async () => expect(await cartao(8)).toHaveAccessibleDescription(/^Com a mesa 1/))

    await usuario.click((await menu(usuario, 1)).getByRole("menuitem", { name: "Separar" }))
    expect(await screen.findByText("Mesas separadas.")).toBeInTheDocument()
    await waitFor(async () => expect(await cartao(8)).toHaveAccessibleDescription(/^Livre/))
  })

  test("o erro do servidor aparece no aviso: a mesa escolhida abriu enquanto isso", async () => {
    const usuario = await abrir()
    await usuario.click((await menu(usuario, 1)).getByRole("menuitem", { name: "Transferir" }))
    const janela = within(await screen.findByRole("dialog", { name: "Transferir a mesa 1" }))
    await usuario.click(janela.getByRole("combobox", { name: "Para a mesa" }))
    await usuario.click(await screen.findByRole("option", { name: "Mesa 8" }))
    await api().mesas.lancar({
      mesaId: "mesa-8",
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    await usuario.click(janela.getByRole("button", { name: "Transferir" }))

    expect(
      await screen.findByText("A mesa 8 já está aberta. Junte as mesas ou transfira os itens."),
    ).toBeInTheDocument()
  })

  test("marcar limpa a mesa 9 avisa com Desfazer; desfazer volta a Limpeza", async () => {
    const usuario = await abrir()
    await usuario.click((await menu(usuario, 9)).getByRole("menuitem", { name: "Marcar limpa" }))
    expect(await screen.findByText("Mesa 9 limpa.")).toBeInTheDocument()
    await waitFor(async () => expect(await cartao(9)).toHaveAccessibleDescription(/^Livre/))

    await usuario.click(await screen.findByRole("button", { name: "Desfazer" }))

    await waitFor(async () => expect(await cartao(9)).toHaveAccessibleDescription(/^Limpeza/))
  })
})
