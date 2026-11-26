import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { BotaoImprimir } from "./botao-imprimir"

describe("BotaoImprimir", () => {
  test("pronto, chama a impressão ao clicar", async () => {
    const aoClicar = vi.fn()
    render(<BotaoImprimir imprimindo={false} aoClicar={aoClicar} />)
    await userEvent.click(screen.getByRole("button", { name: "Imprimir" }))
    expect(aoClicar).toHaveBeenCalledOnce()
  })

  test("sem dados ainda, fica desligado", () => {
    render(<BotaoImprimir imprimindo={false} desabilitado aoClicar={() => {}} />)
    expect(screen.getByRole("button", { name: "Imprimir" })).toBeDisabled()
  })

  test("imprimindo, o papel sai da impressora, o botão ocupa e não aceita outro clique", () => {
    render(<BotaoImprimir imprimindo aoClicar={() => {}} />)
    const botao = screen.getByRole("button", { name: /Imprimir/ })
    expect(botao).toHaveAttribute("aria-busy", "true")
    expect(botao).toBeDisabled()
    expect(screen.getByTestId("carregador-papel")).toBeInTheDocument()
  })

  test("o botão tem 44 px de altura no celular", () => {
    render(<BotaoImprimir imprimindo={false} aoClicar={() => {}} />)
    expect(screen.getByRole("button", { name: "Imprimir" })).toHaveClass("max-md:min-h-11")
  })
})
