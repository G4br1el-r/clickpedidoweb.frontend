import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLojaAtual } from "@/lib/loja-atual"
import { type Pedido, useSacola } from "@/lib/sacola"
import { BuscarPedidos } from "./buscar-pedidos"

const roteador = vi.hoisted(() => ({ push: vi.fn(), prefetch: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => roteador }))

/** A busca leva 0,9 s, com o carregador do nicho; com um pedido só, ele aparece e abre em 0,5 s. */
const BUSCA_MS = 900
const ABRIR_MS = 500

function pedido(numero: number, whatsapp: string): Pedido {
  return {
    numero,
    itens: [],
    subtotal: 40,
    taxaEntrega: 8,
    total: 48,
    criadoEm: new Date("2026-11-08T21:00:00-03:00").getTime(),
    cliente: { nome: "Ana", whatsapp },
  }
}

function abrir() {
  const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(
    <TooltipProvider>
      <BuscarPedidos />
    </TooltipProvider>,
  )
  return usuario
}

const campoCelular = () => screen.getByLabelText("Celular (WhatsApp)")
const botaoBuscar = () => screen.getByRole("button", { name: /Ver meu pedido|Procurando/ })

async function buscar(usuario: ReturnType<typeof userEvent.setup>, celular: string) {
  await usuario.type(campoCelular(), celular)
  await usuario.click(botaoBuscar())
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  useLojaAtual.setState({ id: "casa-da-pizza", hidratada: true })
  useSacola.setState(useSacola.getInitialState(), true)
  useSacola.setState({ hidratada: true })
  roteador.push.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("BuscarPedidos", () => {
  test("pede o celular completo, com DDD, antes de procurar", async () => {
    const usuario = abrir()

    await buscar(usuario, "1299876")

    expect(screen.getByText("Digite o celular com DDD, como no pedido.")).toBeInTheDocument()
    expect(botaoBuscar()).toHaveAccessibleName(/Ver meu pedido/)
  })

  test("enquanto procura, mostra o carregador do nicho", async () => {
    useSacola.setState({ pedidos: [pedido(2001, "(12) 99876-5432")] })
    const usuario = abrir()

    await buscar(usuario, "12998765432")

    const procurando = screen.getByRole("status", { name: "Procurando seus pedidos" })
    expect(within(procurando).getByTestId("carregador-pizzaria")).toBeInTheDocument()
    expect(botaoBuscar()).toHaveAccessibleName(/Procurando/)
  })

  test("sem pedidos do número, avisa com a arte do nicho e oferece o WhatsApp da loja", async () => {
    useSacola.setState({ pedidos: [pedido(2001, "(11) 91111-2222")] })
    const usuario = abrir()

    await buscar(usuario, "12998765432")
    act(() => vi.advanceTimersByTime(BUSCA_MS))

    const aviso = screen.getByTestId("sem-pedidos")
    expect(within(aviso).getByText("Nenhum pedido com este celular")).toBeInTheDocument()
    expect(within(aviso).getByTestId("carregador-pizzaria")).toBeInTheDocument()
    expect(within(aviso).getByRole("link", { name: /\(12\) 99888-7766/ })).toHaveAttribute(
      "href",
      "https://wa.me/5512998887766",
    )
    expect(roteador.push).not.toHaveBeenCalled()
  })

  test("com um pedido só, mostra o pedido achado e abre o acompanhamento dele", async () => {
    useSacola.setState({ pedidos: [pedido(2001, "(12) 99876-5432")] })
    const usuario = abrir()

    await buscar(usuario, "12998765432")
    expect(botaoBuscar()).toBeDisabled()
    act(() => vi.advanceTimersByTime(BUSCA_MS))

    expect(screen.getByRole("button", { name: /Pedido nº 2001/ })).toBeInTheDocument()
    expect(roteador.push).not.toHaveBeenCalled()
    expect(botaoBuscar()).toBeDisabled()

    act(() => vi.advanceTimersByTime(ABRIR_MS))
    expect(roteador.push).toHaveBeenCalledWith("/pedido")
    expect(useSacola.getState().ultimoPedido?.numero).toBe(2001)
  })

  test("com vários pedidos, lista para escolher e abre o escolhido", async () => {
    useSacola.setState({
      pedidos: [pedido(2002, "(12) 99876-5432"), pedido(2001, "(12) 99876-5432")],
    })
    const usuario = abrir()

    await buscar(usuario, "12998765432")
    act(() => vi.advanceTimersByTime(BUSCA_MS))

    expect(screen.getByText("2 pedidos encontrados")).toBeInTheDocument()
    expect(roteador.push).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole("button", { name: /Pedido nº 2001/ }))

    expect(roteador.push).toHaveBeenCalledWith("/pedido")
    expect(useSacola.getState().ultimoPedido?.numero).toBe(2001)
  })

  test("cada pedido da lista diz quando foi feito, quantos itens e o total", async () => {
    useSacola.setState({
      pedidos: [pedido(2002, "(12) 99876-5432"), pedido(2001, "(12) 99876-5432")],
    })
    const usuario = abrir()

    await buscar(usuario, "12998765432")
    act(() => vi.advanceTimersByTime(BUSCA_MS))

    const linha = screen.getByRole("button", { name: /Pedido nº 2002/ })
    expect(linha).toHaveTextContent("08/11 às 21:00")
    expect(linha).toHaveTextContent("0 itens")
    expect(linha).toHaveTextContent("R$ 48,00")
  })

  test("quem já pediu neste aparelho encontra o celular preenchido", () => {
    useSacola.setState({
      dadosLembrados: { whatsapp: "(12) 99876-5432" } as never,
    })
    abrir()

    expect(campoCelular()).toHaveValue("(12) 99876-5432")
  })
})
