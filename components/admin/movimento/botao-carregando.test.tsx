import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { BotaoCarregando } from "./botao-carregando"

describe("BotaoCarregando", () => {
  it("parado, é um botão comum", async () => {
    const aoClicar = vi.fn()
    render(<BotaoCarregando onClick={aoClicar}>Salvar</BotaoCarregando>)
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }))
    expect(aoClicar).toHaveBeenCalledOnce()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("carregando, mostra os pontos e avisa que está ocupado", () => {
    render(<BotaoCarregando carregando>Salvar</BotaoCarregando>)
    const botao = screen.getByRole("button", { name: /Salvar/ })
    expect(botao).toHaveAttribute("aria-busy", "true")
    expect(screen.getByRole("status", { name: "Salvando" })).toBeInTheDocument()
  })

  it("carregando, não aceita outro clique", async () => {
    const aoClicar = vi.fn()
    render(
      <BotaoCarregando carregando onClick={aoClicar}>
        Salvar
      </BotaoCarregando>,
    )
    await userEvent.click(screen.getByRole("button", { name: /Salvar/ }))
    expect(aoClicar).not.toHaveBeenCalled()
  })

  it("mantém o texto do botão: a largura não muda quando carrega", () => {
    render(<BotaoCarregando carregando>Salvar produto</BotaoCarregando>)
    expect(screen.getByText("Salvar produto")).toBeInTheDocument()
  })

  it("usa o texto de `rotuloCarregando` no aviso", () => {
    render(
      <BotaoCarregando carregando rotuloCarregando="Imprimindo o cupom">
        Imprimir
      </BotaoCarregando>,
    )
    expect(screen.getByRole("status", { name: "Imprimindo o cupom" })).toBeInTheDocument()
  })

  it("cada ação tem o seu carregador: imprimir usa o papel, não os pontos", () => {
    const { container } = render(
      <BotaoCarregando carregando carregador="papel" rotuloCarregando="Imprimindo o cupom">
        Imprimir
      </BotaoCarregando>,
    )
    expect(container.querySelector("svg title")).toHaveTextContent("Impressora")
    expect(screen.getByRole("status", { name: "Imprimindo o cupom" })).toBeInTheDocument()
  })

  it("sem escolha, usa os pontos", () => {
    const { container } = render(<BotaoCarregando carregando>Salvar</BotaoCarregando>)
    expect(container.querySelector("svg")).toBeNull()
  })

  it("respeita o disabled mesmo sem carregar", async () => {
    const aoClicar = vi.fn()
    render(
      <BotaoCarregando disabled onClick={aoClicar}>
        Salvar
      </BotaoCarregando>,
    )
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled()
  })
})

describe("BotaoCarregando e o nome do botão", () => {
  it("o nome do botão não muda enquanto carrega: o aviso fica ao lado, não dentro", () => {
    render(<BotaoCarregando carregando>Marcar pronto</BotaoCarregando>)
    expect(screen.getByRole("button", { name: "Marcar pronto" })).toBeInTheDocument()
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })
})
