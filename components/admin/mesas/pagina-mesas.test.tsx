import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
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

// O cliente da última tela montada, para o teste ler a configuração das consultas.
let ultimoCliente: QueryClient

function Provedores({
  children,
  endereco,
  aoMudarUrl,
}: {
  children: ReactNode
  endereco?: string
  aoMudarUrl?: OnUrlUpdateFunction
}) {
  const [cliente] = useState(() => {
    ultimoCliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return ultimoCliente
  })
  return (
    <NuqsTestingAdapter hasMemory searchParams={endereco} onUrlUpdate={aoMudarUrl}>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
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

async function abrir(endereco?: string, aoMudarUrl?: OnUrlUpdateFunction) {
  telaGrande()
  const usuario = userEvent.setup()
  render(
    <Provedores endereco={endereco} aoMudarUrl={aoMudarUrl}>
      <PaginaMesas />
    </Provedores>,
  )
  // A grade tem uma lista por área; o Salão é a primeira da demonstração. Com filtro no
  // endereço o Salão pode sumir, e então vale a barra de filtros, que aparece com a grade.
  if (endereco) await screen.findByRole("searchbox", { name: "Buscar mesa" }, { timeout: 8000 })
  else await screen.findByRole("list", { name: "Salão" }, { timeout: 8000 })
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
  // A Fase 3 (Q23) inverte isto de propósito: rodada nova passa a limpar o "Pediu a conta".
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

  test("a mesa 1 pediu a conta há 12 min: o cartão mostra o alerta e fica marcado", async () => {
    await abrir()
    const mesa = await cartao(1)
    expect(mesa).toHaveAttribute("data-alerta", "conta-pedida")
    expect(within(mesa).getByText("Pediu a conta há 12 min")).toBeInTheDocument()
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

  test("imprimir a conta e fechar com a forma de pagamento tira a mesa de uso e a põe em limpeza", async () => {
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
    // A demonstração da pizzaria tem a limpeza ligada: a mesa paga espera ser limpa.
    expect(await cartao(60)).toHaveTextContent("Limpeza")
    const [fechada] = await api().pedidos.listar({ status: ["concluido"] })
    expect(fechada).toMatchObject({ pagamento: "pix", situacaoPagamento: "pago", total: 13.5 })
  })

  test("a faixa Números do salão mostra os quatro números da demonstração e esconde o resto em Ver mais", async () => {
    const usuario = await abrir()

    const faixa = within(await screen.findByRole("region", { name: "Números do salão" }))
    // A demonstração não tem conta de mesa paga hoje: faturamento zerado, médias sem valor.
    expect(faixa.getByText("Ocupação").nextElementSibling).toHaveTextContent("8/19 · 42%")
    expect(faixa.getByText("Pessoas").nextElementSibling).toHaveTextContent("21")
    expect(faixa.getByText("Faturamento hoje").nextElementSibling).toHaveTextContent("R$ 0,00")
    expect(faixa.getByText("Ticket por pessoa").nextElementSibling).toHaveTextContent("—")
    expect(faixa.queryByText("Permanência média")).not.toBeInTheDocument()

    await usuario.click(faixa.getByRole("button", { name: "Ver mais" }))

    expect(faixa.getByText("Permanência média").nextElementSibling).toHaveTextContent("—")
    expect(faixa.getByText("Giro das mesas").nextElementSibling).toHaveTextContent("—")
    expect(faixa.getByText("Ticket por mesa").nextElementSibling).toHaveTextContent("—")
  })

  test("a conta fechada hoje entra no faturamento, nos tickets, na permanência e no giro", async () => {
    const mesa = await mesaOcupada()
    const { pedidos } = await api().base()
    const comandaAberta = pedidos.find((pedido) => pedido.mesa?.id === mesa.id)
    if (!comandaAberta) throw new Error("A mesa 60 devia ter a comanda aberta")
    await api().mesas.fecharConta(comandaAberta.id, "pix")
    const usuario = await abrir()

    const faixa = within(await screen.findByRole("region", { name: "Números do salão" }))
    await usuario.click(faixa.getByRole("button", { name: "Ver mais" }))

    await waitFor(() =>
      expect(faixa.getByText("Faturamento hoje").nextElementSibling).toHaveTextContent("R$ 13,50"),
    )
    expect(faixa.getByText("Ticket por pessoa").nextElementSibling).toHaveTextContent("R$ 13,50")
    expect(faixa.getByText("Ticket por mesa").nextElementSibling).toHaveTextContent("R$ 13,50")
    expect(faixa.getByText("Permanência média").nextElementSibling).toHaveTextContent("25 min")
    expect(faixa.getByText("Giro das mesas").nextElementSibling).toHaveTextContent("0,1")
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

describe("PaginaMesas: grade por área", () => {
  test("uma seção por área, na ordem das áreas, com título e lista; área sem mesa não aparece", async () => {
    // A ordem das áreas vale, não a posição na lista: o Balcão passa para a frente.
    const salao = await api().salao.config()
    await api().salao.salvar({
      ...salao,
      areas: [
        { id: "area-salao", nome: "Salão", ordem: 3 },
        { id: "area-varanda", nome: "Varanda", ordem: 2 },
        { id: "area-balcao", nome: "Balcão", ordem: 1 },
        { id: "area-terraco", nome: "Terraço", ordem: 4 },
      ],
    })
    telaGrande()
    render(
      <Provedores>
        <PaginaMesas />
      </Provedores>,
    )
    const varanda = await screen.findByRole("list", { name: "Varanda" }, { timeout: 8000 })

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((titulo) => titulo.textContent),
    ).toEqual(["Balcão", "Varanda", "Salão"])
    expect(screen.queryByRole("list", { name: "Terraço" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Terraço" })).not.toBeInTheDocument()
    // Varanda: mesas 11 a 16. Balcão: 17 a 20.
    expect(within(varanda).getAllByRole("listitem")).toHaveLength(6)
    for (const numero of [11, 12, 13, 14, 15, 16]) {
      expect(within(varanda).getByRole("button", { name: `Mesa ${numero}` })).toBeInTheDocument()
    }
    expect(
      within(screen.getByRole("list", { name: "Balcão" })).getAllByRole("listitem"),
    ).toHaveLength(4)
  })
})

describe("PaginaMesas: menu ⋯", () => {
  const menu = async (usuario: ReturnType<typeof userEvent.setup>, numero: number) => {
    await usuario.click(await screen.findByRole("button", { name: `Ações da mesa ${numero}` }))
    return within(await screen.findByRole("menu"))
  }

  test("marcar limpa pelo menu deixa a mesa livre", async () => {
    const usuario = await abrir()
    expect(await cartao(9)).toHaveAccessibleDescription(/^Limpeza/)
    await usuario.click((await menu(usuario, 9)).getByRole("menuitem", { name: "Marcar limpa" }))
    expect(await screen.findByText("Mesa 9 limpa.")).toBeInTheDocument()
    await waitFor(async () => expect(await cartao(9)).toHaveAccessibleDescription("Livre"))
  })

  test("desbloquear pelo menu libera a mesa 20", async () => {
    const usuario = await abrir()
    expect(await cartao(20)).toHaveTextContent("Em manutenção")
    await usuario.click((await menu(usuario, 20)).getByRole("menuitem", { name: "Desbloquear" }))
    expect(await screen.findByText("Mesa 20 desbloqueada.")).toBeInTheDocument()
    await waitFor(async () => expect(await cartao(20)).toHaveAccessibleDescription("Livre"))
  })

  test("excluir pelo menu pede confirmação", async () => {
    const usuario = await abrir()
    const pergunta = async () => {
      await usuario.click((await menu(usuario, 20)).getByRole("menuitem", { name: "Excluir" }))
      return within(await screen.findByRole("alertdialog", { name: "Excluir a mesa 20?" }))
    }

    // Cancelar não mexe na mesa.
    await usuario.click((await pergunta()).getByRole("button", { name: "Cancelar" }))
    expect(await cartao(20)).toBeInTheDocument()

    await usuario.click((await pergunta()).getByRole("button", { name: "Excluir" }))
    expect(await screen.findByText("Mesa 20 excluída.")).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Mesa 20\b/ })).not.toBeInTheDocument(),
    )
  })
})

describe("PaginaMesas: busca e filtros no endereço", () => {
  test("digitar na busca escreve ?busca= e a grade mostra só as mesas que batem", async () => {
    const aoMudarUrl = vi.fn()
    const usuario = await abrir(undefined, aoMudarUrl)
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar mesa" }), "12")

    expect(await screen.findByRole("button", { name: /^Mesa 12\b/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Mesa 11\b/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Salão" })).not.toBeInTheDocument()
    expect(aoMudarUrl).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: "?busca=12" }),
    )
  })

  test("o endereço ?estado=bloqueada abre a grade já filtrada", async () => {
    await abrir("?estado=bloqueada")

    expect(await screen.findByRole("button", { name: /^Mesa 20\b/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Mesa 1\b/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
  })
  test("Precisam de atenção mostra a contagem e grava atencao=sim", async () => {
    const aoMudarUrl = vi.fn()
    const usuario = await abrir(undefined, aoMudarUrl)
    // A demonstração tem uma mesa com alerta: a que pediu a conta há 12 min.
    await usuario.click(await screen.findByRole("button", { name: "Precisam de atenção (1)" }))

    expect(aoMudarUrl).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: "?atencao=sim" }),
    )
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    // A contagem é de antes do próprio filtro: continua 1.
    expect(screen.getByRole("button", { name: "Precisam de atenção (1)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })
  test("a ordem Mais tempo aberta grava ordem=tempo", async () => {
    const aoMudarUrl = vi.fn()
    const usuario = await abrir(undefined, aoMudarUrl)
    await usuario.click(screen.getByRole("combobox", { name: "Ordem" }))
    await usuario.click(await screen.findByRole("option", { name: "Mais tempo aberta" }))

    expect(aoMudarUrl).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: "?ordem=tempo" }),
    )
    expect(screen.getByRole("combobox", { name: "Ordem" })).toHaveTextContent("Mais tempo aberta")
  })

  test("sem resultado, Limpar filtros volta ao endereço limpo", async () => {
    const aoMudarUrl = vi.fn()
    const usuario = await abrir("?busca=zzz", aoMudarUrl)

    expect(await screen.findByText("Nenhuma mesa com esses filtros")).toBeInTheDocument()
    await usuario.click(screen.getByRole("button", { name: "Limpar filtros" }))

    expect(aoMudarUrl).toHaveBeenLastCalledWith(expect.objectContaining({ queryString: "" }))
    expect(await screen.findByRole("list", { name: "Salão" })).toBeInTheDocument()
    expect(screen.queryByText("Nenhuma mesa com esses filtros")).not.toBeInTheDocument()
  })
})

describe("PaginaMesas: nova mesa, editar e bloquear", () => {
  const menu = async (usuario: ReturnType<typeof userEvent.setup>, numero: number) => {
    await usuario.click(await screen.findByRole("button", { name: `Ações da mesa ${numero}` }))
    return within(await screen.findByRole("menu"))
  }
  const escolher = async (
    usuario: ReturnType<typeof userEvent.setup>,
    janela: ReturnType<typeof within>,
    campo: string,
    opcao: string,
  ) => {
    await usuario.click(janela.getByRole("combobox", { name: campo }))
    await usuario.click(await screen.findByRole("option", { name: opcao }))
  }

  test("nova mesa pergunta área (a primeira marcada), lugares (4) e forma (quadrada) e nasce na área escolhida", async () => {
    const usuario = await abrir()
    await usuario.click(screen.getByRole("button", { name: "Nova mesa" }))
    const janela = within(screen.getByRole("dialog", { name: "Nova mesa" }))
    expect(janela.getByRole("combobox", { name: "Área" })).toHaveTextContent("Salão")
    expect(janela.getByRole("spinbutton", { name: "Lugares" })).toHaveValue(4)
    expect(janela.getByRole("combobox", { name: "Forma" })).toHaveTextContent("Quadrada")

    await usuario.type(janela.getByRole("spinbutton", { name: "Número" }), "61")
    await escolher(usuario, janela, "Área", "Varanda")
    await usuario.clear(janela.getByRole("spinbutton", { name: "Lugares" }))
    await usuario.type(janela.getByRole("spinbutton", { name: "Lugares" }), "6")
    await escolher(usuario, janela, "Forma", "Redonda")
    await usuario.click(janela.getByRole("button", { name: "Criar mesa" }))

    expect(await screen.findByText("Mesa 61 criada.")).toBeInTheDocument()
    const varanda = await screen.findByRole("list", { name: "Varanda" })
    expect(within(varanda).getByRole("button", { name: "Mesa 61" })).toBeInTheDocument()
    const mesa = (await api().mesas.listar()).find((item) => item.numero === 61)
    expect(mesa).toMatchObject({ areaId: "area-varanda", lugares: 6, forma: "redonda" })
  })

  test("Editar abre o formulário preenchido, salva e a mesa muda de área", async () => {
    const usuario = await abrir()
    await usuario.click((await menu(usuario, 3)).getByRole("menuitem", { name: "Editar" }))
    const janela = within(await screen.findByRole("dialog", { name: "Editar mesa 3" }))
    expect(janela.getByRole("spinbutton", { name: "Número" })).toHaveValue(3)
    expect(janela.getByRole("combobox", { name: "Área" })).toHaveTextContent("Salão")
    expect(janela.getByRole("combobox", { name: "Forma" })).toHaveTextContent("Quadrada")

    await usuario.type(janela.getByRole("textbox", { name: "Nome (opcional)" }), "Janela")
    await escolher(usuario, janela, "Área", "Varanda")
    await usuario.click(janela.getByRole("button", { name: "Salvar" }))

    expect(await screen.findByText("Mesa 3 salva.")).toBeInTheDocument()
    const varanda = await screen.findByRole("list", { name: "Varanda" })
    expect(within(varanda).getByRole("button", { name: "Mesa 3" })).toHaveTextContent("Janela")
    expect(screen.queryByRole("dialog", { name: "Editar mesa 3" })).not.toBeInTheDocument()
  })

  test("o erro do servidor ao editar aparece no aviso e a janela continua aberta", async () => {
    const usuario = await abrir()
    await usuario.click((await menu(usuario, 3)).getByRole("menuitem", { name: "Editar" }))
    const janela = within(await screen.findByRole("dialog", { name: "Editar mesa 3" }))
    await usuario.clear(janela.getByRole("spinbutton", { name: "Número" }))
    await usuario.type(janela.getByRole("spinbutton", { name: "Número" }), "4")
    await usuario.click(janela.getByRole("button", { name: "Salvar" }))

    expect(await screen.findByText("Já existe a mesa 4.")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Editar mesa 3" })).toBeInTheDocument()
  })

  test("Bloquear pergunta o motivo (opcional) e deixa o cartão Bloqueada com o motivo", async () => {
    const usuario = await abrir()
    await usuario.click((await menu(usuario, 12)).getByRole("menuitem", { name: "Bloquear" }))
    const janela = within(await screen.findByRole("dialog", { name: "Bloquear mesa 12" }))
    expect(janela.getByRole("textbox", { name: "Motivo (opcional)" })).toHaveValue("")
    await usuario.type(janela.getByRole("textbox", { name: "Motivo (opcional)" }), "Pé quebrado")
    await usuario.click(janela.getByRole("button", { name: "Bloquear" }))

    expect(await screen.findByText("Mesa 12 bloqueada.")).toBeInTheDocument()
    await waitFor(async () => expect(await cartao(12)).toHaveTextContent("Bloqueada"))
    expect(await cartao(12)).toHaveTextContent("Pé quebrado")
    expect(screen.queryByRole("dialog", { name: "Bloquear mesa 12" })).not.toBeInTheDocument()
  })

  test("sem motivo o bloqueio vale e o cartão diz 'Sem motivo'", async () => {
    const usuario = await abrir()
    await usuario.click((await menu(usuario, 12)).getByRole("menuitem", { name: "Bloquear" }))
    const janela = within(await screen.findByRole("dialog", { name: "Bloquear mesa 12" }))
    await usuario.click(janela.getByRole("button", { name: "Bloquear" }))

    await waitFor(async () => expect(await cartao(12)).toHaveTextContent("Sem motivo"))
  })

  test("a mesa ocupada não oferece Bloquear no menu", async () => {
    const usuario = await abrir()
    const itens = await menu(usuario, 6)
    expect(itens.getByRole("menuitem", { name: "Editar" })).toBeInTheDocument()
    expect(itens.queryByRole("menuitem", { name: "Bloquear" })).not.toBeInTheDocument()
  })

  test("Editar: o campo Nome fica vazio no nome padrão e preenchido no nome próprio", async () => {
    await api().mesas.editar((await api().mesas.listar()).find((m) => m.numero === 4)?.id ?? "", {
      numero: 4,
      nome: "Janela",
      areaId: "area-salao",
      lugares: 4,
      forma: "quadrada",
    })
    const usuario = await abrir()
    await usuario.click((await menu(usuario, 3)).getByRole("menuitem", { name: "Editar" }))
    expect(
      within(await screen.findByRole("dialog", { name: "Editar mesa 3" })).getByRole("textbox", {
        name: "Nome (opcional)",
      }),
    ).toHaveValue("")
    await usuario.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Editar mesa 3" })).not.toBeInTheDocument(),
    )

    await usuario.click((await menu(usuario, 4)).getByRole("menuitem", { name: "Editar" }))
    expect(
      within(await screen.findByRole("dialog", { name: "Editar mesa 4" })).getByRole("textbox", {
        name: "Nome (opcional)",
      }),
    ).toHaveValue("Janela")
  })

  describe("atalhos do teclado", () => {
    test("digitar 6, 0 e Enter fora de campo abre a comanda da mesa 60", async () => {
      await mesaOcupada()
      const usuario = await abrir()
      await cartao(60)
      await usuario.keyboard("60")
      expect(await screen.findByText("Mesa 60 ↵")).toBeInTheDocument()
      await usuario.keyboard("{Enter}")
      expect(await screen.findByRole("dialog", { name: /^Mesa 60/ })).toBeInTheDocument()
    })

    test("digitar 9, 9, 9 e Enter avisa que a mesa não existe", async () => {
      const usuario = await abrir()
      await usuario.keyboard("999{Enter}")
      expect(await screen.findByText("Não existe a mesa 999.")).toBeInTheDocument()
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    test("0 e Enter tratam a mesa 0 como inexistente", async () => {
      const usuario = await abrir()
      await usuario.keyboard("0{Enter}")
      expect(await screen.findByText("Não existe a mesa 0.")).toBeInTheDocument()
    })

    test("/ põe o foco na busca", async () => {
      const usuario = await abrir()
      await usuario.keyboard("/")
      expect(screen.getByRole("searchbox", { name: "Buscar mesa" })).toHaveFocus()
      expect(screen.getByRole("searchbox", { name: "Buscar mesa" })).toHaveValue("")
    })

    test("digitar n dentro da busca só escreve na busca", async () => {
      const usuario = await abrir()
      await usuario.click(screen.getByRole("searchbox", { name: "Buscar mesa" }))
      await usuario.keyboard("n")
      expect(screen.getByRole("searchbox", { name: "Buscar mesa" })).toHaveValue("n")
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    test("n abre Nova mesa", async () => {
      const usuario = await abrir()
      await usuario.keyboard("n")
      expect(await screen.findByRole("dialog", { name: "Nova mesa" })).toBeInTheDocument()
    })

    test("? abre a folha Atalhos do teclado", async () => {
      const usuario = await abrir()
      await usuario.keyboard("?")
      const folha = await screen.findByRole("dialog", { name: "Atalhos do teclado" })
      expect(within(folha).getByText("Abrir a mesa pelo número")).toBeInTheDocument()
    })

    test("com uma janela aberta, os atalhos não disparam", async () => {
      const usuario = await abrir()
      await usuario.keyboard("?")
      await screen.findByRole("dialog", { name: "Atalhos do teclado" })
      await usuario.keyboard("n")
      expect(screen.queryByRole("dialog", { name: "Nova mesa" })).not.toBeInTheDocument()
    })

    test("uma mesa criada no servidor depois da tela aberta aparece em até 4 s", async () => {
      // O relógio falso só mexe no Date; esperar 4 s de verdade pesaria no teste, então
      // confere o intervalo que a consulta usa.
      await abrir()
      const cliente = ultimoCliente
      const consulta = cliente.getQueryCache().find({ queryKey: ["admin", "pizzaria", "mesas"] })
      expect(consulta?.observers[0]?.options.refetchInterval).toBe(4_000)
    })
  })
})
