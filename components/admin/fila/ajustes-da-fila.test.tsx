import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { AjustesDaFila } from "./ajustes-da-fila"

function renderizar() {
  return render(
    <AjustesDaFila resumo="Loja aberta · Entrega · Som ligado">
      <label>
        Alerta sonoro
        <input type="checkbox" />
      </label>
    </AjustesDaFila>,
  )
}

describe("AjustesDaFila", () => {
  it("mostra num botão o estado dos ajustes, sem abrir nada", () => {
    renderizar()
    const botao = screen.getByRole("button", { name: /Ajustes da fila/ })
    expect(botao).toHaveTextContent("Loja aberta · Entrega · Som ligado")
    expect(botao).toHaveAttribute("aria-expanded", "false")
  })

  it("os controles continuam na página, para quem usa leitor de tela e para a tela grande", () => {
    renderizar()
    expect(screen.getByLabelText("Alerta sonoro")).toBeInTheDocument()
  })

  it("o botão abre e fecha o painel", async () => {
    renderizar()
    const botao = screen.getByRole("button", { name: /Ajustes da fila/ })
    await userEvent.click(botao)
    expect(botao).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByTestId("ajustes-da-fila")).toHaveAttribute("data-aberto", "true")
    await userEvent.click(botao)
    expect(botao).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByTestId("ajustes-da-fila")).toHaveAttribute("data-aberto", "false")
  })

  it("o botão aponta para o painel que controla", () => {
    renderizar()
    const botao = screen.getByRole("button", { name: /Ajustes da fila/ })
    expect(botao.getAttribute("aria-controls")).toBe(
      screen.getByTestId("ajustes-da-fila").getAttribute("id"),
    )
  })

  it("fechado, o painel some para o teclado no celular", () => {
    renderizar()
    expect(screen.getByTestId("ajustes-da-fila")).toHaveAttribute("data-aberto", "false")
    expect(screen.getByTestId("ajustes-da-fila").className).toContain("max-md:invisible")
  })
})
