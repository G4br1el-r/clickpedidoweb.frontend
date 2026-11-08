import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { type Pedido, useSacola } from "@/lib/sacola"
import { BuscarPedidos } from "./buscar-pedidos"

const roteador = vi.hoisted(() => ({ push: vi.fn(), prefetch: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => roteador }))
// A animação Lottie do mapa carrega WASM, que não existe no jsdom.
vi.mock("@lottiefiles/dotlottie-react", () => ({
  DotLottieReact: () => null,
  setWasmUrl: () => {},
}))

/** A moto "procura" por 1,4 s; com um pedido só, chega na porta em mais 0,65 s. */
const BUSCA_MS = 1400
const CHEGADA_MS = 650

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

  test("sem pedidos do número, avisa e oferece o WhatsApp da loja", async () => {
    useSacola.setState({ pedidos: [pedido(2001, "(11) 91111-2222")] })
    const usuario = abrir()

    await buscar(usuario, "12998765432")
    act(() => vi.advanceTimersByTime(BUSCA_MS))

    expect(screen.getByText("Nenhum pedido com este celular")).toBeInTheDocument()
    expect(roteador.push).not.toHaveBeenCalled()
  })

  test("com um pedido só, abre o acompanhamento dele", async () => {
    useSacola.setState({ pedidos: [pedido(2001, "(12) 99876-5432")] })
    const usuario = abrir()

    await buscar(usuario, "12998765432")
    expect(botaoBuscar()).toBeDisabled()
    act(() => vi.advanceTimersByTime(BUSCA_MS + CHEGADA_MS))

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

    expect(roteador.push).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole("button", { name: /Pedido nº 2001/ }))

    expect(roteador.push).toHaveBeenCalledWith("/pedido")
    expect(useSacola.getState().ultimoPedido?.numero).toBe(2001)
  })

  test("quem já pediu neste aparelho encontra o celular preenchido", () => {
    useSacola.setState({
      dadosLembrados: { whatsapp: "(12) 99876-5432" } as never,
    })
    abrir()

    expect(campoCelular()).toHaveValue("(12) 99876-5432")
  })
})
