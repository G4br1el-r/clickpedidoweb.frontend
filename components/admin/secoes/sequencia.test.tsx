import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { Etapa, Sequencia } from "./sequencia"

describe("Sequencia e Etapa", () => {
  test("a etapa fora de uma sequência já aparece inteira, sem esperar ninguém", () => {
    render(<Etapa como="section">Marca</Etapa>)
    expect(screen.getByText("Marca")).not.toHaveStyle({ opacity: "0" })
  })

  test("a sequência marca as etapas para o CSS entrar uma depois da outra", () => {
    const { container } = render(
      <Sequencia>
        <Etapa como="section">Cores</Etapa>
        <Etapa como="section">Fontes</Etapa>
      </Sequencia>,
    )
    expect(container.firstElementChild).toHaveClass("sequencia-admin")
    expect(screen.getByText("Cores")).toHaveClass("entra-bloco")
    expect(screen.getByText("Fontes")).toHaveClass("entra-bloco")
    // A entrada é do CSS: o conteúdo já está no documento, visível para quem lê a tela.
    expect(screen.getByText("Cores")).toHaveStyle({ opacity: "1" })
  })

  test("usa o elemento pedido em `como`", () => {
    render(
      <Sequencia como="ul">
        <Etapa como="li">Item</Etapa>
      </Sequencia>,
    )
    expect(screen.getByRole("list")).toBeInTheDocument()
    expect(screen.getByRole("listitem")).toHaveTextContent("Item")
  })

  test("repassa a classe", () => {
    render(
      <Sequencia className="flex" data-testid="seq">
        <Etapa className="p-2">a</Etapa>
      </Sequencia>,
    )
    expect(screen.getByTestId("seq")).toHaveClass("flex")
    expect(screen.getByText("a")).toHaveClass("p-2")
  })
})
