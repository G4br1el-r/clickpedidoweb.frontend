import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FioDeAtualizacao } from "./fio-de-atualizacao"

describe("FioDeAtualizacao", () => {
  it("atualizando, anuncia o que está acontecendo", () => {
    render(<FioDeAtualizacao ativo rotulo="Atualizando o estoque" />)
    expect(screen.getByRole("status", { name: "Atualizando o estoque" })).toBeInTheDocument()
  })

  it("parado, não mostra nada", () => {
    render(<FioDeAtualizacao ativo={false} rotulo="Atualizando o estoque" />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("quando termina, o fio some depois do fade", async () => {
    const { rerender } = render(<FioDeAtualizacao ativo rotulo="Atualizando os lotes" />)
    rerender(<FioDeAtualizacao ativo={false} rotulo="Atualizando os lotes" />)
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument())
  })

  it("reserva a altura do fio mesmo parado, para a lista não pular", () => {
    const { container } = render(<FioDeAtualizacao ativo={false} rotulo="x" />)
    expect(container.firstElementChild?.className).toContain("h-0.5")
  })
})
