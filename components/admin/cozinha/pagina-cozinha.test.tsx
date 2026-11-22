import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear, get, set } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import type { Pedido, Produto } from "@/lib/admin/dados/tipos"
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
    expect(pronto.queryByRole("button")).not.toBeInTheDocument()
    expect(pronto.getByText("Servir na mesa")).toBeInTheDocument()
  })

  test("marcar pronto o ticket da mesa deixa a comanda esperando ser servida", async () => {
    telaGrande()
    const { comanda } = await comandaNaMesa(52)
    await api().pedidos.avancar(comanda.id, "recebido")
    const usuario = userEvent.setup()
    renderizar()

    const preparando = await coluna("Preparando")
    await usuario.click(
      within(await preparando.findByRole("article", { name: /^Mesa 52 ·/ })).getByRole("button", {
        name: "Marcar pronto",
      }),
    )
    await (await coluna("Prontos")).findByRole("article", { name: /^Mesa 52 ·/ })
    expect((await api().pedidos.buscar(comanda.id))?.servirDesde).toBe(
      new Date(2026, 10, 13, 20, 30).toISOString(),
    )
  })

  test("o ticket da comanda de mesas juntadas diz Mesa 50 + 51", async () => {
    telaGrande()
    const { comanda } = await comandaNaMesa(50)
    const outra = await api().mesas.criar({ numero: 51 })
    // A junção entra direto na base guardada: aqui só importa o rótulo do ticket.
    const chave = "clickpedido-admin-dados:pizzaria"
    const guardado = (await get(chave)) as { base: { pedidos: Pedido[] } }
    guardado.base.pedidos = guardado.base.pedidos.map((pedido) =>
      pedido.id === comanda.id && pedido.mesa
        ? { ...pedido, mesa: { ...pedido.mesa, juntadas: [{ id: outra.id, numero: 51 }] } }
        : pedido,
    )
    await set(chave, guardado)
    reiniciarServidores()
    renderizar()

    expect(await ticket("Mesa 50 \\+ 51")).toBeInTheDocument()
  })

  test("rodada nova mostra só os itens novos; o que já foi servido fica à parte", async () => {
    telaGrande()
    const { produto, mesa, comanda } = await comandaNaMesa(51, 1)
    await api().pedidos.avancar(comanda.id, "recebido")
    await api().pedidos.avancar(comanda.id, "em-preparo")
    const [outro] = (await api().produtos.listar()).filter(
      (item) => item.grupos.length === 0 && item.disponivel && item.id !== produto.id,
    )
    await api().mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [{ produtoId: outro.id, escolhas: {}, quantidade: 3 }],
    })
    renderizar()

    const doTicket = within(await ticket("Mesa 51"))
    expect(doTicket.getByRole("list", { name: "Para preparar" })).toHaveTextContent(
      `3× ${outro.nome}`,
    )
    expect(doTicket.getByRole("list", { name: "Para preparar" })).not.toHaveTextContent(
      produto.nome,
    )
    expect(doTicket.getByRole("list", { name: "Já servido" })).toHaveTextContent(
      `1× ${produto.nome}`,
    )
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
