import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaFila } from "./pagina-fila"

// Impressora: a fronteira com o navegador. O teste confere quantas vezes o cupom foi mandado.
const imprimir = vi.fn()
vi.mock("react-to-print", () => ({ useReactToPrint: () => imprimir }))

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter hasMemory>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

/** Tela de computador: o quadro mostra as colunas lado a lado. */
function telaGrande() {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("min-width"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

/** Web Audio de mentira: conta cada nota tocada. */
function simularAudio() {
  const tocadas = vi.fn()
  vi.stubGlobal(
    "AudioContext",
    class {
      currentTime = 0
      destination = {}
      state = "running"
      createOscillator() {
        tocadas()
        return {
          type: "sine",
          frequency: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
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
    },
  )
  return tocadas
}

function renderizar(intervaloSimulacao = 60_000) {
  return render(
    <Provedores>
      <PaginaFila intervaloSimulacao={intervaloSimulacao} />
    </Provedores>,
  )
}

const coluna = async (nome: string) =>
  within(await screen.findByRole("region", { name: new RegExp(`^${nome}`) }, { timeout: 8000 }))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  imprimir.mockClear()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  usePreferenciasFila.setState({ ...usePreferenciasFila.getInitialState(), simular: false }, true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("PaginaFila", () => {
  test("no computador, mostra as quatro colunas com a contagem", async () => {
    telaGrande()
    renderizar()
    const novos = await coluna("Novos")
    const cartoes = novos.getAllByRole("article")
    expect(cartoes.length).toBeGreaterThan(0)
    expect(screen.getByRole("region", { name: `Novos, ${cartoes.length}` })).toBeInTheDocument()
    for (const nome of ["Em preparo", "Prontos", "A caminho"]) {
      expect(await coluna(nome)).toBeTruthy()
    }
  })

  test("avançar leva o cartão para a próxima coluna", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const [cartao] = (await coluna("Novos")).getAllByRole("article")
    const numero = within(cartao).getByRole("heading").textContent ?? ""

    await usuario.click(within(cartao).getByRole("button", { name: "Iniciar preparo" }))

    expect(
      await (await coluna("Em preparo")).findByRole("heading", { name: numero }),
    ).toBeInTheDocument()
  })

  test("no celular, as colunas viram abas com a contagem", async () => {
    renderizar()
    const aba = await screen.findByRole("tab", { name: /Novos/ }, { timeout: 8000 })
    expect(aba).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: /Em preparo/ })).toBeInTheDocument()
  })

  test("no tablet, com a barra lateral, as colunas também viram abas", async () => {
    // 768 a 1023 px: a barra lateral come 256 px e quatro colunas cortam os botões.
    vi.stubGlobal("matchMedia", (consulta: string) => ({
      matches: consulta === "(min-width: 768px)",
      media: consulta,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    renderizar()
    expect(await screen.findByRole("tab", { name: /Novos/ }, { timeout: 8000 })).toBeInTheDocument()
    // Só a aba aberta aparece; as outras colunas ficam escondidas.
    expect(screen.queryByRole("region", { name: /^Em preparo/ })).not.toBeInTheDocument()
  })

  test("pedido novo chega com destaque e toca o alerta", async () => {
    telaGrande()
    const tocadas = vi.fn()
    vi.stubGlobal(
      "AudioContext",
      class {
        currentTime = 0
        destination = {}
        state = "running"
        createOscillator() {
          tocadas()
          return {
            type: "sine",
            frequency: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
            connect: (no: unknown) => no,
            start: () => {},
            stop: () => {},
          }
        }
        createGain() {
          const ganho = {
            gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
            connect: (no: unknown) => no,
          }
          return ganho
        }
      },
    )
    usePreferenciasFila.setState({ somLigado: true, simular: true })
    renderizar(300)

    expect(await screen.findByText("Chegou agora", {}, { timeout: 8000 })).toBeInTheDocument()
    expect(tocadas).toHaveBeenCalled()
  })

  test("sair da fila com um destaque na tela desliga o relógio do destaque", async () => {
    telaGrande()
    const criar = vi.spyOn(globalThis, "setTimeout")
    const limpar = vi.spyOn(globalThis, "clearTimeout")
    usePreferenciasFila.setState({ simular: true })
    const { unmount } = renderizar(300)
    await screen.findByText("Chegou agora", {}, { timeout: 8000 })

    // O destaque "Chegou agora" dura 10 s.
    const destaques = criar.mock.calls.flatMap((chamada, indice) =>
      chamada[1] === 10_000 ? [criar.mock.results[indice].value] : [],
    )
    expect(destaques.length).toBeGreaterThan(0)
    unmount()
    for (const relogio of destaques) expect(limpar).toHaveBeenCalledWith(relogio)
  })

  test("desligar a entrega mantém as entregas na fila", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    await coluna("Novos")
    const entregas = () => screen.getAllByText("Entrega", { selector: "[data-canal]" }).length
    const antes = entregas()

    const chave = screen.getByRole("switch", { name: "Entrega" })
    expect(chave).toBeChecked()
    await usuario.click(chave)

    expect(await screen.findByRole("switch", { name: "Entrega" })).not.toBeChecked()
    expect(entregas()).toBe(antes)
  })

  test("imprimir o cupom pelo cartão marca a hora; o botão vira reimprimir", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const [cartao] = (await coluna("Novos")).getAllByRole("article")
    const numero = within(cartao).getByRole("heading").textContent ?? ""

    await usuario.click(within(cartao).getByRole("button", { name: `Imprimir cupom de ${numero}` }))
    expect(imprimir).toHaveBeenCalledTimes(1)
    expect(await within(cartao).findByText("Impresso às 20:30")).toBeInTheDocument()
    expect(
      within(cartao).getByRole("button", { name: `Reimprimir cupom de ${numero}` }),
    ).toBeInTheDocument()
  })

  test("impressão automática: cada pedido novo sai uma vez só", async () => {
    telaGrande()
    const api = servidorDo("pizzaria")
    await api.salvarLoja({ ...(await api.loja()), impressaoAutomatica: true })
    usePreferenciasFila.setState({ simular: true })
    renderizar(400)

    await screen.findByText("Chegou agora", {}, { timeout: 8000 })
    // Para de chegar pedido e espera todos os que chegaram saírem.
    usePreferenciasFila.setState({ simular: false })
    const chegaram = async () =>
      (await api.pedidos.listar({ status: ["recebido"] })).filter(
        (pedido) => Date.parse(pedido.criadoEm) >= new Date(2026, 10, 13, 20, 30).getTime(),
      )
    await waitFor(async () => {
      const novos = await chegaram()
      expect(novos.length).toBeGreaterThan(0)
      for (const pedido of novos) expect(pedido.impressoEm).toBeDefined()
    })
    // Uma impressão para cada pedido que chegou.
    expect(imprimir).toHaveBeenCalledTimes((await chegaram()).length)
  })

  test("os detalhes do pedido também imprimem o cupom", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const [cartao] = (await coluna("Novos")).getAllByRole("article")
    const numero = within(cartao).getByRole("heading").textContent ?? ""
    await usuario.click(within(cartao).getByRole("button", { name: "Detalhes" }))
    const detalhes = within(await screen.findByRole("dialog", { name: `Pedido ${numero}` }))
    await usuario.click(detalhes.getByRole("button", { name: "Imprimir cupom" }))
    expect(imprimir).toHaveBeenCalledTimes(1)
    expect(await detalhes.findByText("Impresso às 20:30")).toBeInTheDocument()
  })

  test("com o horário automático, a chave pergunta antes de passar para o manual", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    await coluna("Novos")
    // Sexta, 20h30: dentro do horário da pizzaria.
    const chave = screen.getByRole("switch", { name: "Loja aberta" })
    expect(chave).toBeChecked()
    expect(screen.getByText("Pelo horário")).toBeInTheDocument()

    await usuario.click(chave)
    const pergunta = within(
      screen.getByRole("alertdialog", { name: "Passar para o controle manual?" }),
    )
    await usuario.click(pergunta.getByRole("button", { name: "Fechar e passar para o manual" }))
    expect(await screen.findByRole("switch", { name: "Loja aberta" })).not.toBeChecked()
    expect((await servidorDo("pizzaria").loja()).controleAutomatico).toBe(false)
    expect(screen.queryByText("Pelo horário")).not.toBeInTheDocument()
  })

  test("o aparelho que não escolheu o som usa o som da loja", async () => {
    telaGrande()
    const api = servidorDo("pizzaria")
    await api.salvarLoja({ ...(await api.loja()), som: "suave" })
    renderizar()
    await coluna("Novos")
    expect(screen.getByRole("combobox", { name: "Tipo do alerta" })).toHaveTextContent(
      "Padrão da loja (Suave)",
    )
  })

  test("Detalhes abre o painel do pedido", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const [cartao] = (await coluna("Novos")).getAllByRole("article")
    const numero = within(cartao).getByRole("heading").textContent ?? ""

    await usuario.click(within(cartao).getByRole("button", { name: "Detalhes" }))
    expect(await screen.findByRole("dialog", { name: `Pedido ${numero}` })).toBeInTheDocument()
  })
})

describe("PaginaFila: aceite manual", () => {
  /** Chega um pedido do site agora, com o aceite manual ligado. */
  async function chegaPedidoDoSite() {
    const servidor = servidorDo(useSegmentoAtual.getState().segmento)
    await servidor.salvarLoja({ ...(await servidor.loja()), aceiteManual: true })
    return servidor.pedidos.simular()
  }

  test("o pedido esperando aceite abre a coluna Novos, com Aceitar e Recusar", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    const novo = await chegaPedidoDoSite()
    renderizar()

    const [primeiro] = (await coluna("Novos")).getAllByRole("article")
    const cartao = within(primeiro)
    expect(cartao.getByRole("heading")).toHaveTextContent(`#${novo.numero}`)
    expect(cartao.queryByRole("button", { name: "Iniciar preparo" })).not.toBeInTheDocument()

    await usuario.click(cartao.getByRole("button", { name: "Aceitar" }))

    expect(await cartao.findByRole("button", { name: "Iniciar preparo" })).toBeInTheDocument()
    expect(cartao.queryByRole("button", { name: "Recusar" })).not.toBeInTheDocument()
  })

  test("mostra há quanto tempo espera e marca quando passa do limite", async () => {
    telaGrande()
    await chegaPedidoDoSite()
    // O relógio da fila anda de 30 em 30 s: a tela já abre 6 min depois da chegada.
    vi.setSystemTime(new Date(2026, 10, 13, 20, 36))
    renderizar()

    const cartao = within((await coluna("Novos")).getAllByRole("article")[0])
    expect(cartao.getByText("Esperando aceite há 6 min")).toBeInTheDocument()
    expect(cartao.getByText(", passou do limite")).toHaveClass("sr-only")
  })

  test("o alarme repete enquanto o pedido espera e para quando a loja aceita", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    const tocadas = simularAudio()
    await chegaPedidoDoSite()
    usePreferenciasFila.setState({ somLigado: true })
    render(
      <Provedores>
        <PaginaFila intervaloAlarme={100} />
      </Provedores>,
    )

    const cartao = within((await coluna("Novos")).getAllByRole("article")[0])
    await waitFor(() => expect(tocadas.mock.calls.length).toBeGreaterThanOrEqual(8))
    await usuario.click(cartao.getByRole("button", { name: "Aceitar" }))
    await cartao.findByRole("button", { name: "Iniciar preparo" })

    const depoisDoAceite = tocadas.mock.calls.length
    await new Promise((pronto) => setTimeout(pronto, 400))
    expect(tocadas.mock.calls.length).toBe(depoisDoAceite)
  })

  test("som bloqueado pelo navegador: avisa e libera com um toque", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    simularAudio()
    const Base = globalThis.AudioContext as unknown as new () => { state: string }
    vi.stubGlobal(
      "AudioContext",
      class extends Base {
        state = "suspended"
        async resume() {
          this.state = "running"
        }
      },
    )
    usePreferenciasFila.setState({ somLigado: true })
    renderizar()

    await usuario.click(
      await screen.findByRole("button", { name: "Toque para ativar o som" }, { timeout: 8000 }),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Toque para ativar o som" }),
      ).not.toBeInTheDocument(),
    )
  })

  test("com a sirene como som da loja, o aparelho mostra a sirene como padrão", async () => {
    const servidor = servidorDo(useSegmentoAtual.getState().segmento)
    await servidor.salvarLoja({ ...(await servidor.loja()), som: "sirene" })
    renderizar()

    await waitFor(
      () =>
        expect(screen.getByRole("combobox", { name: "Tipo do alerta" })).toHaveTextContent(
          "Padrão da loja (Sirene)",
        ),
      { timeout: 8000 },
    )
  })

  test("recusar pede o motivo e tira o pedido da fila", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    const novo = await chegaPedidoDoSite()
    renderizar()

    const cartao = within((await coluna("Novos")).getAllByRole("article")[0])
    await usuario.click(cartao.getByRole("button", { name: "Recusar" }))
    const dialogo = within(
      screen.getByRole("alertdialog", { name: `Recusar o pedido #${novo.numero}?` }),
    )
    await usuario.click(dialogo.getByRole("radio", { name: "Loja cheia" }))
    await usuario.click(dialogo.getByRole("button", { name: "Sim, recusar" }))

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: `#${novo.numero}` })).not.toBeInTheDocument(),
    )
  })
})

describe("PaginaFila: pedidos de dias anteriores", () => {
  /** A loja abriu no dia 13 e voltou no dia 14 com pedidos ainda abertos. */
  async function voltarNoDiaSeguinte() {
    const servidor = servidorDo(useSegmentoAtual.getState().segmento)
    const abertos = await servidor.pedidos.listar({
      status: ["recebido", "em-preparo", "pronto", "saiu-para-entrega"],
    })
    vi.setSystemTime(new Date(2026, 10, 14, 11, 0))
    return abertos
  }

  test("ficam fora das colunas, num aviso; concluir todos esvazia o aviso", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    const abertos = await voltarNoDiaSeguinte()
    renderizar()

    const aviso = await screen.findByRole(
      "button",
      { name: `${abertos.length} pedidos de dias anteriores` },
      { timeout: 8000 },
    )
    expect(screen.queryByRole("heading", { name: `#${abertos[0].numero}` })).not.toBeInTheDocument()
    await usuario.click(aviso)
    const lista = within(screen.getByRole("dialog", { name: "Pedidos de dias anteriores" }))
    expect(lista.getAllByRole("listitem")).toHaveLength(abertos.length)
    await usuario.click(lista.getByRole("button", { name: "Concluir todos" }))

    // A lista fecha quando o servidor termina de gravar o lote.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /de dias anteriores$/ })).not.toBeInTheDocument(),
    )
  })

  test("cancelar todos pede um motivo só", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    const abertos = await voltarNoDiaSeguinte()
    renderizar()

    await usuario.click(
      await screen.findByRole(
        "button",
        { name: `${abertos.length} pedidos de dias anteriores` },
        { timeout: 8000 },
      ),
    )
    await usuario.click(screen.getByRole("button", { name: "Cancelar todos" }))
    const confirmacao = within(screen.getByRole("alertdialog"))
    await usuario.click(confirmacao.getByRole("radio", { name: "Cliente pediu para cancelar" }))
    await usuario.click(confirmacao.getByRole("button", { name: "Sim, cancelar todos" }))

    // A lista fecha quando o servidor termina de gravar o lote.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /de dias anteriores$/ })).not.toBeInTheDocument(),
    )
  })
})

describe("PaginaFila: cancelar pelo cartão", () => {
  test("pede o motivo, confirma e tira o pedido da fila", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const [primeiro] = (await coluna("Em preparo")).getAllByRole("article")
    const numero = within(primeiro).getByRole("heading").textContent ?? ""

    await usuario.click(within(primeiro).getByRole("button", { name: `Cancelar pedido ${numero}` }))
    const dialogo = within(
      screen.getByRole("alertdialog", { name: `Cancelar o pedido ${numero}?` }),
    )
    await usuario.click(dialogo.getByRole("radio", { name: "Sem estoque de um item" }))
    await usuario.click(dialogo.getByRole("button", { name: "Sim, cancelar" }))

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: numero })).not.toBeInTheDocument(),
    )
  })
})

describe("PaginaFila: concluídos hoje", () => {
  test("conta o pedido concluído hoje mesmo que criado ontem", async () => {
    vi.setSystemTime(new Date(2026, 10, 13, 23, 50))
    const api = servidorDo("pizzaria")
    const mesa = await api.mesas.criar({ numero: 90 })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    vi.setSystemTime(new Date(2026, 10, 14, 0, 10))
    await api.mesas.fecharConta(comanda.id, "pix")
    telaGrande()
    renderizar()

    expect(
      await screen.findByText(/· 1 concluídos hoje/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  test("o relógio da fila não cria uma consulta nova a cada tique", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] })
    vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
    telaGrande()
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <NuqsTestingAdapter hasMemory>
        <QueryClientProvider client={cliente}>
          <TooltipProvider>
            <PaginaFila />
          </TooltipProvider>
        </QueryClientProvider>
      </NuqsTestingAdapter>,
    )
    await screen.findByText(/concluídos hoje/, {}, { timeout: 8000 })
    const consultas = () =>
      cliente.getQueryCache().findAll({ queryKey: ["admin", "pizzaria", "pedidos"] }).length
    const antes = consultas()

    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })
    expect(consultas()).toBe(antes)
  })
})

describe("PaginaFila no açougue", () => {
  test("o cartão avisa o que falta pesar e o dia da retirada", async () => {
    telaGrande()
    useSegmentoAtual.setState({ segmento: "acougue" })
    const api = servidorDo("acougue")
    const fila = await api.pedidos.listar({ status: ["recebido", "em-preparo", "pronto"] })
    const aPesar = fila.find(
      (pedido) => pedido.itens.some((item) => item.pesoGramas) && !pedido.pesagem,
    )
    const comData = fila.find((pedido) => pedido.dataRetirada)
    if (!aPesar || !comData) throw new Error("A demonstração do açougue devia ter os dois casos")
    renderizar()

    const cartao = async (numero: number) =>
      within(await screen.findByRole("article", { name: `#${numero}` }, { timeout: 8000 }))
    expect((await cartao(aPesar.numero)).getByText("A pesar")).toBeInTheDocument()
    expect(
      (await cartao(comData.numero)).getByText(
        /^Retirar (dom|seg|ter|qua|qui|sex|sáb)\., \d{2}\/\d{2}$/,
      ),
    ).toBeInTheDocument()
  })
})
