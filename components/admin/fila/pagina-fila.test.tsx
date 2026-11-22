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

function renderizar(intervaloSimulacao = 60_000, intervalo?: number) {
  return render(
    <Provedores>
      <PaginaFila intervaloSimulacao={intervaloSimulacao} intervalo={intervalo} />
    </Provedores>,
  )
}

/** Retirada do balcão, mandada para a fila e a cozinha. */
const retirada = (agendadoPara?: string) =>
  servidorDo("pizzaria").pdv.finalizar({
    itens: [{ avulso: { nome: "Batata", preco: 12 }, quantidade: 1 }],
    pagamento: "pix",
    desconto: { modo: "reais", valor: 0 },
    concluida: false,
    ...(agendadoPara ? { agendadoPara } : {}),
  })

/** Áudio: a fronteira com o navegador. Conta quantas vezes o alerta tocou. */
function contarAlertas() {
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
    },
  )
  return tocadas
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
            frequency: { setValueAtTime: () => {} },
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

    // A simulação cria um pedido a cada 300 ms: com a máquina lenta, mais de um chega junto.
    expect(await screen.findAllByText("Chegou agora", {}, { timeout: 8000 })).not.toHaveLength(0)
    expect(tocadas).toHaveBeenCalled()
  })

  test("o pedido agendado mostra para quando é", async () => {
    telaGrande()
    const pedido = await retirada(new Date(2026, 10, 13, 22, 0).toISOString())
    renderizar()
    const cartao = within(
      await (await coluna("Novos")).findByRole("article", { name: `#${pedido.numero}` }),
    )
    expect(cartao.getByText("Para 22:00")).toBeInTheDocument()
  })

  test("mensagem da cozinha aparece no cartão, com Ok", async () => {
    telaGrande()
    const pedido = await retirada()
    await servidorDo("pizzaria").cozinha.avisar(pedido.id, 1, "substituicao")
    const usuario = userEvent.setup()
    renderizar()

    const cartao = within(
      (await coluna("Novos")).getByRole("article", { name: `#${pedido.numero}` }),
    )
    const mensagem = within(cartao.getByRole("status", { name: "Mensagem da cozinha" }))
    expect(mensagem.getByText("Acabou um item, ver substituição")).toBeInTheDocument()
    await usuario.click(mensagem.getByRole("button", { name: "Ok" }))
    await waitFor(() =>
      expect(cartao.queryByRole("status", { name: "Mensagem da cozinha" })).toBeNull(),
    )
    const visto = await servidorDo("pizzaria").pedidos.buscar(pedido.id)
    expect(visto?.mensagensCozinha?.[0].vistaEm).toBeDefined()
  })

  test("pedido que fica pronto na cozinha toca o alerta", async () => {
    telaGrande()
    const tocadas = contarAlertas()
    const pedido = await retirada()
    usePreferenciasFila.setState({ somLigado: true })
    renderizar(60_000, 200)
    await (await coluna("Novos")).findByRole("article", { name: `#${pedido.numero}` })
    expect(tocadas).not.toHaveBeenCalled()

    await servidorDo("pizzaria").cozinha.avancar(pedido.id, 1, "recebido")
    await servidorDo("pizzaria").cozinha.avancar(pedido.id, 1, "em-preparo")
    await (await coluna("Prontos")).findByRole(
      "article",
      { name: `#${pedido.numero}` },
      { timeout: 4000 },
    )
    await waitFor(() => expect(tocadas).toHaveBeenCalled())
  })

  test("sair da fila com um destaque na tela desliga o relógio do destaque", async () => {
    telaGrande()
    const criar = vi.spyOn(globalThis, "setTimeout")
    const limpar = vi.spyOn(globalThis, "clearTimeout")
    usePreferenciasFila.setState({ simular: true })
    const { unmount } = renderizar(300)
    await screen.findAllByText("Chegou agora", {}, { timeout: 8000 })

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

    await screen.findAllByText("Chegou agora", {}, { timeout: 8000 })
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
