import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import AdminTemplate from "./template"

describe("AdminTemplate", () => {
  it("mostra a página dentro do invólucro de entrada", () => {
    render(
      <AdminTemplate>
        <h1>Fila de pedidos</h1>
      </AdminTemplate>,
    )
    const titulo = screen.getByRole("heading", { level: 1, name: "Fila de pedidos" })
    expect(titulo.parentElement).toHaveClass("pagina-admin-entra")
  })

  it("o invólucro ocupa a altura toda, como a página que ele guarda", () => {
    render(
      <AdminTemplate>
        <h1>Pedidos</h1>
      </AdminTemplate>,
    )
    expect(screen.getByRole("heading", { name: "Pedidos" }).parentElement).toHaveClass(
      "flex",
      "flex-1",
      "flex-col",
    )
  })
})
