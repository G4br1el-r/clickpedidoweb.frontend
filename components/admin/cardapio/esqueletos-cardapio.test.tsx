import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  EsqueletoCardapio,
  EsqueletoCategorias,
  EsqueletoFormularioProduto,
} from "./esqueletos-cardapio"

describe("EsqueletoCardapio", () => {
  it("avisa o leitor de tela uma vez, no invólucro", () => {
    render(<EsqueletoCardapio />)
    const aviso = screen.getByRole("status", { name: "Carregando o cardápio" })
    expect(aviso).toHaveAttribute("aria-busy", "true")
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })

  it("tem a forma da lista: dois grupos, cada um com título e linhas de produto", () => {
    render(<EsqueletoCardapio />)
    const grupos = screen.getAllByTestId("esqueleto-grupo")
    expect(grupos).toHaveLength(2)
    expect(within(grupos[0]).getAllByTestId("esqueleto-produto")).toHaveLength(5)
    expect(within(grupos[1]).getAllByTestId("esqueleto-produto")).toHaveLength(3)
  })
})

describe("EsqueletoCategorias", () => {
  it("avisa o leitor de tela e mostra seis linhas", () => {
    render(<EsqueletoCategorias />)
    expect(screen.getByRole("status", { name: "Carregando as categorias" })).toBeInTheDocument()
    expect(screen.getAllByTestId("esqueleto-categoria")).toHaveLength(6)
  })
})

describe("EsqueletoFormularioProduto", () => {
  it("avisa o leitor de tela e mostra os campos que vêm", () => {
    render(<EsqueletoFormularioProduto />)
    expect(screen.getByRole("status", { name: "Carregando o produto" })).toBeInTheDocument()
    expect(screen.getAllByTestId("esqueleto-campo").length).toBeGreaterThanOrEqual(4)
  })
})
