import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaMesas } from "./pagina-mesas"

// Impressora: a fronteira com o navegador. O teste confere só que a conta foi mandada.
const imprimir = vi.fn()
vi.mock("react-to-print", () => ({ useReactToPrint: () => imprimir }))

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={cliente}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

function telaGrande() {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const api = () => servidorDo("pizzaria")

/** Mesa 60 com 2 itens de R$ 4,00 e R$ 9,50, lançados 25 minutos atrás. */
async function mesaOcupada() {
  const mesa = await api().mesas.criar({ numero: 60 })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 5))
  await api().mesas.lancar({
    mesaId: mesa.id,
    garcom: "Rafa",
    clienteNome: "Júlia",
    enviarParaCozinha: false,
    itens: [
      { avulso: { nome: "Água", preco: 4 }, quantidade: 1 },
      { avulso: { nome: "Suco", preco: 9.5 }, quantidade: 1 },
    ],
  })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  return mesa
}

async function abrir() {
  telaGrande()
  const usuario = userEvent.setup()
  render(
    <Provedores>
      <PaginaMesas />
    </Provedores>,
  )
  await screen.findByRole("list", { name: "Mesas" }, { timeout: 8000 })
  return usuario
}

const cartao = (numero: number) =>
  screen.findByRole("button", { name: new RegExp(`^Mesa ${numero}\\b`) })
const comanda = () => within(screen.getByRole("dialog", { name: /^Mesa 60/ }))
const total = () => comanda().getByText("Total").closest("div")

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  imprimir.mockClear()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("PaginaMesas", () => {
  test("o resumo conta a rodada na cozinha pelo status da comanda, mesmo com a conta pedida", async () => {
    // Na demonstração, as mesas 6, 7 e 8 têm rodada na cozinha; a mesa 1 já pediu a conta.
    const [mesas, base] = await Promise.all([api().mesas.listar(), api().base()])
    const contaPedida = mesas.find((mesa) => mesa.numero === 1)
    const comanda = base.pedidos.find((pedido) => pedido.id === contaPedida?.pedidoAtivoId)
    if (!contaPedida || !comanda?.contaPedidaEm) {
      throw new Error("A demonstração devia ter a mesa 1 pedindo a conta")
    }
    const nova = await api().mesas.lancar({
      mesaId: contaPedida.id,
      enviarParaCozinha: true,
      itens: [{ avulso: { nome: "Pizza", preco: 40 }, quantidade: 1 }],
    })
    await api().pedidos.avancar(nova.id, nova.status)
    await abrir()

    expect(await cartao(1)).toHaveAccessibleDescription(/^Pediu a conta/)
    expect(await screen.findByText(/4 com rodada na cozinha/)).toBeInTheDocument()
  })

  test("a demonstração mostra a mesa 20 bloqueada, a comanda mais antiga pedindo a conta e outra para servir", async () => {
    const [mesas, base] = await Promise.all([api().mesas.listar(), api().base()])
    const comComanda = mesas.flatMap((mesa) => {
      const comanda = base.pedidos.find((pedido) => pedido.id === mesa.pedidoAtivoId)
      return comanda ? [{ mesa, comanda }] : []
    })
    const maisAntiga = comComanda.reduce((a, b) =>
      a.comanda.criadoEm < b.comanda.criadoEm ? a : b,
    )
    const paraServir = comComanda.find(({ comanda }) => comanda.servirDesde)
    if (!paraServir) throw new Error("A demonstração devia ter uma mesa para servir")
    await abrir()

    expect(await cartao(20)).toHaveAccessibleDescription(/^Bloqueada/)
    expect(await cartao(maisAntiga.mesa.numero)).toHaveAccessibleDescription(/^Pediu a conta/)
    expect(await cartao(paraServir.mesa.numero)).toHaveAccessibleDescription(/^Servir/)
    expect(await cartao(9)).toHaveAccessibleDescription(/^Limpeza/)
  })

  test("a grade mostra a mesa ocupada com cliente, tempo, garçom e total", async () => {
    await mesaOcupada()
    await abrir()
    const mesa = await cartao(60)
    expect(mesa).toHaveTextContent("Ocupada")
    expect(mesa).toHaveTextContent("Júlia")
    expect(mesa).toHaveTextContent("25 min")
    expect(mesa).toHaveTextContent("Rafa")
    expect(mesa).toHaveTextContent("R$ 13,50")
  })

  test("o estado de cada mesa se lê pelo traço: livre, ocupada ou com rodada na cozinha", async () => {
    await mesaOcupada()
    await api().mesas.criar({ numero: 62 })
    const comCozinha = await api().mesas.criar({ numero: 63 })
    await api().mesas.lancar({
      mesaId: comCozinha.id,
      enviarParaCozinha: true,
      itens: [{ avulso: { nome: "Pizza", preco: 40 }, quantidade: 1 }],
    })
    await abrir()

    const estado = async (numero: number) => {
      const traco = (await cartao(numero)).querySelector("[data-traco]")
      return { tom: traco?.getAttribute("data-tom"), texto: traco?.parentElement?.textContent }
    }
    expect(await estado(60)).toEqual({ tom: "caminho", texto: "Ocupada" })
    expect(await estado(62)).toEqual({ tom: "fim", texto: "Livre" })
    expect(await estado(63)).toEqual({ tom: "preparo", texto: "Na cozinha" })
  })

  test("nova mesa com número; número repetido é recusado", async () => {
    const usuario = await abrir()
    await usuario.click(screen.getByRole("button", { name: "Nova mesa" }))
    const janela = within(screen.getByRole("dialog", { name: "Nova mesa" }))
    await usuario.type(janela.getByRole("spinbutton", { name: "Número" }), "61")
    await usuario.click(janela.getByRole("button", { name: "Criar mesa" }))
    expect(await cartao(61)).toHaveTextContent("Livre")

    await usuario.click(screen.getByRole("button", { name: "Nova mesa" }))
    const outra = within(screen.getByRole("dialog", { name: "Nova mesa" }))
    await usuario.type(outra.getByRole("spinbutton", { name: "Número" }), "61")
    await usuario.click(outra.getByRole("button", { name: "Criar mesa" }))
    expect(await screen.findByText("Já existe a mesa 61.")).toBeInTheDocument()
  })

  test("comanda: mais, menos, remover e item avulso refazem o total", async () => {
    await mesaOcupada()
    const usuario = await abrir()
    await usuario.click(await cartao(60))
    expect(total()).toHaveTextContent("R$ 13,50")

    const agua = within(comanda().getByRole("listitem", { name: "Água" }))
    await usuario.click(agua.getByRole("button", { name: "Mais um" }))
    await waitFor(() => expect(total()).toHaveTextContent("R$ 17,50"))
    await usuario.click(agua.getByRole("button", { name: "Menos um" }))
    await waitFor(() => expect(total()).toHaveTextContent("R$ 13,50"))

    await usuario.click(
      within(comanda().getByRole("listitem", { name: "Suco" })).getByRole("button", {
        name: "Remover",
      }),
    )
    await waitFor(() => expect(total()).toHaveTextContent("R$ 4,00"))

    await usuario.type(comanda().getByRole("textbox", { name: "Item avulso" }), "Couvert")
    await usuario.type(comanda().getByRole("textbox", { name: "Valor" }), "12,50")
    await usuario.click(comanda().getByRole("button", { name: "Incluir item avulso" }))
    expect(await comanda().findByRole("listitem", { name: "Couvert" })).toBeInTheDocument()
    expect(total()).toHaveTextContent("R$ 16,50")
  })

  test("tirar ou diminuir o que a cozinha já preparou pede confirmação", async () => {
    const mesa = await mesaOcupada()
    const comAPizza = await api().mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [{ avulso: { nome: "Pizza", preco: 40 }, quantidade: 2 }],
    })
    await api().pedidos.avancar(comAPizza.id, "recebido")
    const usuario = await abrir()
    await usuario.click(await cartao(60))
    expect(total()).toHaveTextContent("R$ 93,50")
    const pizza = () => within(comanda().getByRole("listitem", { name: "Pizza" }))

    // Voltar não mexe na comanda.
    await usuario.click(pizza().getByRole("button", { name: "Remover" }))
    const pergunta = within(screen.getByRole("alertdialog", { name: "Tirar Pizza da comanda?" }))
    expect(pergunta.getByText("A cozinha já preparou.")).toBeInTheDocument()
    await usuario.click(pergunta.getByRole("button", { name: "Voltar" }))
    expect(total()).toHaveTextContent("R$ 93,50")

    await usuario.click(pizza().getByRole("button", { name: "Menos um" }))
    await usuario.click(
      within(screen.getByRole("alertdialog", { name: "Tirar Pizza da comanda?" })).getByRole(
        "button",
        { name: "Tirar da comanda" },
      ),
    )
    await waitFor(() => expect(total()).toHaveTextContent("R$ 53,50"))

    // O que não foi para a cozinha sai direto, sem perguntar.
    await usuario.click(
      within(comanda().getByRole("listitem", { name: "Suco" })).getByRole("button", {
        name: "Remover",
      }),
    )
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    await waitFor(() => expect(total()).toHaveTextContent("R$ 44,00"))
  })

  test("imprimir a conta e fechar com a forma de pagamento libera a mesa", async () => {
    await mesaOcupada()
    const usuario = await abrir()
    await usuario.click(await cartao(60))
    await usuario.click(comanda().getByRole("button", { name: "Imprimir conta" }))
    expect(imprimir).toHaveBeenCalled()

    await usuario.click(comanda().getByRole("button", { name: "Fechar conta" }))
    const fechar = within(screen.getByRole("dialog", { name: "Fechar a conta da mesa 60" }))
    await usuario.click(fechar.getByRole("radio", { name: "Pix" }))
    // Dinheiro do Intl vem com espaço não separável, que o nome acessível mantém.
    await usuario.click(fechar.getByRole("button", { name: "Receber R$ 13,50" }))

    expect(await screen.findByText("Conta da mesa 60 fechada.")).toBeInTheDocument()
    expect(await cartao(60)).toHaveTextContent("Livre")
    const [fechada] = await api().pedidos.listar({ status: ["concluido"] })
    expect(fechada).toMatchObject({ pagamento: "pix", situacaoPagamento: "pago", total: 13.5 })
  })

  test("liberar aparece só com a comanda vazia; mesa livre pode ser excluída", async () => {
    await mesaOcupada()
    const usuario = await abrir()
    await usuario.click(await cartao(60))
    expect(comanda().queryByRole("button", { name: "Liberar mesa" })).not.toBeInTheDocument()

    for (const nome of ["Água", "Suco"]) {
      await usuario.click(
        within(await comanda().findByRole("listitem", { name: nome })).getByRole("button", {
          name: "Remover",
        }),
      )
    }
    await usuario.click(await comanda().findByRole("button", { name: "Liberar mesa" }))
    expect(await cartao(60)).toHaveTextContent("Livre")

    await usuario.click(await cartao(60))
    await usuario.click(comanda().getByRole("button", { name: "Excluir mesa" }))
    await usuario.click(
      within(screen.getByRole("alertdialog", { name: "Excluir a mesa 60?" })).getByRole("button", {
        name: "Excluir",
      }),
    )
    expect(await screen.findByText("Mesa 60 excluída.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Mesa 60\b/ })).not.toBeInTheDocument()
  })
})
