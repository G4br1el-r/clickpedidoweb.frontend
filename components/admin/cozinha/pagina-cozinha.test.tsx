import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import type { Produto } from "@/lib/admin/dados/tipos"
import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaCozinha } from "./pagina-cozinha"

/** A impressora: anota o texto de cada via que sai. */
const impressas: string[] = []
vi.mock("react-to-print", () => ({
  useReactToPrint: () => () =>
    impressas.push(document.querySelector("[data-via]")?.textContent ?? ""),
}))

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

/** Computador ou TV: as três colunas lado a lado. */
function telaGrande() {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const api = () => servidorDo("pizzaria")

async function produtoSimples() {
  const lista = await api().produtos.listar()
  return lista.find((produto) => produto.grupos.length === 0 && produto.disponivel) as Produto
}

/** Comanda nova na mesa, com um item para a cozinha. */
async function comandaNaMesa(numero: number, quantidade = 2) {
  const produto = await produtoSimples()
  const mesa = await api().mesas.criar({ numero })
  const comanda = await api().mesas.lancar({
    mesaId: mesa.id,
    garcom: "Rafa",
    enviarParaCozinha: true,
    itens: [{ produtoId: produto.id, escolhas: {}, quantidade }],
  })
  return { produto, mesa, comanda }
}

function renderizar(intervalo = 60_000, tique?: number) {
  return render(
    <Provedores>
      <PaginaCozinha intervalo={intervalo} tique={tique} />
    </Provedores>,
  )
}

/** AudioContext de mentira: anota a frequência de cada nota tocada. */
function simularAudio() {
  const notas: number[] = []
  vi.stubGlobal(
    "AudioContext",
    class {
      currentTime = 0
      destination = {}
      state = "running"
      createOscillator() {
        return {
          type: "sine",
          frequency: { setValueAtTime: (valor: number) => notas.push(valor) },
          connect: (no: unknown) => no,
          start: () => {},
          stop: () => {},
        }
      }
      createGain() {
        return {
          gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
          connect: (no: unknown) => no,
        }
      }
      resume() {}
    },
  )
  return {
    /** Quantas vezes tocou o som de cancelado ou alterado (a primeira nota dele). */
    cancelado: () => notas.filter((nota) => nota === 659.25).length / 2,
    atrasado: () => notas.filter((nota) => nota === 392).length,
    /** O alerta de novo, no som "alto" da loja: a primeira nota da campainha. */
    novo: () => notas.filter((nota) => nota === 1046.5).length,
  }
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))

const coluna = async (nome: string) =>
  within(await screen.findByRole("region", { name: new RegExp(`^${nome}`) }, { timeout: 8000 }))

/**
 * Quantos tickets a coluna tem, pelo nome dela ("Preparando, 3"). Vem dos dados: o ticket que
 * sai de uma coluna fica no DOM enquanto a animação de saída não termina.
 */
const contagem = async (nome: string) =>
  Number(
    (await screen.findByRole("region", { name: new RegExp(`^${nome}, `) }))
      .getAttribute("aria-label")
      ?.split(", ")[1],
  )

const ticket = (nome: string) => screen.findByRole("article", { name: new RegExp(`^${nome} ·`) })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  usePreferenciasFila.setState({ ...usePreferenciasFila.getInitialState(), simular: false }, true)
  // Os recursos Pro da cozinha ficam liberados; os testes do cadeado desligam.
  useConfig.setState({ pro: true, compradas: [] })
  impressas.length = 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  // Os toasts do Sonner vivem fora da árvore: o de um teste não pode sobrar no outro.
  toast.dismiss()
})

describe("PaginaCozinha", () => {
  test("a fazer, preparando e prontos; iniciar e marcar pronto movem o ticket", async () => {
    telaGrande()
    const { produto } = await comandaNaMesa(50)
    const usuario = userEvent.setup()
    renderizar()

    const aFazer = await coluna("A fazer")
    const doTicket = within(await ticket("Mesa 50"))
    expect(aFazer.getByRole("article", { name: /^Mesa 50 ·/ })).toBeInTheDocument()
    expect(doTicket.getByRole("list", { name: "Para preparar" })).toHaveTextContent(
      `2× ${produto.nome}`,
    )
    expect(doTicket.getByText("Garçom: Rafa")).toBeInTheDocument()

    await usuario.click(doTicket.getByRole("button", { name: "Iniciar preparo" }))
    const preparando = await coluna("Preparando")
    expect(await preparando.findByRole("article", { name: /^Mesa 50 ·/ })).toBeInTheDocument()

    // Dentro da coluna: o ticket que andou ainda sai da coluna anterior enquanto anima.
    await usuario.click(
      within(await preparando.findByRole("article", { name: /^Mesa 50 ·/ })).getByRole("button", {
        name: "Marcar pronto",
      }),
    )
    const prontos = await coluna("Prontos")
    const pronto = within(await prontos.findByRole("article", { name: /^Mesa 50 ·/ }))
    // Da cozinha não se conclui nem se recebe a mesa: a conta fecha em Mesas.
    expect(
      pronto.queryByRole("button", { name: /concluir|fechar|receber|marcar pronto/i }),
    ).not.toBeInTheDocument()
    expect(pronto.getByText("Servir na mesa")).toBeInTheDocument()
  })

  test("a rodada nova é outro ticket: a primeira continua no preparo", async () => {
    telaGrande()
    const { produto, mesa, comanda } = await comandaNaMesa(51, 1)
    await api().cozinha.avancar(comanda.id, 1, "recebido")
    const [outro] = (await api().produtos.listar()).filter(
      (item) => item.grupos.length === 0 && item.disponivel && item.id !== produto.id,
    )
    await api().mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [{ produtoId: outro.id, escolhas: {}, quantidade: 3 }],
    })
    renderizar()

    const segunda = within(
      await (await coluna("A fazer")).findByRole("article", { name: /^Mesa 51 · .* · 2ª rodada$/ }),
    )
    expect(segunda.getByRole("list", { name: "Para preparar" })).toHaveTextContent(
      `3× ${outro.nome}`,
    )
    expect(segunda.getByRole("list", { name: "Para preparar" })).not.toHaveTextContent(produto.nome)
    const primeira = within(
      (await coluna("Preparando")).getByRole("article", { name: /^Mesa 51 · #\d+$/ }),
    )
    expect(primeira.getByRole("list", { name: "Para preparar" })).toHaveTextContent(
      `1× ${produto.nome}`,
    )
  })

  test("riscar item por item: o primeiro começa o preparo e o último deixa pronto", async () => {
    telaGrande()
    const [primeiro, segundo] = (await api().produtos.listar()).filter(
      (item) => item.grupos.length === 0 && item.disponivel,
    )
    const mesa = await api().mesas.criar({ numero: 57 })
    await api().mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [
        { produtoId: primeiro.id, escolhas: {}, quantidade: 1 },
        { produtoId: segundo.id, escolhas: {}, quantidade: 2 },
      ],
    })
    const usuario = userEvent.setup()
    renderizar()

    await usuario.click(
      within(await ticket("Mesa 57")).getByRole("checkbox", { name: `1× ${primeiro.nome}` }),
    )
    const preparando = within(
      await (await coluna("Preparando")).findByRole("article", { name: /^Mesa 57 ·/ }),
    )
    expect(preparando.getByRole("checkbox", { name: `1× ${primeiro.nome}` })).toBeChecked()
    expect(preparando.getByText("1 de 2")).toBeInTheDocument()

    await usuario.click(preparando.getByRole("checkbox", { name: `2× ${segundo.nome}` }))
    expect(
      await (await coluna("Prontos")).findByRole("article", { name: /^Mesa 57 ·/ }),
    ).toBeInTheDocument()
  })

  test("o menu do ticket volta uma etapa", async () => {
    telaGrande()
    const { comanda } = await comandaNaMesa(58)
    await api().cozinha.avancar(comanda.id, 1, "recebido")
    const usuario = userEvent.setup()
    renderizar()

    const noPreparo = within(
      await (await coluna("Preparando")).findByRole("article", { name: /^Mesa 58 ·/ }),
    )
    await usuario.click(noPreparo.getByRole("button", { name: "Mais ações" }))
    await usuario.click(await screen.findByRole("menuitem", { name: "Voltar para A fazer" }))
    expect(
      await (await coluna("A fazer")).findByRole("article", { name: /^Mesa 58 ·/ }),
    ).toBeInTheDocument()
  })

  test("toque errado: o aviso de cada avanço tem Desfazer", async () => {
    telaGrande()
    await comandaNaMesa(59)
    const usuario = userEvent.setup()
    renderizar()
    await ticket("Mesa 59")
    const [aFazer, preparando] = [await contagem("A fazer"), await contagem("Preparando")]

    await usuario.click(
      within(await ticket("Mesa 59")).getByRole("button", { name: "Iniciar preparo" }),
    )
    expect(await screen.findByText(/^Mesa 59 · #\d+ foi para Preparando\.$/)).toBeInTheDocument()
    await waitFor(async () => expect(await contagem("Preparando")).toBe(preparando + 1))

    await usuario.click(await screen.findByRole("button", { name: "Desfazer" }))
    await waitFor(async () => expect(await contagem("Preparando")).toBe(preparando))
    expect(await contagem("A fazer")).toBe(aFazer)
  })

  test("prioridade pelo menu põe o ticket no topo da coluna, marcado", async () => {
    telaGrande()
    await comandaNaMesa(60)
    const usuario = userEvent.setup()
    renderizar()

    await usuario.click(within(await ticket("Mesa 60")).getByRole("button", { name: "Mais ações" }))
    await usuario.click(await screen.findByRole("menuitemcheckbox", { name: "Prioridade" }))

    const aFazer = await coluna("A fazer")
    await waitFor(() =>
      expect(aFazer.getAllByRole("article")[0]).toHaveAccessibleName(/^Mesa 60 ·/),
    )
    expect(within(aFazer.getAllByRole("article")[0]).getByText("Prioridade")).toBeInTheDocument()
  })

  test("cancelado fica na tela marcado até alguém dar ciente", async () => {
    telaGrande()
    const { comanda } = await comandaNaMesa(61)
    await api().cozinha.avancar(comanda.id, 1, "recebido")
    await api().pedidos.cancelar(comanda.id, "em-preparo")
    const usuario = userEvent.setup()
    renderizar()

    const cancelado = within(await ticket("Mesa 61"))
    expect(cancelado.getByText("Cancelado")).toBeInTheDocument()
    expect(cancelado.queryByRole("button", { name: "Marcar pronto" })).not.toBeInTheDocument()
    const antes = await contagem("Preparando")

    await usuario.click(cancelado.getByRole("button", { name: "Ciente" }))
    await waitFor(async () => expect(await contagem("Preparando")).toBe(antes - 1))
  })

  test("item tirado da comanda aparece como alteração no ticket, com ciente", async () => {
    telaGrande()
    const { produto, comanda } = await comandaNaMesa(62, 3)
    await api().mesas.alterarQuantidade(comanda.id, comanda.itens[0].id, 1)
    const usuario = userEvent.setup()
    renderizar()

    const alterado = within(await ticket("Mesa 62"))
    expect(alterado.getByText(`Alterado: tirou 2× ${produto.nome}`)).toBeInTheDocument()
    await usuario.click(alterado.getByRole("button", { name: "Ciente" }))
    await waitFor(() => expect(alterado.queryByText(/^Alterado:/)).not.toBeInTheDocument())
  })

  test("acabou: o produto do ticket sai do cardápio na hora, com desfazer", async () => {
    telaGrande()
    const { produto } = await comandaNaMesa(63)
    const usuario = userEvent.setup()
    renderizar()
    const disponivel = async () =>
      (await api().produtos.listar()).find((item) => item.id === produto.id)?.disponivel

    await usuario.click(within(await ticket("Mesa 63")).getByRole("button", { name: "Mais ações" }))
    // Pelo teclado: a seta abre o submenu e o Enter escolhe o produto.
    ;(await screen.findByRole("menuitem", { name: "Acabou…" })).focus()
    await usuario.keyboard("{ArrowRight}")
    ;(await screen.findByRole("menuitem", { name: produto.nome })).focus()
    await usuario.keyboard("{Enter}")
    expect(
      await screen.findByText(`${produto.nome} acabou e saiu do cardápio.`),
    ).toBeInTheDocument()
    await waitFor(async () => expect(await disponivel()).toBe(false))

    await usuario.click(await screen.findByRole("button", { name: "Desfazer" }))
    await waitFor(async () => expect(await disponivel()).toBe(true))
  })

  test("avisar o salão: a mensagem vai para o pedido e o ticket mostra até alguém dar Ok", async () => {
    telaGrande()
    const { comanda } = await comandaNaMesa(64)
    const usuario = userEvent.setup()
    renderizar()
    const pendentes = async () =>
      ((await api().pedidos.buscar(comanda.id))?.mensagensCozinha ?? []).filter(
        (mensagem) => !mensagem.vistaEm,
      )

    await usuario.click(within(await ticket("Mesa 64")).getByRole("button", { name: "Mais ações" }))
    ;(await screen.findByRole("menuitem", { name: "Avisar o salão…" })).focus()
    await usuario.keyboard("{ArrowRight}")
    ;(await screen.findByRole("menuitem", { name: "Vai atrasar ~10 min" })).focus()
    await usuario.keyboard("{Enter}")

    expect(
      await within(await ticket("Mesa 64")).findByText("Avisado: vai atrasar ~10 min"),
    ).toBeInTheDocument()
    await waitFor(async () => expect((await pendentes()).map((m) => m.tipo)).toEqual(["atraso"]))
  })

  test("entrega e retirada avisam o caixa", async () => {
    telaGrande()
    const retirada = await api().pdv.finalizar({
      itens: [{ avulso: { nome: "Batata", preco: 12 }, quantidade: 1 }],
      pagamento: "pix",
      desconto: { modo: "reais", valor: 0 },
      concluida: false,
    })
    const usuario = userEvent.setup()
    renderizar()
    const doTicket = await screen.findByRole("article", { name: `Retirada · #${retirada.numero}` })
    await usuario.click(within(doTicket).getByRole("button", { name: "Mais ações" }))
    expect(await screen.findByRole("menuitem", { name: "Avisar o caixa…" })).toBeInTheDocument()
  })

  test("filtro Entrega deixa só entrega, sem retirada nem mesa", async () => {
    telaGrande()
    await comandaNaMesa(52)
    const usuario = userEvent.setup()
    renderizar()
    await ticket("Mesa 52")

    await usuario.click(screen.getByRole("radio", { name: "Entrega" }))
    expect(screen.queryByRole("article", { name: /^Mesa/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("article", { name: /^Retirada/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole("article", { name: /^Entrega ·/ }).length).toBeGreaterThan(0)
  })

  test("rodada nova chega sozinha e toca o alerta", async () => {
    telaGrande()
    const tocar = vi.fn()
    vi.stubGlobal(
      "AudioContext",
      class {
        currentTime = 0
        destination = {}
        state = "running"
        createOscillator() {
          tocar()
          return {
            type: "sine",
            frequency: { setValueAtTime: () => {} },
            connect: (no: unknown) => no,
            start: () => {},
            stop: () => {},
          }
        }
        createGain() {
          return {
            gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
            connect: (no: unknown) => no,
          }
        }
        resume() {}
      },
    )
    usePreferenciasFila.setState({ somLigado: true })
    renderizar(200)
    await coluna("A fazer")

    await comandaNaMesa(53)
    expect(await ticket("Mesa 53")).toBeInTheDocument()
    expect(tocar).toHaveBeenCalled()
  })

  test("cada coluna marca a etapa com o traço do tom e a contagem", async () => {
    telaGrande()
    await comandaNaMesa(54)
    renderizar()
    await ticket("Mesa 54")

    for (const [nome, tom] of [
      ["A fazer", "novo"],
      ["Preparando", "preparo"],
      ["Prontos", "pronto"],
    ]) {
      const titulo = (await coluna(nome)).getByRole("heading", { name: new RegExp(`^${nome}`) })
      expect(titulo.querySelector("[data-traco]")).toHaveAttribute("data-tom", tom)
    }
  })

  test("coluna vazia ensina o que chega nela", async () => {
    telaGrande()
    await comandaNaMesa(55)
    // Uma hora depois, os prontos da demonstração já saíram da tela.
    vi.setSystemTime(new Date(2026, 10, 13, 21, 30))
    renderizar()
    await ticket("Mesa 55")

    expect(
      (await coluna("Prontos")).getByText("Marque um ticket como pronto e ele vem para cá."),
    ).toBeInTheDocument()
  })

  test("ticket atrasado mostra o atraso no tempo, sem borda grossa", async () => {
    telaGrande()
    await comandaNaMesa(56)
    vi.setSystemTime(new Date(2026, 10, 13, 21, 0))
    renderizar()

    const atrasado = await ticket("Mesa 56")
    expect(atrasado).toHaveAttribute("data-urgencia", "atrasado")
    expect(within(atrasado).getByText(/30 min/)).toHaveTextContent("30 min, atrasado")
    expect(atrasado.innerHTML).not.toMatch(/border-l-4/)
  })

  test("tela cheia para a TV da cozinha", async () => {
    telaGrande()
    const cheia = vi.fn(async () => {})
    HTMLElement.prototype.requestFullscreen = cheia
    const usuario = userEvent.setup()
    renderizar()
    await coluna("A fazer")

    await usuario.click(screen.getByRole("button", { name: "Tela cheia" }))
    expect(cheia).toHaveBeenCalled()
  })
})

describe("PaginaCozinha: ajustes", () => {
  test("os tempos da loja, salvos na aba Ajustes, mudam o atraso no quadro", async () => {
    telaGrande()
    await comandaNaMesa(57)
    vi.setSystemTime(new Date(2026, 10, 13, 20, 36))
    const usuario = userEvent.setup()
    renderizar()
    expect(await ticket("Mesa 57")).toHaveAttribute("data-urgencia", "normal")

    await usuario.click(screen.getByRole("tab", { name: "Ajustes" }))
    const tempos = within(await screen.findByRole("region", { name: "Tempos da cozinha" }))
    expect(tempos.getByRole("link", { name: "Tempos de entrega e retirada" })).toHaveAttribute(
      "href",
      "/admin/loja",
    )
    const atencao = tempos.getByRole("spinbutton", { name: "Atenção a partir de" })
    const atraso = tempos.getByRole("spinbutton", { name: "Atraso a partir de" })
    await usuario.clear(atencao)
    await usuario.type(atencao, "3")
    await usuario.clear(atraso)
    await usuario.type(atraso, "2")
    await usuario.click(tempos.getByRole("button", { name: "Salvar tempos" }))
    expect(await tempos.findByText("O atraso precisa vir depois da atenção.")).toBeInTheDocument()

    await usuario.clear(atraso)
    await usuario.type(atraso, "5")
    await usuario.click(tempos.getByRole("button", { name: "Salvar tempos" }))
    expect(await screen.findByText("Tempos da cozinha salvos.")).toBeInTheDocument()
    expect((await api().loja()).temposCozinha).toEqual({
      atencaoMin: 3,
      atrasoMin: 5,
      prontoFicaMin: 15,
    })

    await usuario.click(screen.getByRole("tab", { name: "Quadro" }))
    expect(await ticket("Mesa 57")).toHaveAttribute("data-urgencia", "atrasado")
  })
})

describe("PaginaCozinha: sons", () => {
  test("Ajustes: cada evento tem a sua chave, e ligar toca o som para ouvir", async () => {
    const audio = simularAudio()
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("tab", { name: "Ajustes" }))
    const sons = within(await screen.findByRole("region", { name: "Sons deste aparelho" }))

    expect(sons.getByRole("switch", { name: "Pedido ou rodada nova" })).toBeChecked()
    expect(sons.getByRole("switch", { name: "Repetir o alerta de novo" })).not.toBeChecked()
    await usuario.click(sons.getByRole("switch", { name: "Ticket atrasado" }))
    expect(usePreferenciasFila.getState().sons.atrasado).toBe(false)

    await usuario.click(sons.getByRole("switch", { name: "Ticket atrasado" }))
    expect(usePreferenciasFila.getState().sons.atrasado).toBe(true)
    expect(audio.atrasado()).toBe(1)
  })

  beforeEach(() => {
    telaGrande()
    usePreferenciasFila.setState({ somLigado: true })
  })

  test("com a chave de novo desligada, a rodada nova chega sem tocar", async () => {
    const audio = simularAudio()
    usePreferenciasFila.getState().ligarSomDoEvento("novo", false)
    renderizar(200, 60_000)
    await coluna("A fazer")

    await comandaNaMesa(70)
    expect(await ticket("Mesa 70")).toBeInTheDocument()
    expect(audio.novo()).toBe(0)
  })

  test("o cancelado toca o alarme até alguém dar Ciente", async () => {
    const audio = simularAudio()
    const { comanda } = await comandaNaMesa(71)
    await api().pedidos.cancelar(comanda.id, "recebido")
    const usuario = userEvent.setup()
    renderizar(60_000, 50)

    const cancelado = within(await ticket("Mesa 71"))
    await waitFor(() => expect(audio.cancelado()).toBeGreaterThanOrEqual(2))
    await usuario.click(cancelado.getByRole("button", { name: "Ciente" }))
    await waitFor(() => expect(screen.queryByRole("article", { name: /^Mesa 71 ·/ })).toBeNull())
    const depoisDoCiente = audio.cancelado()
    await esperar(300)
    expect(audio.cancelado()).toBe(depoisDoCiente)
  })

  test("o ticket que passa do atraso toca um toque curto, uma vez", async () => {
    const audio = simularAudio()
    await comandaNaMesa(72)
    renderizar(60_000, 50)
    await ticket("Mesa 72")
    await esperar(150)
    expect(audio.atrasado()).toBe(0)

    vi.setSystemTime(new Date(2026, 10, 13, 20, 56))
    await waitFor(() => expect(audio.atrasado()).toBeGreaterThan(0))
    const tocou = audio.atrasado()
    await esperar(300)
    expect(audio.atrasado()).toBe(tocou)
  })

  test("repetir: o alerta de novo volta enquanto houver ticket em A fazer", async () => {
    const audio = simularAudio()
    await comandaNaMesa(73)
    renderizar(60_000, 50)
    await ticket("Mesa 73")
    expect(audio.novo()).toBe(0)

    act(() => usePreferenciasFila.getState().ligarSomDoEvento("repetirNovo", true))
    await waitFor(() => expect(audio.novo()).toBeGreaterThanOrEqual(2), { timeout: 3000 })
  })
})

/** Venda do balcão que vai para a fila, agendada ou não. */
const retiradaDoBalcao = (agendadoPara?: string) =>
  api().pdv.finalizar({
    itens: [{ avulso: { nome: "Batata", preco: 12 }, quantidade: 1 }],
    pagamento: "pix",
    desconto: { modo: "reais", valor: 0 },
    concluida: false,
    ...(agendadoPara ? { agendadoPara } : {}),
  })

describe("PaginaCozinha: tempo", () => {
  test("o agendado espera em Mais tarde, e Iniciar agora leva para Preparando", async () => {
    telaGrande()
    const pedido = await retiradaDoBalcao(new Date(2026, 10, 13, 22, 0).toISOString())
    const usuario = userEvent.setup()
    renderizar()

    const maisTarde = within(await screen.findByRole("region", { name: /^Mais tarde, / }))
    const linha = within(maisTarde.getByRole("listitem", { name: `Retirada · #${pedido.numero}` }))
    // A pizzaria leva 20 minutos para preparar (o mínimo da retirada).
    expect(linha.getByText("22:00")).toBeInTheDocument()
    expect(linha.getByText("começa 21:40")).toBeInTheDocument()
    expect(
      (await coluna("A fazer")).queryByRole("article", { name: `Retirada · #${pedido.numero}` }),
    ).not.toBeInTheDocument()

    await usuario.click(linha.getByRole("button", { name: "Iniciar agora" }))
    expect(
      await (await coluna("Preparando")).findByRole("article", {
        name: `Retirada · #${pedido.numero}`,
      }),
    ).toBeInTheDocument()
  })

  test("o agendado toca o alerta de novo quando chega a hora de começar", async () => {
    telaGrande()
    usePreferenciasFila.setState({ somLigado: true })
    const audio = simularAudio()
    const pedido = await retiradaDoBalcao(new Date(2026, 10, 13, 22, 0).toISOString())
    renderizar(60_000, 50)
    await screen.findByRole("listitem", { name: `Retirada · #${pedido.numero}` })
    await esperar(150)
    expect(audio.novo()).toBe(0)

    vi.setSystemTime(new Date(2026, 10, 13, 21, 41))
    await waitFor(() => expect(audio.novo()).toBe(1))
  })

  test("o ticket de entrega e de retirada mostra até quando o cliente espera", async () => {
    telaGrande()
    vi.setSystemTime(new Date(2026, 10, 13, 19, 55))
    const atrasada = await retiradaDoBalcao()
    vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
    const nova = await retiradaDoBalcao()
    renderizar()

    // A retirada da pizzaria leva até 30 minutos.
    const daNova = within(
      await screen.findByRole("article", { name: `Retirada · #${nova.numero}` }),
    )
    expect(daNova.getByText("até 21:00 · faltam 30 min")).toBeInTheDocument()
    const daAtrasada = within(
      await screen.findByRole("article", { name: `Retirada · #${atrasada.numero}` }),
    )
    expect(daAtrasada.getByText("até 20:25 · passou 5 min")).toBeInTheDocument()
  })
})

describe("PaginaCozinha: praças", () => {
  async function abrirPracas() {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("tab", { name: "Ajustes" }))
    const pracas = within(await screen.findByRole("region", { name: "Praças" }))
    return { usuario, pracas }
  }

  test("a demo vem com as praças, e uma praça nova pega a categoria que ficou livre", async () => {
    const { usuario, pracas } = await abrirPracas()
    expect(
      (await pracas.findAllByRole("listitem")).map((linha) => linha.getAttribute("aria-label")),
    ).toEqual(["Forno", "Montagem", "Bebidas"])

    await usuario.click(pracas.getByRole("button", { name: "Editar Montagem" }))
    let janela = within(await screen.findByRole("dialog", { name: "Editar praça" }))
    await usuario.click(janela.getByRole("checkbox", { name: "Sobremesas" }))
    await usuario.click(janela.getByRole("button", { name: "Salvar praça" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    await usuario.click(pracas.getByRole("button", { name: "Nova praça" }))
    janela = within(await screen.findByRole("dialog", { name: "Nova praça" }))
    // A categoria que já está em outra praça não pode ser marcada aqui.
    expect(janela.getByRole("checkbox", { name: "Bebidas" })).toBeDisabled()
    await usuario.click(janela.getByRole("button", { name: "Salvar praça" }))
    expect(await janela.findByText("Informe o nome da praça.")).toBeInTheDocument()

    await usuario.type(janela.getByRole("textbox", { name: "Nome" }), "Doces")
    await usuario.click(janela.getByRole("radio", { name: "Rosa" }))
    await usuario.click(janela.getByRole("checkbox", { name: "Sobremesas" }))
    await usuario.click(janela.getByRole("switch", { name: "Imprime a via" }))
    await usuario.click(janela.getByRole("button", { name: "Salvar praça" }))

    await waitFor(async () =>
      expect((await api().loja()).pracas?.at(-1)).toMatchObject({
        nome: "Doces",
        cor: "rosa",
        categoriaIds: ["cat-sobremesas"],
        imprime: false,
        tocaSom: true,
      }),
    )
    expect(pracas.getByRole("listitem", { name: "Doces" })).toBeInTheDocument()
  })

  test("excluir uma praça devolve as categorias dela para Geral", async () => {
    const { usuario, pracas } = await abrirPracas()
    await usuario.click(await pracas.findByRole("button", { name: "Editar Bebidas" }))
    const janela = within(await screen.findByRole("dialog", { name: "Editar praça" }))
    await usuario.click(janela.getByRole("button", { name: "Excluir praça" }))
    await waitFor(async () =>
      expect((await api().loja()).pracas?.map((praca) => praca.nome)).toEqual([
        "Forno",
        "Montagem",
      ]),
    )
  })
})

describe("PaginaCozinha: quadro de uma praça", () => {
  /** Mesa 80 com uma pizza (Forno) e uma massa (Montagem), sem opções. */
  async function mesaComDuasPracas() {
    const lista = await api().produtos.listar()
    const daCategoria = (categoriaId: string) =>
      lista.find(
        (produto) =>
          produto.categoriaId === categoriaId && produto.grupos.length === 0 && produto.disponivel,
      ) as Produto
    const pizza = daCategoria("cat-calzones")
    const massa = daCategoria("cat-massas")
    const mesa = await api().mesas.criar({ numero: 80 })
    await api().mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [
        { produtoId: pizza.id, escolhas: {}, quantidade: 1 },
        { produtoId: massa.id, escolhas: {}, quantidade: 1 },
      ],
    })
    return { pizza, massa }
  }

  async function escolherPraca(usuario: ReturnType<typeof userEvent.setup>, nome: string) {
    await usuario.click(await screen.findByRole("combobox", { name: "Praça" }))
    await usuario.click(await screen.findByRole("option", { name: nome }))
  }

  test("cada praça vê a sua parte; a última a terminar manda o ticket para Prontos", async () => {
    telaGrande()
    const { pizza, massa } = await mesaComDuasPracas()
    const usuario = userEvent.setup()
    renderizar()
    await ticket("Mesa 80")

    await escolherPraca(usuario, "Forno")
    let noForno = within(await ticket("Mesa 80"))
    expect(noForno.getByText(pizza.nome)).toBeInTheDocument()
    expect(noForno.queryByText(massa.nome)).not.toBeInTheDocument()
    expect(noForno.getByText("Falta: Montagem 1")).toBeInTheDocument()

    await usuario.click(noForno.getByRole("button", { name: "Iniciar preparo" }))
    noForno = within(
      await (await coluna("Preparando")).findByRole("article", { name: /^Mesa 80 ·/ }),
    )
    await usuario.click(noForno.getByRole("button", { name: "Marcar pronto · Forno" }))
    const pronto = within(
      await (await coluna("Prontos")).findByRole("article", { name: /^Mesa 80 ·/ }),
    )
    expect(pronto.getByText("Aguardando Montagem")).toBeInTheDocument()

    await escolherPraca(usuario, "Montagem")
    const naMontagem = within(
      await (await coluna("Preparando")).findByRole("article", { name: /^Mesa 80 ·/ }),
    )
    await usuario.click(naMontagem.getByRole("button", { name: "Marcar pronto · Montagem" }))

    await escolherPraca(usuario, "Todas")
    expect(
      await (await coluna("Prontos")).findByRole("article", { name: /^Mesa 80 ·/ }),
    ).toBeInTheDocument()
    expect(usePreferenciasFila.getState().praca).toBe("todas")
  })

  test("o aparelho da praça só toca para o que é dela, e fica quieto se a praça não toca", async () => {
    telaGrande()
    const audio = simularAudio()
    usePreferenciasFila.setState({ somLigado: true, praca: "praca-forno" })
    renderizar(200, 60_000)
    await coluna("A fazer")
    const lista = await api().produtos.listar()
    const daCategoria = (categoriaId: string) =>
      lista.find(
        (produto) =>
          produto.categoriaId === categoriaId && produto.grupos.length === 0 && produto.disponivel,
      ) as Produto
    const lancar = async (numero: number, categoriaId: string) => {
      const mesa = await api().mesas.criar({ numero })
      await api().mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: true,
        itens: [{ produtoId: daCategoria(categoriaId).id, escolhas: {}, quantidade: 1 }],
      })
    }

    // Só massa: é da Montagem, o Forno não toca.
    await lancar(81, "cat-massas")
    await esperar(600)
    expect(audio.novo()).toBe(0)
    await lancar(82, "cat-calzones")
    await waitFor(() => expect(audio.novo()).toBe(1))

    const pracas = (await api().loja()).pracas ?? []
    await api().salvarPracas(
      pracas.map((praca) => (praca.id === "praca-forno" ? { ...praca, tocaSom: false } : praca)),
    )
    cleanup()
    renderizar(200, 60_000)
    await ticket("Mesa 82")
    await lancar(83, "cat-calzones")
    expect(await ticket("Mesa 83")).toBeInTheDocument()
    await esperar(400)
    expect(audio.novo()).toBe(1)
  })
})

describe("PaginaCozinha: vias da cozinha", () => {
  async function lancarNaMesa(numero: number, categorias: string[]) {
    const lista = await api().produtos.listar()
    const itens = categorias.map((categoriaId) => {
      const produto = lista.find(
        (item) => item.categoriaId === categoriaId && item.grupos.length === 0 && item.disponivel,
      ) as Produto
      return { produtoId: produto.id, escolhas: {}, quantidade: 1 }
    })
    const mesa = await api().mesas.criar({ numero })
    return api().mesas.lancar({ mesaId: mesa.id, enviarParaCozinha: true, itens })
  }

  test("com as vias ligadas, a rodada nova imprime a via de cada praça que imprime", async () => {
    telaGrande()
    usePreferenciasFila.setState({ imprimirVias: true })
    renderizar(200)
    await coluna("A fazer")
    await esperar(400)
    // O que já estava na tela não sai de novo.
    expect(impressas).toEqual([])

    const comanda = await lancarNaMesa(84, ["cat-calzones", "cat-massas", "cat-bebidas"])
    await waitFor(() => expect(impressas).toHaveLength(2))
    expect(impressas[0]).toMatch(/^Mesa 84 · FORNO/)
    expect(impressas[0]).not.toMatch(/R$/)
    expect(impressas[1]).toMatch(/^Mesa 84 · MONTAGEM/)
    expect((await api().pedidos.buscar(comanda.id))?.viasImpressas).toEqual([
      "1:praca-forno",
      "1:praca-montagem",
    ])
  })

  test("sem o Pro da via, a chave ligada no aparelho não imprime sozinha", async () => {
    useConfig.setState({ pro: false, compradas: [] })
    telaGrande()
    usePreferenciasFila.setState({ imprimirVias: true })
    renderizar(200)
    await coluna("A fazer")
    await esperar(400)
    await lancarNaMesa(86, ["cat-calzones"])
    await ticket("Mesa 86")
    await esperar(600)
    expect(impressas).toEqual([])
  })

  test("sem a chave do aparelho, nada sai; Reimprimir via imprime a da praça na hora", async () => {
    telaGrande()
    await lancarNaMesa(85, ["cat-calzones", "cat-massas"])
    usePreferenciasFila.setState({ praca: "praca-montagem" })
    const usuario = userEvent.setup()
    renderizar()
    const doTicket = within(await ticket("Mesa 85"))
    await esperar(300)
    expect(impressas).toEqual([])

    await usuario.click(doTicket.getByRole("button", { name: "Mais ações" }))
    await usuario.click(await screen.findByRole("menuitem", { name: "Reimprimir via" }))
    await waitFor(() => expect(impressas).toHaveLength(1))
    expect(impressas[0]).toMatch(/^Mesa 85 · MONTAGEM/)
  })

  test("Ajustes: a chave deste aparelho e, sem praças, a via da cozinha da loja", async () => {
    await api().salvarPracas([])
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("tab", { name: "Ajustes" }))
    const vias = within(await screen.findByRole("region", { name: "Vias da cozinha" }))
    await usuario.click(vias.getByRole("switch", { name: "Imprimir as vias neste aparelho" }))
    expect(usePreferenciasFila.getState().imprimirVias).toBe(true)
    await usuario.click(await vias.findByRole("switch", { name: "Imprimir a via da cozinha" }))
    await waitFor(async () => expect((await api().loja()).viaDaCozinha).toBe(true))
  })
})

describe("PaginaCozinha: resumo de produção", () => {
  /** Mesa nova com um item avulso para a cozinha: o nome não se repete na demo. */
  async function mesaComAvulso(numero: number, nome: string, quantidade: number) {
    const mesa = await api().mesas.criar({ numero })
    await api().mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [{ avulso: { nome, preco: 20 }, quantidade }],
    })
  }

  test("no desktop, o painel soma o que falta e o produto tocado destaca os tickets dele", async () => {
    telaGrande()
    await mesaComAvulso(90, "Porção da casa", 2)
    await mesaComAvulso(91, "Porção da casa", 3)
    await mesaComAvulso(92, "Caldo verde", 1)
    const usuario = userEvent.setup()
    renderizar()
    await ticket("Mesa 92")

    await usuario.click(screen.getByRole("button", { name: /^Em produção/ }))
    const painel = within(await screen.findByRole("complementary", { name: "Resumo de produção" }))
    const porcao = painel.getByRole("button", { name: "5× Porção da casa" })
    expect(porcao).toHaveAttribute("aria-pressed", "false")

    await usuario.click(porcao)
    expect(porcao).toHaveAttribute("aria-pressed", "true")
    expect(await ticket("Mesa 90")).not.toHaveAttribute("data-apagado")
    expect(await ticket("Mesa 91")).not.toHaveAttribute("data-apagado")
    expect(await ticket("Mesa 92")).toHaveAttribute("data-apagado")

    // Tocar de novo tira o destaque.
    await usuario.click(porcao)
    expect(await ticket("Mesa 92")).not.toHaveAttribute("data-apagado")
  })

  test("Acabou tira o produto do cardápio; em Esgotados, Voltou devolve", async () => {
    telaGrande()
    const { produto } = await comandaNaMesa(93)
    const usuario = userEvent.setup()
    renderizar()
    await ticket("Mesa 93")
    const disponivel = async () =>
      (await api().produtos.listar()).find((item) => item.id === produto.id)?.disponivel

    await usuario.click(screen.getByRole("button", { name: /^Em produção/ }))
    const painel = within(await screen.findByRole("complementary", { name: "Resumo de produção" }))
    await usuario.click(painel.getByRole("button", { name: `Acabou: ${produto.nome}` }))
    expect(
      await screen.findByText(`${produto.nome} acabou e saiu do cardápio.`),
    ).toBeInTheDocument()
    await waitFor(async () => expect(await disponivel()).toBe(false))
    // Esgotado, a linha não oferece mais o Acabou.
    expect(
      painel.queryByRole("button", { name: `Acabou: ${produto.nome}` }),
    ).not.toBeInTheDocument()

    await usuario.click(painel.getByRole("tab", { name: /^Esgotados/ }))
    await usuario.click(await painel.findByRole("button", { name: `Voltou: ${produto.nome}` }))
    expect(await screen.findByText(`${produto.nome} voltou ao cardápio.`)).toBeInTheDocument()
    await waitFor(async () => expect(await disponivel()).toBe(true))
  })

  test("no celular, a gaveta mostra o resumo; tocar num produto fecha e destaca os tickets dele", async () => {
    await mesaComAvulso(94, "Porção da casa", 4)
    await mesaComAvulso(95, "Caldo verde", 1)
    const usuario = userEvent.setup()
    renderizar()
    await ticket("Mesa 94")

    await usuario.click(screen.getByRole("button", { name: /^Em produção/ }))
    const janela = await screen.findByRole("dialog", { name: "Em produção" })
    await usuario.click(within(janela).getByRole("button", { name: "4× Porção da casa" }))

    // A gaveta fecha. No jsdom, o vaul a deixa no DOM (e o quadro escondido dos leitores)
    // esperando o fim de uma animação que não acontece: os tickets são buscados assim mesmo.
    await waitFor(() => expect(janela).toHaveAttribute("data-state", "closed"))
    const doQuadro = (nome: string) =>
      screen.findByRole("article", { name: new RegExp(`^${nome} ·`), hidden: true })
    expect(await doQuadro("Mesa 94")).not.toHaveAttribute("data-apagado")
    expect(await doQuadro("Mesa 95")).toHaveAttribute("data-apagado")
  })
})

describe("PaginaCozinha: exibição", () => {
  test("A+ e A− mudam o tamanho do quadro e param nas pontas; fica guardado no aparelho", async () => {
    telaGrande()
    await comandaNaMesa(96)
    const usuario = userEvent.setup()
    renderizar()
    await ticket("Mesa 96")
    const quadro = () => screen.getByRole("region", { name: /^A fazer/ }).closest("[data-tamanho]")
    expect(quadro()).toHaveAttribute("data-tamanho", "1")

    await usuario.click(screen.getByRole("button", { name: "Exibição" }))
    const aumentar = await screen.findByRole("button", { name: "Aumentar o quadro" })
    await usuario.click(aumentar)
    await usuario.click(aumentar)
    expect(aumentar).toBeDisabled()
    expect(quadro()).toHaveAttribute("data-tamanho", "3")
    expect(usePreferenciasFila.getState().tamanho).toBe(3)

    const diminuir = screen.getByRole("button", { name: "Diminuir o quadro" })
    for (const _ of [1, 2, 3]) await usuario.click(diminuir)
    expect(diminuir).toBeDisabled()
    expect(quadro()).toHaveAttribute("data-tamanho", "0")
  })

  test("Compacto esconde o cliente e o garçom do ticket", async () => {
    telaGrande()
    await comandaNaMesa(97)
    const usuario = userEvent.setup()
    renderizar()
    expect(within(await ticket("Mesa 97")).getByText("Garçom: Rafa")).toBeInTheDocument()

    await usuario.click(screen.getByRole("button", { name: "Exibição" }))
    await usuario.click(await screen.findByRole("switch", { name: "Compacto" }))
    expect(within(await ticket("Mesa 97")).queryByText("Garçom: Rafa")).not.toBeInTheDocument()
    expect(usePreferenciasFila.getState().compacto).toBe(true)
  })
})

describe("PaginaCozinha: atalhos do teclado", () => {
  test("as setas movem o foco entre os tickets", async () => {
    telaGrande()
    await comandaNaMesa(98)
    const usuario = userEvent.setup()
    renderizar()
    await ticket("Mesa 98")
    const aFazer = (await coluna("A fazer")).getAllByRole("article")

    await usuario.keyboard("{ArrowDown}")
    expect(aFazer[0]).toHaveFocus()
    await usuario.keyboard("{ArrowDown}")
    expect(aFazer[1]).toHaveFocus()
    await usuario.keyboard("{ArrowUp}")
    expect(aFazer[0]).toHaveFocus()
    await usuario.keyboard("{ArrowRight}")
    expect((await coluna("Preparando")).getAllByRole("article")[0]).toHaveFocus()
  })

  test("Enter avança o ticket em foco, e o foco vai junto", async () => {
    telaGrande()
    await comandaNaMesa(99)
    const usuario = userEvent.setup()
    renderizar()
    const alvo = await ticket("Mesa 99")
    act(() => alvo.focus())

    await usuario.keyboard("{Enter}")
    const preparando = await coluna("Preparando")
    const movido = await preparando.findByRole("article", { name: /^Mesa 99 ·/ })
    await waitFor(() => expect(movido).toHaveFocus())
  })

  test("na praça, Enter no ticket em preparo marca pronto só a parte dela", async () => {
    telaGrande()
    const lista = await api().produtos.listar()
    const daCategoria = (categoriaId: string) =>
      lista.find(
        (produto) =>
          produto.categoriaId === categoriaId && produto.grupos.length === 0 && produto.disponivel,
      ) as Produto
    const mesa = await api().mesas.criar({ numero: 81 })
    const comanda = await api().mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [
        { produtoId: daCategoria("cat-calzones").id, escolhas: {}, quantidade: 1 },
        { produtoId: daCategoria("cat-massas").id, escolhas: {}, quantidade: 1 },
      ],
    })
    await api().cozinha.avancar(comanda.id, 1, "recebido")
    usePreferenciasFila.setState({ praca: "praca-forno" })
    const usuario = userEvent.setup()
    renderizar()
    const alvo = await (await coluna("Preparando")).findByRole("article", { name: /^Mesa 81 ·/ })
    act(() => alvo.focus())

    await usuario.keyboard("{Enter}")
    const pronto = within(
      await (await coluna("Prontos")).findByRole("article", { name: /^Mesa 81 ·/ }),
    )
    expect(pronto.getByText("Aguardando Montagem")).toBeInTheDocument()
  })

  test("P liga e desliga a prioridade do ticket em foco", async () => {
    telaGrande()
    const { comanda } = await comandaNaMesa(83)
    const usuario = userEvent.setup()
    renderizar()
    const alvo = await ticket("Mesa 83")
    act(() => alvo.focus())
    const prioridade = async () => (await api().pedidos.buscar(comanda.id))?.prioridade

    await usuario.keyboard("p")
    await waitFor(async () => expect(await prioridade()).toBe(true))
    act(() => screen.getByRole("article", { name: /^Mesa 83 ·/ }).focus())
    await usuario.keyboard("p")
    await waitFor(async () => expect(await prioridade()).toBe(false))
  })

  test("os números riscam o item da linha; o número sem item não faz nada", async () => {
    telaGrande()
    const { comanda } = await comandaNaMesa(84)
    const usuario = userEvent.setup()
    renderizar()
    const alvo = await ticket("Mesa 84")
    act(() => alvo.focus())
    const feito = async () => Boolean((await api().pedidos.buscar(comanda.id))?.itens[0].feitoEm)

    await usuario.keyboard("2")
    expect(await feito()).toBe(false)
    await usuario.keyboard("1")
    await waitFor(async () => expect(await feito()).toBe(true))
  })

  test("no ticket cancelado, o número fica quieto, como o item travado no clique", async () => {
    telaGrande()
    const { comanda } = await comandaNaMesa(85)
    await api().pedidos.cancelar(comanda.id, "recebido")
    const usuario = userEvent.setup()
    renderizar()
    const alvo = await ticket("Mesa 85")
    act(() => alvo.focus())

    await usuario.keyboard("1")
    await esperar(300)
    expect((await api().pedidos.buscar(comanda.id))?.itens[0].feitoEm).toBeUndefined()
    // Nem tenta: o servidor recusaria com um aviso de erro.
    expect(screen.queryByText("Este pedido foi cancelado.")).not.toBeInTheDocument()
  })

  test("Z desfaz a última ação que tinha Desfazer", async () => {
    telaGrande()
    await comandaNaMesa(86)
    const usuario = userEvent.setup()
    renderizar()
    const alvo = await ticket("Mesa 86")
    const antes = await contagem("A fazer")
    act(() => alvo.focus())

    await usuario.keyboard("{Enter}")
    await screen.findByText(/^Mesa 86 · #\d+ foi para Preparando\.$/)
    await waitFor(async () => expect(await contagem("A fazer")).toBe(antes - 1))
    // A contagem vem dos dados: o ticket que sai ainda fica um instante na coluna, animando.
    await usuario.keyboard("z")
    await waitFor(async () => expect(await contagem("A fazer")).toBe(antes))
  })

  test("? abre a lista de atalhos", async () => {
    telaGrande()
    await comandaNaMesa(87)
    const usuario = userEvent.setup()
    renderizar()
    await ticket("Mesa 87")

    await usuario.keyboard("?")
    const lista = within(await screen.findByRole("dialog", { name: "Atalhos do teclado" }))
    for (const atalho of ["Enter", "P", "1 a 9", "Z", "?"]) {
      expect(lista.getByText(atalho, { selector: "kbd" })).toBeInTheDocument()
    }
  })

  test("com o menu do ticket aberto, as setas são do menu", async () => {
    telaGrande()
    await comandaNaMesa(88)
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(within(await ticket("Mesa 88")).getByRole("button", { name: "Mais ações" }))
    await screen.findByRole("menu")

    await usuario.keyboard("{ArrowDown}")
    expect(document.activeElement?.closest("[role=menu]")).not.toBeNull()
  })

  test("no celular, as teclas não fazem nada no quadro", async () => {
    await comandaNaMesa(89)
    const usuario = userEvent.setup()
    renderizar()
    await ticket("Mesa 89")

    await usuario.keyboard("{ArrowDown}")
    expect(document.activeElement?.closest("[data-ticket]")).toBeNull()
    await usuario.keyboard("?")
    expect(screen.queryByRole("dialog", { name: "Atalhos do teclado" })).not.toBeInTheDocument()
  })
})

describe("PaginaCozinha: refazer", () => {
  /** Mesa com a rodada já pronta na cozinha. */
  async function mesaPronta(numero: number) {
    const { produto, comanda } = await comandaNaMesa(numero, 2)
    await api().cozinha.avancar(comanda.id, 1, "recebido")
    const pronta = await api().cozinha.avancar(comanda.id, 1, "em-preparo")
    return { produto, comanda: pronta }
  }

  test("o refazer entra no topo de A fazer, marcado com o motivo, e anda como os outros", async () => {
    telaGrande()
    const { comanda } = await mesaPronta(71)
    await api().cozinha.refazer(comanda.id, {
      rodada: 1,
      itens: [{ itemId: comanda.itens[0].id, quantidade: 1 }],
      motivo: "caiu",
    })
    const usuario = userEvent.setup()
    renderizar()

    const aFazer = await coluna("A fazer")
    const [primeiro] = aFazer.getAllByRole("article")
    expect(primeiro).toHaveAccessibleName(/^Mesa 71 · #\d+ · refazer$/)
    expect(within(primeiro).getByText("Refazer · Caiu")).toBeInTheDocument()

    await usuario.click(within(primeiro).getByRole("button", { name: "Iniciar preparo" }))
    await waitFor(async () =>
      expect(
        (await api().pedidos.buscar(comanda.id))?.refacoes?.[0].itens[0].iniciadoEm,
      ).toBeDefined(),
    )

    // O menu volta o refazer para A fazer, como os outros.
    const preparando = await (await coluna("Preparando")).findByRole("article", {
      name: /^Mesa 71 · #\d+ · refazer$/,
    })
    await usuario.click(within(preparando).getByRole("button", { name: "Mais ações" }))
    await usuario.click(await screen.findByRole("menuitem", { name: "Voltar para A fazer" }))
    await waitFor(async () =>
      expect(
        (await api().pedidos.buscar(comanda.id))?.refacoes?.[0].itens[0].iniciadoEm,
      ).toBeUndefined(),
    )
  })

  test("Refazer… no ticket pronto: escolhe itens, quantidade e motivo, e o refazer vai para A fazer", async () => {
    telaGrande()
    const { produto, comanda } = await mesaPronta(72)
    const usuario = userEvent.setup()
    renderizar()
    const pronto = await (await coluna("Prontos")).findByRole("article", { name: /^Mesa 72 ·/ })
    await usuario.click(within(pronto).getByRole("button", { name: "Mais ações" }))
    await usuario.click(await screen.findByRole("menuitem", { name: "Refazer…" }))

    const janela = within(await screen.findByRole("dialog", { name: /^Refazer Mesa 72/ }))
    expect(janela.getByRole("checkbox", { name: `2× ${produto.nome}` })).toBeChecked()
    const quantidade = janela.getByRole("spinbutton", { name: `Quantidade de ${produto.nome}` })
    expect(quantidade).toHaveValue(2)
    await usuario.click(janela.getByRole("button", { name: "Refazer" }))
    expect(await janela.findByText("Escolha o motivo.")).toBeInTheDocument()

    await usuario.clear(quantidade)
    await usuario.type(quantidade, "1")
    await usuario.click(janela.getByRole("radio", { name: "Caiu" }))
    await usuario.click(janela.getByRole("button", { name: "Refazer" }))

    expect(await screen.findByText(/^Mesa 72 · #\d+: refazer na cozinha\.$/)).toBeInTheDocument()
    await waitFor(async () =>
      expect((await api().pedidos.buscar(comanda.id))?.refacoes).toMatchObject([
        { motivo: "caiu", itens: [{ nome: produto.nome, quantidade: 1 }] },
      ]),
    )
    expect(
      await (await coluna("A fazer")).findByRole("article", { name: /^Mesa 72 · #\d+ · refazer$/ }),
    ).toBeInTheDocument()
  })
  test("na praça, o refazer fica pronto só na parte dela; o menu não tem Prioridade; a via diz REFAZER", async () => {
    telaGrande()
    const lista = await api().produtos.listar()
    const calzone = lista.find(
      (produto) =>
        produto.categoriaId === "cat-calzones" && produto.grupos.length === 0 && produto.disponivel,
    ) as Produto
    const mesa = await api().mesas.criar({ numero: 77 })
    const comanda = await api().mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [{ produtoId: calzone.id, escolhas: {}, quantidade: 1 }],
    })
    await api().cozinha.avancar(comanda.id, 1, "recebido")
    await api().cozinha.avancar(comanda.id, 1, "em-preparo")
    await api().cozinha.refazer(comanda.id, {
      rodada: 1,
      itens: [{ itemId: comanda.itens[0].id, quantidade: 1 }],
      motivo: "errado",
    })
    await api().cozinha.avancar(comanda.id, 1, "recebido", 1)
    usePreferenciasFila.setState({ praca: "praca-forno" })
    const usuario = userEvent.setup()
    renderizar()

    const refazer = await (await coluna("Preparando")).findByRole("article", {
      name: /^Mesa 77 · #\d+ · refazer$/,
    })
    await usuario.click(within(refazer).getByRole("button", { name: "Mais ações" }))
    expect(screen.queryByRole("menuitemcheckbox", { name: "Prioridade" })).not.toBeInTheDocument()
    await usuario.click(await screen.findByRole("menuitem", { name: "Reimprimir via" }))
    await waitFor(() => expect(impressas).toHaveLength(1))
    expect(impressas[0]).toContain("REFAZER")

    await usuario.click(within(refazer).getByRole("button", { name: "Marcar pronto · Forno" }))
    await waitFor(async () =>
      expect(
        (await api().pedidos.buscar(comanda.id))?.refacoes?.[0].itens[0].feitoEm,
      ).toBeDefined(),
    )
  })

  test("o atalho P não mexe na prioridade do pedido a partir do refazer", async () => {
    telaGrande()
    const { comanda } = await mesaPronta(78)
    await api().cozinha.refazer(comanda.id, {
      rodada: 1,
      itens: [{ itemId: comanda.itens[0].id, quantidade: 1 }],
      motivo: "caiu",
    })
    const usuario = userEvent.setup()
    renderizar()
    const [refeito] = (await coluna("A fazer")).getAllByRole("article")
    act(() => refeito.focus())
    await usuario.keyboard("p")
    await esperar(300)
    expect((await api().pedidos.buscar(comanda.id))?.prioridade).toBeFalsy()
  })

  test("o refazer da entrega que já saiu fica pronto e sai com Entregue", async () => {
    telaGrande()
    const [saiu] = await api().pedidos.listar({ status: ["saiu-para-entrega"] })
    const [item] = saiu.itens.filter((linha) => linha.vaiParaCozinha ?? saiu.enviarParaCozinha)
    await api().cozinha.refazer(saiu.id, {
      rodada: 1,
      itens: [{ itemId: item.id, quantidade: 1 }],
      motivo: "errado",
    })
    await api().cozinha.riscar(saiu.id, `${item.id}~r1`, true)
    const usuario = userEvent.setup()
    renderizar()

    const pronto = await (await coluna("Prontos")).findByRole("article", {
      name: new RegExp(`^Entrega · #${saiu.numero} · refazer$`),
    })
    await usuario.click(within(pronto).getByRole("button", { name: "Entregue" }))
    await waitFor(async () =>
      expect((await api().pedidos.buscar(saiu.id))?.refacoes?.[0].entregueEm).toBeDefined(),
    )
  })
})

describe("PaginaCozinha: histórico", () => {
  /** Mesa com a rodada pronta às 20:10 e servida às 20:15. */
  async function mesaServida(numero: number) {
    vi.setSystemTime(new Date(2026, 10, 13, 20, 0))
    const { comanda } = await comandaNaMesa(numero, 1)
    vi.setSystemTime(new Date(2026, 10, 13, 20, 2))
    await api().cozinha.avancar(comanda.id, 1, "recebido")
    vi.setSystemTime(new Date(2026, 10, 13, 20, 10))
    await api().cozinha.avancar(comanda.id, 1, "em-preparo")
    vi.setSystemTime(new Date(2026, 10, 13, 20, 15))
    await api().cozinha.servir(comanda.id, 1)
    vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
    return comanda
  }

  async function abrirHistorico(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.click(await screen.findByRole("tab", { name: "Histórico" }))
    await screen.findByRole("table", { name: "Histórico" }, { timeout: 8000 })
    // A tabela some enquanto a busca não acha nada: cada passo procura a de agora.
    return () => within(screen.getByRole("table", { name: "Histórico" }))
  }

  test("a lista de hoje acha pela busca, e a linha abre a linha do tempo", async () => {
    telaGrande()
    const comanda = await mesaServida(73)
    const usuario = userEvent.setup()
    renderizar()
    const tabela = await abrirHistorico(usuario)
    expect(tabela().getAllByRole("row").length).toBeGreaterThan(3)

    await usuario.type(screen.getByRole("searchbox", { name: "Buscar no histórico" }), "mesa 73")
    await waitFor(() => expect(tabela().getAllByRole("row")).toHaveLength(2))
    const linha = tabela().getByRole("row", { name: new RegExp(`Mesa 73 · #${comanda.numero}`) })
    expect(linha).toHaveTextContent("20:00")
    expect(linha).toHaveTextContent("10 min")
    expect(linha).toHaveTextContent("Servido")

    await usuario.click(within(linha).getByRole("button", { name: /^Mesa 73 · #/ }))
    const detalhe = within(
      await screen.findByRole("dialog", { name: `Mesa 73 · #${comanda.numero}` }),
    )
    const passos = within(detalhe.getByRole("list", { name: "Linha do tempo" }))
      .getAllByRole("listitem")
      .map((passo) => passo.textContent)
    expect(passos).toEqual([
      "Chegou20:00",
      "Iniciou20:022 min",
      "Pronto20:108 min",
      "Servido20:155 min",
    ])
  })
  test("do detalhe: Reimprimir via imprime na hora, e Refazer… abre a janela com o texto do Outro", async () => {
    telaGrande()
    const comanda = await mesaServida(74)
    const usuario = userEvent.setup()
    renderizar()
    const tabela = await abrirHistorico(usuario)
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar no histórico" }), "mesa 74")
    await waitFor(() => expect(tabela().getAllByRole("row")).toHaveLength(2))
    await usuario.click(tabela().getByRole("button", { name: /^Mesa 74 · #/ }))
    const detalhe = within(await screen.findByRole("dialog", { name: /^Mesa 74/ }))

    await usuario.click(detalhe.getByRole("button", { name: "Reimprimir via" }))
    await waitFor(() => expect(impressas).toHaveLength(1))
    expect(impressas[0]).toContain("Mesa 74")

    await usuario.click(detalhe.getByRole("button", { name: "Refazer…" }))
    const janela = within(await screen.findByRole("dialog", { name: /^Refazer Mesa 74/ }))
    await usuario.click(janela.getByRole("radio", { name: "Outro" }))
    await usuario.type(janela.getByRole("textbox", { name: "O que aconteceu (opcional)" }), "frio")
    await usuario.click(janela.getByRole("button", { name: "Refazer" }))
    await waitFor(async () =>
      expect((await api().pedidos.buscar(comanda.id))?.refacoes).toMatchObject([
        { motivo: "outro", texto: "frio" },
      ]),
    )
  })

  test("Ontem mostra o dia anterior só para ler; a situação Cancelados deixa só os cancelados", async () => {
    telaGrande()
    const { comanda } = await comandaNaMesa(75)
    await api().pedidos.cancelar(comanda.id, "recebido")
    const usuario = userEvent.setup()
    renderizar()
    const tabela = await abrirHistorico(usuario)
    await usuario.click(screen.getByRole("button", { name: "Ontem" }))
    expect(screen.getByRole("button", { name: /^Escolher dia/ })).toHaveTextContent("12/11/2026")
    await waitFor(() => expect(tabela().getAllByRole("row").length).toBeGreaterThan(5))
    const [primeiro] = tabela().getAllByRole("button")
    await usuario.click(primeiro)
    const detalhe = within(await screen.findByRole("dialog"))
    expect(detalhe.getByRole("button", { name: "Reimprimir via" })).toBeInTheDocument()
    expect(detalhe.queryByRole("button", { name: "Refazer…" })).not.toBeInTheDocument()
    await usuario.keyboard("{Escape}")

    await usuario.click(screen.getByRole("button", { name: "Hoje" }))
    await usuario.click(screen.getByRole("combobox", { name: "Situação" }))
    await usuario.click(await screen.findByRole("option", { name: "Cancelados" }))
    await waitFor(() => {
      const linhas = tabela().getAllByRole("row").slice(1)
      expect(linhas.length).toBeGreaterThan(0)
      for (const linha of linhas) expect(linha).toHaveTextContent("Cancelado")
      expect(tabela().getByRole("button", { name: /^Mesa 75 · #/ })).toBeInTheDocument()
    })
  })
  test("no celular, cartões em lista, e o detalhe abre numa gaveta", async () => {
    const comanda = await mesaServida(76)
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("tab", { name: "Histórico" }))
    const lista = within(await screen.findByRole("list", { name: "Histórico" }, { timeout: 8000 }))
    await usuario.click(
      lista.getByRole("button", { name: new RegExp(`Mesa 76 · #${comanda.numero}`) }),
    )
    const gaveta = within(
      await screen.findByRole("dialog", { name: `Mesa 76 · #${comanda.numero}` }),
    )
    expect(gaveta.getByRole("list", { name: "Linha do tempo" })).toHaveTextContent("Servido")
  })
})

describe("PaginaCozinha: desempenho", () => {
  test("o Quadro abre com a faixa do turno de hoje", async () => {
    telaGrande()
    renderizar()
    const faixa = within(
      await screen.findByRole("region", { name: "Turno de hoje" }, { timeout: 8000 }),
    )
    expect(faixa.getByText("Tempo médio até pronto")).toBeInTheDocument()
    expect(faixa.getByText("Atrasados agora")).toBeInTheDocument()
  })

  test("a aba Desempenho mostra a régua, o gráfico por hora e os tempos por praça, tipo e produto", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("tab", { name: "Desempenho" }))
    expect(await screen.findByText("Tempo até pronto", {}, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Por hora do dia" })).toBeInTheDocument()

    await usuario.click(screen.getByRole("radio", { name: "30 dias" }))
    const pracas = await screen.findByRole("list", { name: "Por praça" })
    expect(within(pracas).getByText("Forno")).toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Por tipo de pedido" })).toHaveTextContent("Entrega")
    expect(
      within(screen.getByRole("list", { name: "Produtos mais demorados" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(5)
  })
})

describe("PaginaCozinha: plano Pro", () => {
  test("sem o Pro, a aba Desempenho mostra o cadeado, e Contratar libera", async () => {
    useConfig.setState({ pro: false, compradas: [] })
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("tab", { name: "Desempenho" }))
    await usuario.click(
      await screen.findByRole("button", { name: /^Contratar o Desempenho da cozinha/ }),
    )
    expect(await screen.findByText("Tempo até pronto", {}, { timeout: 8000 })).toBeInTheDocument()
    // A faixa do turno é grátis: continua no Quadro.
    expect(useConfig.getState().compradas).toEqual(["cozinha.desempenho"])
  })

  test("sem o Pro, uma segunda praça e a via impressa sozinha ficam com cadeado", async () => {
    useConfig.setState({ pro: false, compradas: [] })
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("tab", { name: "Ajustes" }))
    const pracas = within(await screen.findByRole("region", { name: "Praças" }))
    expect(pracas.queryByRole("button", { name: "Nova praça" })).not.toBeInTheDocument()
    expect(
      pracas.getByRole("button", { name: /^Contratar o Mais de uma praça/ }),
    ).toBeInTheDocument()
    const vias = within(screen.getByRole("region", { name: "Vias da cozinha" }))
    expect(vias.queryByRole("switch")).not.toBeInTheDocument()
    expect(
      vias.getByRole("button", { name: /^Contratar o Via da cozinha impressa/ }),
    ).toBeInTheDocument()
  })

  test("com tempo de preparo, cada item diz quando começar para tudo ficar pronto junto", async () => {
    telaGrande()
    const lista = await api().produtos.listar()
    const [demorado, rapido] = lista.filter(
      (produto) => produto.grupos.length === 0 && produto.disponivel,
    )
    await api().produtos.salvar({ ...demorado, preparoMin: 20 })
    await api().produtos.salvar({ ...rapido, preparoMin: 8 })
    const mesa = await api().mesas.criar({ numero: 88 })
    await api().mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [
        { produtoId: demorado.id, escolhas: {}, quantidade: 1 },
        { produtoId: rapido.id, escolhas: {}, quantidade: 1 },
      ],
    })
    renderizar()
    const doTicket = within(await ticket("Mesa 88"))
    expect(doTicket.getByText("Comece agora")).toBeInTheDocument()
    expect(doTicket.getByText("Comece em 12 min")).toBeInTheDocument()
  })
  test("com tempo de preparo maior que o atraso da loja, o ticket ainda não está atrasado", async () => {
    telaGrande()
    const [lento] = (await api().produtos.listar()).filter(
      (produto) => produto.grupos.length === 0 && produto.disponivel,
    )
    await api().produtos.salvar({ ...lento, preparoMin: 30 })
    vi.setSystemTime(new Date(2026, 10, 13, 20, 5))
    const mesa = await api().mesas.criar({ numero: 89 })
    await api().mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [{ produtoId: lento.id, escolhas: {}, quantidade: 1 }],
    })
    vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
    renderizar()
    // 25 min na cozinha: atrasado pela loja (25), mas o preparo é de 30.
    expect(await ticket("Mesa 89")).toHaveAttribute("data-urgencia", "normal")

    useConfig.setState({ pro: false, compradas: [] })
    await waitFor(async () =>
      expect(await ticket("Mesa 89")).toHaveAttribute("data-urgencia", "atrasado"),
    )
  })
  test("o menu do cabeçalho leva ao Modo TV, com a praça do aparelho, e ao Painel de chamada", async () => {
    telaGrande()
    usePreferenciasFila.setState({ praca: "praca-forno" })
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("button", { name: "Mais telas da cozinha" }))
    expect(await screen.findByRole("menuitem", { name: /Modo TV/ })).toHaveAttribute(
      "href",
      "/admin/cozinha/tv?praca=praca-forno",
    )
    expect(screen.getByRole("menuitem", { name: /Painel de chamada/ })).toHaveAttribute(
      "href",
      "/admin/cozinha/chamada",
    )
  })
})
