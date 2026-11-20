import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, test } from "vitest"
import { PEDIDOS_DE_TESTE } from "@/lib/admin/regras/pedidos-de-teste"
import { Cupom } from "./cupom"

describe("Cupom", () => {
  test("pedido com bebida alcoólica sai com o aviso de conferir o documento", () => {
    render(
      <Cupom pedido={PEDIDOS_DE_TESTE[2]} loja="Adega da Vila" area={createRef()} maioridade />,
    )
    expect(screen.getByText("+18: conferir documento")).toBeInTheDocument()
  })

  test("sem álcool, sem o aviso", () => {
    render(<Cupom pedido={PEDIDOS_DE_TESTE[2]} loja="Adega da Vila" area={createRef()} />)
    expect(screen.queryByText("+18: conferir documento")).not.toBeInTheDocument()
  })
})
