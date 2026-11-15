import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"
import { useLojaAtual } from "@/lib/loja-atual"
import { CardapioSkeleton } from "./cardapio-skeleton"

beforeEach(() => {
  useLojaAtual.setState(useLojaAtual.getInitialState(), true)
})

describe("espera do cardápio", () => {
  test("a pizzaria espera com o próprio carregador e a frase do ofício", () => {
    render(<CardapioSkeleton />)
    const espera = screen.getByRole("status", { name: "Carregando cardápio" })
    expect(espera).toHaveTextContent("Acendendo o forno")
    expect(screen.getByTestId("carregador-pizzaria")).toBeInTheDocument()
  })

  test("a farmácia espera com o carregador dela", () => {
    useLojaAtual.setState({ id: "drogaria-bem-estar" })
    render(<CardapioSkeleton />)
    expect(screen.getByText("Organizando as prateleiras")).toBeInTheDocument()
    expect(screen.getByTestId("carregador-farmacia")).toBeInTheDocument()
  })
})
