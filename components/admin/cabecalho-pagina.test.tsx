import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { CabecalhoPagina } from "./cabecalho-pagina"

describe("CabecalhoPagina", () => {
  test("mostra o título da página, o resumo e as ações", () => {
    render(
      <CabecalhoPagina
        titulo="Fila de pedidos"
        resumo="9 em andamento · 1 concluído hoje"
        acoes={<button type="button">Abrir a fila</button>}
      />,
    )

    expect(screen.getByRole("heading", { level: 1, name: "Fila de pedidos" })).toBeInTheDocument()
    expect(screen.getByText("9 em andamento · 1 concluído hoje")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Abrir a fila" })).toBeInTheDocument()
  })

  test("resumo vivo é anunciado ao mudar; o fixo não", () => {
    const { rerender } = render(<CabecalhoPagina titulo="Fila" resumo="2 novos" vivo />)
    expect(screen.getByText("2 novos")).toHaveAttribute("aria-live", "polite")

    rerender(<CabecalhoPagina titulo="Pedidos" resumo="Toque num pedido" />)
    expect(screen.getByText("Toque num pedido")).not.toHaveAttribute("aria-live")
  })

  test("sem resumo nem ações, fica só o título", () => {
    const { container } = render(<CabecalhoPagina titulo="PDV" />)
    expect(screen.getByRole("heading", { level: 1, name: "PDV" })).toBeInTheDocument()
    expect(container.querySelector("p")).toBeNull()
  })
})
