import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, test } from "vitest"
import { PEDIDOS_DE_TESTE } from "@/lib/admin/regras/pedidos-de-teste"
import { Cupom, pedidoDeTeste } from "./cupom"

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

describe("Cupom: vias", () => {
  test("produção: o que fazer, sem preço nem cobrança, com a observação em destaque", () => {
    const pedido = {
      ...pedidoDeTeste(new Date(2026, 10, 13, 20, 30)),
      observacao: "Tocar o interfone",
    }
    render(<Cupom pedido={pedido} loja="Casa da Pizza" area={createRef()} via="producao" />)
    expect(screen.getByText("PRODUÇÃO")).toBeInTheDocument()
    expect(screen.getByText("2x Item de teste")).toBeInTheDocument()
    expect(screen.getByText("Obs.: sem cebola")).toBeInTheDocument()
    expect(screen.getByText("OBS. DO PEDIDO: Tocar o interfone")).toBeInTheDocument()
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/COBRAR|PAGO/)).not.toBeInTheDocument()
  })

  test("cliente e entregador: preços, cobrança e troco", () => {
    render(
      <Cupom
        pedido={pedidoDeTeste(new Date(2026, 10, 13, 20, 30))}
        loja="Casa da Pizza"
        area={createRef()}
        via="cliente"
      />,
    )
    expect(screen.getByText("CLIENTE E ENTREGADOR")).toBeInTheDocument()
    expect(screen.getByText(/COBRAR/)).toBeInTheDocument()
  })
})
