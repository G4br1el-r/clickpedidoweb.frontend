import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useLojaAtual } from "@/lib/loja-atual"
import { useSacola } from "@/lib/sacola"
import { VitrineMesa } from "./vitrine-mesa"

function renderizar(mesaId = "mesa-11", segmento = "pizzaria") {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <VitrineMesa segmento={segmento} mesaId={mesaId} />
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useLojaAtual.setState({ ...useLojaAtual.getInitialState(), id: "adega-da-vila" }, true)
  useSacola.setState(useSacola.getInitialState(), true)
  document.documentElement.dataset.loja = "adega-da-vila"
})

afterEach(() => {
  vi.useRealTimers()
})

describe("VitrineMesa", () => {
  test("a mesa da loja, com o aviso de pagar na mesa e sem entrega nem pagamento online", async () => {
    renderizar()
    expect(await screen.findByRole("heading", { level: 1, name: "Mesa 11" })).toBeInTheDocument()
    expect(screen.getByText("Casa da Pizza")).toBeInTheDocument()
    expect(screen.getByText("Peça daqui e pague na mesa, com o garçom.")).toBeInTheDocument()
    expect(screen.queryByText(/entrega/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pix|cartão online/i)).not.toBeInTheDocument()
  })

  test("veste as cores da loja da mesa sem trocar a loja salva da vitrine nem a sacola", async () => {
    useSacola.getState().adicionar({
      produtoId: "vinho-1",
      nome: "Vinho tinto da adega",
      imagem: { src: "/x.png", width: 1, height: 1 },
      precoUnitario: 80,
      quantidade: 1,
      resumo: [],
    })
    const salva = localStorage.getItem("clickpedido-loja")
    const { unmount } = renderizar()
    await screen.findByRole("heading", { level: 1, name: "Mesa 11" })

    // A Casa da Pizza é a loja padrão: as cores dela são as da raiz, sem `data-loja`.
    expect(document.documentElement.dataset.loja).toBeUndefined()
    expect(useLojaAtual.getState().id).toBe("adega-da-vila")
    expect(localStorage.getItem("clickpedido-loja")).toBe(salva)
    expect(useSacola.getState().itens.map((item) => item.nome)).toEqual(["Vinho tinto da adega"])

    unmount()
    expect(document.documentElement.dataset.loja).toBe("adega-da-vila")
  })

  test("o produto vai para o pedido, e pedir para a mesa espera o garçom aceitar", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("button", { name: "Adicionar Água sem gás" }))
    await usuario.click(screen.getByRole("button", { name: "Adicionar Água sem gás" }))

    const pedido = screen.getByRole("region", { name: "Seu pedido" })
    expect(within(pedido).getByText("Água sem gás")).toBeInTheDocument()
    // A linha do item e o total do pedido.
    expect(within(pedido).getAllByText("R$ 10,00")).toHaveLength(2)

    await usuario.click(within(pedido).getByRole("button", { name: "Pedir para a mesa" }))

    expect(await screen.findByText("Pedido enviado. O garçom vai confirmar.")).toBeInTheDocument()
    expect(within(pedido).queryByText("Água sem gás")).not.toBeInTheDocument()
    const [aguardando] = await servidorDo("pizzaria").pedidosQr.listar()
    expect(aguardando).toMatchObject({ mesaId: "mesa-11", total: 10 })
  })

  test("com o pedido direto, vai para a cozinha", async () => {
    const api = servidorDo("pizzaria")
    const config = await api.salao.config()
    await api.salao.salvar({ ...config, qr: { ...config.qr, aceite: "direto" } })
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("button", { name: "Adicionar Água sem gás" }))
    await usuario.click(screen.getByRole("button", { name: "Pedir para a mesa" }))
    expect(await screen.findByText("Pedido enviado para a cozinha.")).toBeInTheDocument()
  })

  test("chamar o garçom avisa; pedir a conta da mesa sem conta mostra o porquê", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("button", { name: "Chamar o garçom" }))
    expect(await screen.findByText("O garçom já vem.")).toBeInTheDocument()

    await usuario.click(screen.getByRole("button", { name: "Pedir a conta" }))
    expect(await screen.findByText("A mesa ainda não tem conta.")).toBeInTheDocument()
  })

  test("na mesa aberta, ver a conta mostra itens, taxa, couvert e total; pedir a conta avisa", async () => {
    const usuario = userEvent.setup()
    const api = servidorDo("pizzaria")
    const comanda = await api.mesas.lancar({
      mesaId: "mesa-11",
      itens: [{ produtoId: "prod-agua", escolhas: {}, quantidade: 2 }],
      enviarParaCozinha: false,
      garcom: "Rafa",
    })
    renderizar()

    await usuario.click(await screen.findByRole("button", { name: "Ver a conta" }))
    const conta = await screen.findByRole("dialog", { name: "A conta da mesa" })
    const valor = (rotulo: string) => within(conta).getByText(rotulo).nextElementSibling
    // Pizzaria: taxa de 10% e couvert de R$ 8,00 por pessoa (a mesa abriu para 1).
    expect(within(conta).getByText("2× Água sem gás").nextElementSibling).toHaveTextContent(
      "R$ 10,00",
    )
    expect(valor("Itens")).toHaveTextContent("R$ 10,00")
    expect(valor("Taxa de serviço")).toHaveTextContent("R$ 1,00")
    expect(valor("Couvert")).toHaveTextContent("R$ 8,00")
    expect(valor("Total")).toHaveTextContent("R$ 19,00")
    await usuario.keyboard("{Escape}")

    await usuario.click(screen.getByRole("button", { name: "Pedir a conta" }))
    expect(await screen.findByText("A conta foi pedida. O garçom já vem.")).toBeInTheDocument()
    expect((await api.pedidos.buscar(comanda.id))?.contaPedidaEm).toBeDefined()
  })

  test("ver a conta da mesa sem pedidos diz que ainda não há", async () => {
    const usuario = userEvent.setup()
    renderizar()
    await usuario.click(await screen.findByRole("button", { name: "Ver a conta" }))
    expect(await screen.findByText("A mesa ainda não tem pedidos.")).toBeInTheDocument()
  })

  test("a mesa bloqueada e a loja que não existe mostram Mesa indisponível", async () => {
    const { unmount } = renderizar("mesa-20")
    expect(await screen.findByRole("heading", { name: "Mesa indisponível." })).toBeInTheDocument()
    unmount()
    renderizar("mesa-1", "loja-que-nao-existe")
    expect(await screen.findByRole("heading", { name: "Mesa indisponível." })).toBeInTheDocument()
  })
})
