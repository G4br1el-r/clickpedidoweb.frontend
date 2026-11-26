import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AtualizandoLista } from "./atualizando-lista"

describe("AtualizandoLista", () => {
  it("parada, não mostra nada", () => {
    render(<AtualizandoLista atualizando={false} rotulo="Atualizando o cardápio" />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("atualizando, mostra o fio com o rótulo para o leitor de tela", async () => {
    render(<AtualizandoLista atualizando rotulo="Atualizando o cardápio" />)
    expect(
      await screen.findByRole("status", { name: "Atualizando o cardápio" }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("carregador-barra")).toBeInTheDocument()
  })

  it("quando termina, o fio sai da tela", async () => {
    const { rerender } = render(<AtualizandoLista atualizando rotulo="Atualizando o cardápio" />)
    await screen.findByRole("status")
    rerender(<AtualizandoLista atualizando={false} rotulo="Atualizando o cardápio" />)
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument(), {
      timeout: 2000,
    })
  })
})
