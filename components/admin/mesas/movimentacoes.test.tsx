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

describe("Mesas: a gaveta das mesas juntadas e transferir itens", () => {
  /** Mesa 60 com 1 Água e 3 Sucos, lançados sem cozinha. */
  async function mesa60(cozinha = false) {
    const mesa = await api().mesas.criar({ numero: 60 })
    return api().mesas.lancar({
      mesaId: mesa.id,
      garcom: "Rafa",
      enviarParaCozinha: cozinha,
      itens: [
        { avulso: { nome: "Água", preco: 4 }, quantidade: 1 },
        { avulso: { nome: "Suco", preco: 9.5 }, quantidade: 3 },
      ],
    })
  }

  test("a gaveta da mesa 15 diz que está junto com a 16", async () => {
    await abrir("?mesa=15")
    const gaveta = await screen.findByRole("dialog", { name: "Mesa 15" })
    expect(await within(gaveta).findByText(/Junto com a mesa 16/)).toBeInTheDocument()
  })

  test("transferir 1 de 3 Sucos da mesa 60 para a 8: a linha se divide e o aviso tem Desfazer", async () => {
    const comanda = await mesa60()
    const usuario = await abrir("?mesa=60")
    const gaveta = within(await screen.findByRole("dialog", { name: "Mesa 60" }))
    await usuario.click(await gaveta.findByRole("button", { name: "Transferir itens" }))
    const janela = within(
      await screen.findByRole("dialog", { name: "Transferir itens da mesa 60" }),
    )
    await usuario.type(janela.getByRole("spinbutton", { name: "3× Suco" }), "1")
    await usuario.click(janela.getByRole("combobox", { name: "Para a mesa" }))
    await usuario.click(await screen.findByRole("option", { name: "Mesa 8" }))
    await usuario.click(janela.getByRole("button", { name: "Transferir" }))

    expect(await screen.findByText("1× Suco foi para a mesa 8.")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Desfazer" })).toBeInTheDocument()
    const origem = await api().pedidos.buscar(comanda.id)
    expect(origem?.itens.map((item) => `${item.quantidade}× ${item.nome}`)).toEqual([
      "1× Água",
      "2× Suco",
    ])
    const mesa8 = (await api().mesas.listar()).find((mesa) => mesa.numero === 8)
    const destino = await api().pedidos.buscar(mesa8?.pedidoAtivoId ?? 0)
    expect(destino?.itens.map((item) => `${item.quantidade}× ${item.nome}`)).toEqual(["1× Suco"])
  })

  test("o item que a cozinha ainda tem fica travado, com Na cozinha", async () => {
    await mesa60(true)
    const usuario = await abrir("?mesa=60")
    const gaveta = within(await screen.findByRole("dialog", { name: "Mesa 60" }))
    await usuario.click(await gaveta.findByRole("button", { name: "Transferir itens" }))
    const janela = within(
      await screen.findByRole("dialog", { name: "Transferir itens da mesa 60" }),
    )

    expect(janela.getByRole("spinbutton", { name: "3× Suco" })).toBeDisabled()
    expect(janela.getAllByText("Na cozinha")).toHaveLength(2)
  })

  test("sem item e sem mesa, Transferir diz o que falta", async () => {
    await mesa60()
    const usuario = await abrir("?mesa=60")
    const gaveta = within(await screen.findByRole("dialog", { name: "Mesa 60" }))
    await usuario.click(await gaveta.findByRole("button", { name: "Transferir itens" }))
    const janela = within(
      await screen.findByRole("dialog", { name: "Transferir itens da mesa 60" }),
    )
    await usuario.click(janela.getByRole("button", { name: "Transferir" }))

    expect(janela.getByText("Escolha os itens.")).toBeInTheDocument()
    expect(janela.getByText("Escolha a mesa.")).toBeInTheDocument()
  })

  test("marcar limpa na gaveta da mesa 9 avisa com Desfazer, e desfazer não fecha a gaveta", async () => {
    const usuario = await abrir("?mesa=9")
    const gaveta = await screen.findByRole("dialog", { name: "Mesa 9" })
    await usuario.click(within(gaveta).getByRole("button", { name: "Marcar limpa" }))
    await waitFor(() => expect(gaveta).toHaveAccessibleDescription("Mesa livre."))

    // A gaveta é modal e o jsdom não lê o CSS do aviso (que recebe o clique por cima dela).
    const porCima = userEvent.setup({ pointerEventsCheck: 0 })
    await porCima.click(await screen.findByRole("button", { name: "Desfazer" }))

    await waitFor(() => expect(gaveta).toHaveAccessibleDescription("Limpeza."))
    expect(screen.getByRole("dialog", { name: "Mesa 9" })).toBeInTheDocument()
  })
})
