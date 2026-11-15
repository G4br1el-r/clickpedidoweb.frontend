import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLojaAtual } from "@/lib/loja-atual"
import { type ItemSacola, useSacola } from "@/lib/sacola"
import { Finalizar } from "./finalizar"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

const FOTO = {
  src: "/foto.jpg",
  width: 800,
  height: 533,
  blurDataURL: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
}

const COLA: ItemSacola = {
  chave: "cola",
  produtoId: "refrigerante-cola",
  nome: "Refrigerante de cola 2L",
  imagem: FOTO,
  precoUnitario: 15,
  quantidade: 2,
  resumo: [],
}

function abrir({
  itens = [COLA],
  hidratada = true,
}: {
  itens?: ItemSacola[]
  hidratada?: boolean
} = {}) {
  useSacola.setState({ itens, hidratada })
  const usuario = userEvent.setup()
  render(
    <TooltipProvider>
      <Finalizar />
    </TooltipProvider>,
  )
  return usuario
}

describe("Finalizar", () => {
  beforeEach(() => {
    useSacola.setState(useSacola.getInitialState(), true)
    useLojaAtual.setState(useLojaAtual.getInitialState(), true)
  })

  test("antes de ler a sacola, espera com o carregador do nicho", () => {
    useLojaAtual.setState({ id: "acougue-sabor-da-carne" })
    abrir({ hidratada: false })

    const espera = screen.getByRole("status", { name: "Afiando as facas" })
    expect(within(espera).getByTestId("carregador-acougue")).toBeInTheDocument()
    expect(screen.queryByRole("form")).not.toBeInTheDocument()
  })

  test("sem itens, mostra o caminho de volta ao cardápio", () => {
    abrir({ itens: [] })

    expect(screen.getByText("Sua sacola está vazia")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ver cardápio" })).toHaveAttribute("href", "/")
  })

  test("abaixo do mínimo, diz quanto falta", () => {
    abrir({ itens: [{ ...COLA, quantidade: 1 }] })

    expect(screen.getByText("Falta pouco para o pedido mínimo")).toBeInTheDocument()
    expect(screen.getByText("Adicione mais R$ 15,00 para finalizar.")).toBeInTheDocument()
  })

  test("com itens, começa no primeiro passo", () => {
    abrir()

    expect(screen.getByRole("heading", { name: "Para quem é o pedido?" })).toBeInTheDocument()
    const passos = screen.getByRole("navigation", { name: "Passos para finalizar o pedido" })
    expect(within(passos).getByRole("button", { current: "step" })).toHaveTextContent("Você")
  })

  test("avançar sem os dados mostra o que falta e fica no mesmo passo", async () => {
    const usuario = abrir()

    await usuario.click(screen.getByTestId("acao-checkout"))

    expect(await screen.findByText("Diga como podemos te chamar")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Para quem é o pedido?" })).toBeInTheDocument()
  })
})
