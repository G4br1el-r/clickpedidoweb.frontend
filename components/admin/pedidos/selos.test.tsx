import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { rotuloSituacao, SeloStatus } from "./selos"

describe("rotuloSituacao", () => {
  test("pago e depois cancelado: a loja deve devolver", () => {
    expect(rotuloSituacao("estorno-pendente")).toBe("Estorno pendente")
  })
})

describe("SeloStatus", () => {
  test("escreve o status com o nome do tipo e marca o tom no traço", () => {
    const { container } = render(<SeloStatus pedido={{ tipo: "mesa", status: "pronto" }} />)

    expect(screen.getByText("Pronto para servir")).toBeInTheDocument()
    const traco = container.querySelector("[data-traco]")
    expect(traco).toHaveAttribute("data-tom", "pronto")
    expect(traco).toHaveAttribute("aria-hidden", "true")
  })

  test("pedido novo pede ação; cancelado fica com o tom de perigo", () => {
    const { container, rerender } = render(
      <SeloStatus pedido={{ tipo: "entrega", status: "recebido" }} />,
    )
    expect(container.querySelector("[data-traco]")).toHaveAttribute("data-tom", "novo")

    rerender(<SeloStatus pedido={{ tipo: "entrega", status: "cancelado" }} />)
    expect(screen.getByText("Cancelado")).toBeInTheDocument()
    expect(container.querySelector("[data-traco]")).toHaveAttribute("data-tom", "cancelado")
  })
})
