import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"
import { useLojaAtual } from "@/lib/loja-atual"
import { AcaoCheckout } from "./acao-checkout"

function abrir(props: Partial<React.ComponentProps<typeof AcaoCheckout>> = {}) {
  render(<AcaoCheckout ultimo={false} enviando={false} total={51} testId="acao" {...props} />)
  return screen.getByTestId("acao")
}

describe("AcaoCheckout", () => {
  beforeEach(() => {
    useLojaAtual.setState(useLojaAtual.getInitialState(), true)
  })

  test("nos primeiros passos, continua", () => {
    const botao = abrir()

    expect(botao).toHaveAccessibleName(/^Continuar/)
    expect(botao).toHaveAttribute("type", "submit")
    expect(botao).not.toHaveAttribute("aria-busy")
  })

  test("pode mostrar o total do pedido ao lado", () => {
    const botao = abrir({ mostrarTotal: true })

    expect(within(botao).getAllByText("R$ 51,00").length).toBeGreaterThan(0)
  })

  test("no último passo, envia o pedido com o total à vista", () => {
    const botao = abrir({ ultimo: true })

    expect(botao).toHaveAccessibleName(/^Enviar pedido/)
    expect(within(botao).getAllByText("R$ 51,00").length).toBeGreaterThan(0)
  })

  test("enviando, avisa que está ocupado e mostra o carregador do nicho", () => {
    useLojaAtual.setState({ id: "adega-da-vila" })
    const botao = abrir({ ultimo: true, enviando: true })

    expect(botao).toHaveAccessibleName(/^Enviando/)
    expect(botao).toHaveAttribute("aria-busy", "true")
    expect(within(botao).getByTestId("carregador-adega")).toBeInTheDocument()
  })

  test("pode pertencer a um formulário de fora", () => {
    const botao = abrir({ form: "formulario-checkout" })

    expect(botao).toHaveAttribute("form", "formulario-checkout")
  })
})
