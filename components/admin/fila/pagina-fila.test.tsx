import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaFila } from "./pagina-fila"

// Impressora: a fronteira com o navegador. O teste confere quantas vezes o cupom foi mandado.
const imprimir = vi.fn()
vi.mock("react-to-print", () => ({ useReactToPrint: () => imprimir }))

/** O endereço da página: a busca e os filtros da fila ficam nele. */
const urlMudou = vi.fn()

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter hasMemory onUrlUpdate={urlMudou}>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
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

/** Aba do navegador escondida (outra aba na frente) ou à vista. */
function abaEscondida(escondida: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => escondida })
}

/** Abre o menu com as preferências deste aparelho (som, avisos, demonstração). */
async function abrirEsteAparelho(usuario = userEvent.setup()) {
  // No celular, as ferramentas ficam no Mais.
  const botao = await screen.findByRole(
    "button",
    { name: /^(Mais|Este aparelho)$/ },
    { timeout: 8000 },
  )
  if (botao.textContent === "Mais") await usuario.click(botao)
  await usuario.click(
    await screen.findByRole("button", { name: "Este aparelho" }, { timeout: 8000 }),
  )
  return within(await screen.findByRole("dialog", { name: "Este aparelho" }))
}

const coluna = async (nome: string) =>
  within(await screen.findByRole("region", { name: new RegExp(`^${nome}`) }, { timeout: 8000 }))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  imprimir.mockClear()
  urlMudou.mockClear()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  usePreferenciasFila.setState({ ...usePreferenciasFila.getInitialState(), simular: false }, true)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  abaEscondida(false)
  toast.dismiss()
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

  test("avançar dá 6 s para desfazer: o cartão volta para a coluna de antes", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const cartao = (await coluna("Novos"))
      .getAllByRole("article")
      .find((item) => within(item).queryByRole("button", { name: "Iniciar preparo" }))
    if (!cartao) throw new Error("Devia haver um pedido novo pronto para começar")
    const numero = within(cartao).getByRole("heading").textContent ?? ""

    await usuario.click(within(cartao).getByRole("button", { name: "Iniciar preparo" }))
    await (await coluna("Em preparo")).findByRole("heading", { name: numero })
    // O aviso deste pedido (os de outros testes podem ainda estar saindo da tela).
    const aviso = (await screen.findByText(`${numero}: Em preparo`)).closest("li")
    if (!aviso) throw new Error("O aviso do avanço devia estar na tela")
    await usuario.click(within(aviso).getByRole("button", { name: "Desfazer" }))

    expect(
      await (await coluna("Novos")).findByRole("heading", { name: numero }),
    ).toBeInTheDocument()
    expect((await servidorDo("pizzaria").pedidos.buscar(Number(numero.slice(1))))?.status).toBe(
      "recebido",
    )
  })

  test("seleção: marcar dois pedidos, imprimir os dois cupons e avançar os dois de uma vez", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const novos = await coluna("Novos")
    await usuario.click(screen.getByRole("button", { name: "Selecionar" }))
    const caixas = novos.getAllByRole("checkbox", { name: /^Selecionar #/ })
    expect(caixas.length).toBeGreaterThanOrEqual(2)
    const numeros = caixas
      .slice(0, 2)
      .map((caixa) => (caixa.getAttribute("aria-label") ?? "").replace("Selecionar ", ""))
    await usuario.click(caixas[0])
    await usuario.click(caixas[1])

    const barra = within(screen.getByRole("region", { name: "Pedidos selecionados" }))
    expect(barra.getByText("2 selecionados")).toBeInTheDocument()
    await usuario.click(barra.getByRole("button", { name: "Imprimir" }))
    expect(imprimir).toHaveBeenCalledTimes(2)

    await usuario.click(barra.getByRole("button", { name: "Avançar" }))
    const preparo = await coluna("Em preparo")
    for (const numero of numeros) {
      expect(await preparo.findByRole("heading", { name: numero })).toBeInTheDocument()
    }
    expect(screen.queryByRole("region", { name: "Pedidos selecionados" })).not.toBeInTheDocument()
  })

  test("Shift+clique num cartão seleciona sem entrar no modo de seleção", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const [cartao] = (await coluna("Em preparo")).getAllByRole("article")
    await usuario.keyboard("{Shift>}")
    await usuario.click(within(cartao).getByText(/itens? ·/))
    await usuario.keyboard("{/Shift}")
    expect(
      within(screen.getByRole("region", { name: "Pedidos selecionados" })).getByText(
        "1 selecionado",
      ),
    ).toBeInTheDocument()
  })

  test("teclado: as setas andam pelos cartões, Enter avança e P imprime o cartão em foco", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const [primeiro] = (await coluna("Novos")).getAllByRole("article")
    const numero = within(primeiro).getByRole("heading").textContent ?? ""

    await usuario.keyboard("{ArrowDown}")
    expect(primeiro).toHaveFocus()
    await usuario.keyboard("p")
    expect(imprimir).toHaveBeenCalledTimes(1)
    await usuario.keyboard("{Enter}")
    expect(
      await (await coluna("Em preparo")).findByRole("heading", { name: numero }),
    ).toBeInTheDocument()
  })

  test("teclado: / vai para a busca e ? abre a folha de atalhos", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    await coluna("Novos")
    await usuario.keyboard("/")
    expect(screen.getByRole("searchbox", { name: "Buscar pedido" })).toHaveFocus()
    await usuario.keyboard("{Escape}")
    screen.getByRole("searchbox", { name: "Buscar pedido" }).blur()
    await usuario.keyboard("?")
    const ajuda = within(await screen.findByRole("dialog", { name: "Atalhos da fila" }))
    expect(ajuda.getByText("Avançar o pedido em foco")).toBeInTheDocument()
  })

  test("despachar a entrega pronta com o motoboy sugerido e chamar no WhatsApp", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const prontos = await coluna("Prontos")
    const despachar = await prontos.findByRole("button", { name: "Despachar" }, { timeout: 8000 })
    const cartao = despachar.closest("article") as HTMLElement
    const numero = within(cartao).getByRole("heading").textContent ?? ""

    await usuario.click(despachar)
    const janela = within(await screen.findByRole("dialog", { name: `Despachar ${numero}` }))
    const sugerido = janela.getByRole("radio", { checked: true })
    const nome = sugerido.getAttribute("aria-label") ?? ""
    await usuario.click(janela.getByRole("button", { name: "Despachar" }))

    const chamar = await janela.findByRole("link", { name: `Chamar ${nome} no WhatsApp` })
    expect(chamar.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/55\d+\?text=/)
    await usuario.click(janela.getByRole("button", { name: "Fechar" }))
    expect(
      await (await coluna("A caminho")).findByRole("heading", { name: numero }),
    ).toBeInTheDocument()
  })

  test("motoboy voltou: as entregas dele saem de A caminho e ele fica disponível", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const caminho = await coluna("A caminho")
    const motoboys = within(caminho.getByRole("list", { name: "Motoboys" }))
    const [voltou] = motoboys.getAllByRole("button", { name: /^.+ voltou$/ })
    const nome = (voltou.getAttribute("aria-label") ?? "").replace(" voltou", "")
    const antes = caminho.getAllByRole("article").length

    await usuario.click(voltou)
    await waitFor(() =>
      expect((caminho.queryAllByRole("article") ?? []).length).toBeLessThan(antes),
    )
    const linha = motoboys.getAllByRole("listitem").find((item) => item.textContent?.includes(nome))
    expect(linha).toHaveTextContent(/disponível/i)
  })

  test("Por bairro: as entregas em andamento agrupadas, do bairro com mais ao com menos", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    await coluna("Novos")
    await usuario.click(screen.getByRole("button", { name: "Por bairro" }))
    const gaveta = within(await screen.findByRole("dialog", { name: "Entregas por bairro" }))
    const grupos = gaveta.getAllByRole("region")
    expect(grupos.length).toBeGreaterThan(0)
    const quantos = grupos.map((grupo) => within(grupo).getAllByRole("listitem").length)
    expect(quantos).toEqual([...quantos].sort((a, b) => b - a))
    expect(within(grupos[0]).getAllByRole("listitem")[0]).toHaveTextContent(/^#\d+/)
  })

  test("aceitar mostra a mensagem que teria saído para o cliente", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    const novo = await servidorDo("pizzaria").pedidos.simular()
    renderizar()
    const cartao = (
      await (await coluna("Novos")).findByRole("heading", { name: `#${novo.numero}` })
    ).closest("article") as HTMLElement
    await usuario.click(within(cartao).getByRole("button", { name: "Aceitar" }))

    const aviso = (await screen.findByText("Cliente avisado no WhatsApp")).closest("li")
    expect(aviso).toHaveTextContent(`Seu pedido #${novo.numero} na Casa da Pizza foi aceito`)
  })

  test("alerta secundário: pronto parado avisa uma vez, agrupado", async () => {
    telaGrande()
    renderizar()
    await coluna("Prontos")
    expect(
      await screen.findByText(/pronto há \d+ min|pedidos prontos parados/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  test("alerta secundário desligado no Este aparelho não avisa", async () => {
    telaGrande()
    usePreferenciasFila.setState({
      alertas: { parado: false, atraso: false, pago: true, cancelou: true },
    })
    renderizar()
    await coluna("Prontos")
    await new Promise((pronto) => setTimeout(pronto, 300))
    expect(screen.queryByText(/pronto há \d+ min|pedidos prontos parados/)).not.toBeInTheDocument()
    const menu = await abrirEsteAparelho()
    expect(menu.getByRole("switch", { name: "Pronto parado" })).not.toBeChecked()
    expect(menu.getByRole("switch", { name: "Cliente cancelou" })).toBeChecked()
  })

  test("demonstração: de vez em quando o cliente cancela, e a fila avisa", async () => {
    telaGrande()
    usePreferenciasFila.setState({ simular: true })
    renderizar(100)
    expect(
      await screen.findByText(/o cliente cancelou|cancelados pelo cliente/, {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  test("adega: retirada com bebida alcoólica pede o documento antes de entregar", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    useSegmentoAtual.setState({ segmento: "adega" })
    const api = servidorDo("adega")
    const alcoolicos = new Set(
      (await api.produtos.listar())
        .filter((produto) => produto.alcoolico)
        .map((produto) => produto.id),
    )
    const comAlcool = (await api.pedidos.listar({ status: ["em-preparo", "pronto"] })).find(
      (pedido) =>
        pedido.tipo === "retirada" &&
        pedido.itens.some((item) => item.produtoId !== null && alcoolicos.has(item.produtoId)),
    )
    if (!comAlcool) throw new Error("A demonstração da adega devia ter retirada com álcool")
    if (comAlcool.status === "em-preparo") await api.pedidos.avancar(comAlcool.id, "em-preparo")
    renderizar()

    const prontos = await coluna("Prontos")
    const cartao = (await prontos.findByRole("heading", { name: `#${comAlcool.numero}` })).closest(
      "article",
    ) as HTMLElement
    expect(within(cartao).getByText("+18: conferir documento")).toBeInTheDocument()
    await usuario.click(within(cartao).getByRole("button", { name: "Cliente retirou" }))
    const pergunta = within(
      await screen.findByRole("alertdialog", { name: "Conferiu o documento?" }),
    )
    await usuario.click(pergunta.getByRole("button", { name: "Conferi, entregar" }))
    await waitFor(async () =>
      expect((await api.pedidos.buscar(comAlcool.id))?.status).toBe("concluido"),
    )
  })

  test("mesa pronta: Servido tira da fila; a conta continua em Mesas", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const prontos = await coluna("Prontos")
    const servido = await prontos.findByRole("button", { name: "Servido" }, { timeout: 8000 })
    const cartao = servido.closest("article") as HTMLElement
    const numero = within(cartao).getByRole("heading").textContent ?? ""

    await usuario.click(servido)
    await waitFor(() =>
      expect(prontos.queryByRole("heading", { name: numero })).not.toBeInTheDocument(),
    )
    const mesa = await servidorDo("pizzaria").pedidos.buscar(Number(numero.slice(1)))
    expect(mesa?.status).toBe("pronto")
    expect(mesa?.servidoEm).toBeDefined()
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

  test("com a aba escondida, o pedido novo vira notificação do sistema", async () => {
    telaGrande()
    const avisos: { titulo: string; corpo?: string }[] = []
    vi.stubGlobal(
      "Notification",
      class {
        static permission = "granted"
        constructor(titulo: string, opcoes?: { body?: string }) {
          avisos.push({ titulo, ...(opcoes?.body ? { corpo: opcoes.body } : {}) })
        }
      },
    )
    abaEscondida(true)
    usePreferenciasFila.setState({ notificar: true, simular: true })
    renderizar(300)

    await waitFor(() => expect(avisos.length).toBeGreaterThan(0), { timeout: 8000 })
    expect(avisos[0].titulo).toMatch(/^Pedido novo #\d+$/)
    expect(avisos[0].corpo).toBeTruthy()
  })

  test("ligar a notificação pede licença ao navegador; negada, a chave fica desligada", async () => {
    const usuario = userEvent.setup()
    let resposta: NotificationPermission = "denied"
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn(async () => resposta),
    })
    renderizar()
    const menu = await abrirEsteAparelho(usuario)
    const chave = menu.getByRole("switch", { name: "Notificação do sistema" })

    await usuario.click(chave)
    expect(
      await screen.findByText(
        "O navegador bloqueou as notificações. Libere nas configurações do site.",
      ),
    ).toBeInTheDocument()
    expect(chave).toHaveAttribute("aria-checked", "false")

    resposta = "granted"
    await usuario.click(chave)
    await waitFor(() => expect(chave).toHaveAttribute("aria-checked", "true"))
  })

  test("com Vibrar ligado, o celular vibra quando chega pedido", async () => {
    telaGrande()
    const vibrar = vi.fn(() => true)
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrar })
    usePreferenciasFila.setState({ vibrar: true, simular: true })
    renderizar(300)

    await waitFor(() => expect(vibrar).toHaveBeenCalled(), { timeout: 8000 })
    Reflect.deleteProperty(navigator, "vibrate")
  })

  test("com a aba escondida, o título pisca com os pedidos esperando; ao voltar, para", async () => {
    telaGrande()
    document.title = "Fila de pedidos"
    abaEscondida(true)
    usePreferenciasFila.setState({ piscarAba: true, simular: true })
    renderizar(300)

    await waitFor(() => expect(document.title).toMatch(/^🔔 \d+ novos?$/), { timeout: 8000 })

    abaEscondida(false)
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await waitFor(() => expect(document.title).toBe("Fila de pedidos"))
  })

  test("Tela sempre acesa segura a tela enquanto a fila está aberta e solta ao sair", async () => {
    telaGrande()
    const soltar = vi.fn(async () => {})
    const pedir = vi.fn(async () => ({ release: soltar }))
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: pedir } })
    usePreferenciasFila.setState({ telaAcesa: true })
    const { unmount } = renderizar()

    await waitFor(() => expect(pedir).toHaveBeenCalledWith("screen"), { timeout: 8000 })
    unmount()
    await waitFor(() => expect(soltar).toHaveBeenCalled())
    Reflect.deleteProperty(navigator, "wakeLock")
  })

  test("sem suporte do navegador, Tela sempre acesa não liga e diz por quê", async () => {
    const usuario = userEvent.setup()
    renderizar()
    const menu = await abrirEsteAparelho(usuario)
    const chave = menu.getByRole("switch", { name: "Tela sempre acesa" })
    await usuario.click(chave)
    expect(await screen.findByText("Este navegador não deixa a tela acesa.")).toBeInTheDocument()
    expect(chave).toHaveAttribute("aria-checked", "false")
  })

  test("com a aba à vista, não manda notificação", async () => {
    telaGrande()
    const avisos = vi.fn()
    vi.stubGlobal(
      "Notification",
      class {
        static permission = "granted"
        constructor() {
          avisos()
        }
      },
    )
    usePreferenciasFila.setState({ notificar: true, simular: true })
    renderizar(300)
    expect(await screen.findByText("Chegou agora", {}, { timeout: 8000 })).toBeInTheDocument()
    expect(avisos).not.toHaveBeenCalled()
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

  test("acréscimo no prazo: +15 min soma ao prazo dos pedidos novos; tocar de novo tira", async () => {
    const usuario = userEvent.setup()
    renderizar()
    // Pizzaria: entrega em 35–50 min, retirada em 20–30 min.
    expect(await screen.findByText("Entrega 50 min · Retirada 30 min", {}, { timeout: 8000 }))
    const mais15 = screen.getByRole("radio", { name: "+15 min" })

    await usuario.click(mais15)
    expect(await screen.findByText("Entrega 65 min · Retirada 45 min")).toBeInTheDocument()
    expect(mais15).toHaveAttribute("aria-checked", "true")
    expect((await servidorDo("pizzaria").loja()).acrescimoPrazoMin).toBe(15)

    await usuario.click(mais15)
    expect(await screen.findByText("Entrega 50 min · Retirada 30 min")).toBeInTheDocument()
  })

  test("pausar a loja por 15 min mostra até quando e o que o cliente vê; retomar tira", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(
      await screen.findByRole("button", { name: "Pausar pedidos" }, { timeout: 8000 }),
    )
    await usuario.click(await screen.findByRole("menuitem", { name: "Loja toda por 15 min" }))

    expect(await screen.findByText("Loja pausada até 20:45 · 15 min")).toBeInTheDocument()
    expect(screen.getByText("O cliente vê: Loja ocupada, volte às 20:45")).toBeInTheDocument()
    expect((await servidorDo("pizzaria").loja()).pausa?.so).toBe("loja")

    await usuario.click(screen.getByRole("button", { name: "Retomar" }))
    await waitFor(() =>
      expect(screen.queryByText("Loja pausada até 20:45 · 15 min")).not.toBeInTheDocument(),
    )
    expect(screen.getByRole("button", { name: "Pausar pedidos" })).toBeInTheDocument()
  })

  test("no celular, a régua e as ferramentas ficam no Mais; o estado da loja fica à vista", async () => {
    const usuario = userEvent.setup()
    renderizar()
    const mais = await screen.findByRole("button", { name: "Mais" }, { timeout: 8000 })
    expect(mais).toHaveAttribute("aria-expanded", "false")
    expect(await screen.findByRole("button", { name: "Pausar pedidos" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Atrasados/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Este aparelho" })).not.toBeInTheDocument()

    await usuario.click(mais)
    expect(mais).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: /^Atrasados/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Este aparelho" })).toBeInTheDocument()
  })

  test("do tablet em diante, a régua e as ferramentas ficam sempre à vista", async () => {
    telaGrande()
    renderizar()
    expect(
      await screen.findByRole("button", { name: /^Atrasados/ }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Este aparelho" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Mais" })).not.toBeInTheDocument()
  })

  test("os cartões marcam o cliente novo e o freguês da casa", async () => {
    telaGrande()
    renderizar()
    await coluna("Novos")
    await waitFor(
      () => {
        const textos = screen.getAllByRole("article").map((cartao) => cartao.textContent ?? "")
        expect(textos.some((texto) => texto.includes("Cliente frequente"))).toBe(true)
      },
      { timeout: 8000 },
    )
  })

  test("a busca acha pelo nome em todas as colunas e fica no endereço", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    await coluna("Novos")
    const [primeiro] = await servidorDo("pizzaria").pedidos.listar({ status: ["em-preparo"] })
    const nome = primeiro.cliente.nome

    await usuario.type(screen.getByRole("searchbox", { name: "Buscar pedido" }), nome)
    await waitFor(() => {
      const cartoes = screen.getAllByRole("article")
      expect(cartoes.length).toBeGreaterThan(0)
      for (const cartao of cartoes) expect(cartao).toHaveTextContent(nome)
    })
    expect(urlMudou).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: expect.stringContaining("busca=") }),
    )
  })

  test("filtros rápidos: só um canal e só os não pagos", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    await coluna("Novos")

    await usuario.click(screen.getByRole("button", { name: "Entrega" }))
    await waitFor(() => {
      for (const cartao of screen.getAllByRole("article")) {
        expect(within(cartao).getByText("Entrega")).toBeInTheDocument()
      }
    })
    await usuario.click(screen.getByRole("button", { name: "Entrega" }))

    await usuario.click(screen.getByRole("button", { name: "Não pagos" }))
    await waitFor(() => {
      for (const cartao of screen.getAllByRole("article")) {
        expect(cartao).toHaveTextContent(/Cobrar|Aguardando pagamento/)
      }
    })
  })

  test("métricas: tocar em Atrasados mostra só os atrasados; tocar de novo mostra todos", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    const atrasados = await screen.findByRole("button", { name: /^Atrasados/ }, { timeout: 8000 })
    await waitFor(() => expect(screen.getAllByRole("article").length).toBeGreaterThan(0))
    // Os dígitos rolam à parte; o número vai por escrito para o leitor de tela.
    const total = Number(within(atrasados).getByText(/^\d+$/, { selector: ".sr-only" }).textContent)
    expect(total).toBeGreaterThan(0)
    const todos = screen.getAllByRole("article").length

    await usuario.click(atrasados)
    expect(atrasados).toHaveAttribute("aria-pressed", "true")
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(total))
    for (const cartao of screen.getAllByRole("article"))
      expect(cartao).toHaveTextContent(/atrasado/)

    await usuario.click(atrasados)
    expect(atrasados).toHaveAttribute("aria-pressed", "false")
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(todos))
  })

  test("métricas: concluídos e cancelados abrem a gaveta Finalizados hoje", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    expect(
      await screen.findByRole("button", { name: /^Cancelados/ }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.getByText("Preparo médio")).toBeInTheDocument()
    // Aberta, a gaveta é modal: o resto da página sai da árvore de acessibilidade.
    await usuario.click(screen.getByRole("button", { name: /^Concluídos/ }))
    const gaveta = within(await screen.findByRole("dialog", { name: "Finalizados hoje" }))
    expect(gaveta.getByRole("link", { name: "Ver todos em Pedidos" })).toHaveAttribute(
      "href",
      "/admin/pedidos",
    )
  })

  test("Finalizados hoje: reabrir devolve o pedido para Prontos; reimprimir manda o cupom", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    await coluna("Novos")
    await usuario.click(screen.getByRole("button", { name: /^Finalizados hoje/ }))
    const gaveta = within(await screen.findByRole("dialog", { name: "Finalizados hoje" }))
    const linhas = await gaveta.findAllByRole("listitem")
    expect(linhas.length).toBeGreaterThan(0)

    const [reimprimir] = gaveta.getAllByRole("button", { name: /^Reimprimir cupom de #/ })
    await usuario.click(reimprimir)
    expect(imprimir).toHaveBeenCalled()

    const [reabrir] = gaveta.getAllByRole("button", { name: /^Reabrir #/ })
    const numero = (reabrir.getAttribute("aria-label") ?? "").replace("Reabrir ", "")
    await usuario.click(reabrir)
    await usuario.keyboard("{Escape}")
    expect(
      await (await coluna("Prontos")).findByRole("heading", { name: numero }),
    ).toBeInTheDocument()
  })

  test("o aparelho que não escolheu o som usa o som da loja", async () => {
    telaGrande()
    const api = servidorDo("pizzaria")
    await api.salvarLoja({ ...(await api.loja()), som: "suave" })
    renderizar()
    await coluna("Novos")
    const menu = await abrirEsteAparelho()
    expect(menu.getByRole("combobox", { name: "Tipo do alerta" })).toHaveTextContent(
      "Padrão da loja (Suave)",
    )
  })

  test("Modo compacto, neste aparelho: cada pedido vira uma linha que abre ao tocar", async () => {
    telaGrande()
    const usuario = userEvent.setup()
    renderizar()
    await coluna("Novos")
    const menu = await abrirEsteAparelho(usuario)
    await usuario.click(menu.getByRole("switch", { name: "Modo compacto" }))
    await usuario.keyboard("{Escape}")

    expect(usePreferenciasFila.getState().compacto).toBe(true)
    const preparo = await coluna("Em preparo")
    await waitFor(() =>
      expect(preparo.queryAllByRole("button", { expanded: false }).length).toBeGreaterThan(0),
    )
    expect(preparo.queryByRole("button", { name: "Marcar como pronto" })).not.toBeInTheDocument()
  })

  test("Este aparelho reúne o som, os avisos e a demonstração", async () => {
    renderizar()
    const menu = await abrirEsteAparelho()
    for (const nome of [
      "Alerta sonoro",
      "Notificação do sistema",
      "Título da aba piscando",
      "Vibrar",
      "Tela sempre acesa",
      "Simular pedidos chegando",
    ]) {
      expect(menu.getByRole("switch", { name: nome })).toBeInTheDocument()
    }
    expect(menu.getByRole("button", { name: "Testar" })).toBeInTheDocument()
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

    const menu = await abrirEsteAparelho()
    await waitFor(
      () =>
        expect(menu.getByRole("combobox", { name: "Tipo do alerta" })).toHaveTextContent(
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
