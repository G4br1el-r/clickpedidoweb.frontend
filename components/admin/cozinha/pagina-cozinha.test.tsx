import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import type { Produto } from "@/lib/admin/dados/tipos"
import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaCozinha } from "./pagina-cozinha"

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

function renderizar(intervalo = 60_000) {
  return render(
    <Provedores>
      <PaginaCozinha intervalo={intervalo} />
    </Provedores>,
  )
}

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
