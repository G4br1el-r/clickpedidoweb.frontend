import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { EsqueletoCartoes, EsqueletoLista, EsqueletoPagina, EsqueletoRegua } from "./esqueletos"

describe("EsqueletoLista", () => {
  it("anuncia que a lista está carregando", () => {
    render(<EsqueletoLista rotulo="Carregando pedidos" />)
    expect(screen.getByRole("status", { name: "Carregando pedidos" })).toHaveAttribute(
      "aria-busy",
      "true",
    )
  })

  it("desenha a quantidade de linhas pedida", () => {
    render(<EsqueletoLista linhas={4} />)
    expect(screen.getAllByTestId("esqueleto-linha")).toHaveLength(4)
  })

  it("sem quantidade, desenha seis linhas", () => {
    render(<EsqueletoLista />)
    expect(screen.getAllByTestId("esqueleto-linha")).toHaveLength(6)
  })

  it("cada linha entra um pouco depois da anterior", () => {
    render(<EsqueletoLista linhas={3} />)
    const linhas = screen.getAllByTestId("esqueleto-linha")
    expect(linhas[0]).toHaveStyle({ animationDelay: "0s" })
    expect(linhas[2]).toHaveStyle({ animationDelay: "0.12s" })
  })
})

describe("EsqueletoCartoes", () => {
  it("desenha a quantidade de cartões pedida", () => {
    render(<EsqueletoCartoes quantidade={3} />)
    expect(screen.getAllByTestId("esqueleto-cartao")).toHaveLength(3)
  })

  it("anuncia o carregamento", () => {
    render(<EsqueletoCartoes rotulo="Carregando a fila" />)
    expect(screen.getByRole("status", { name: "Carregando a fila" })).toBeInTheDocument()
  })
})

describe("EsqueletoRegua", () => {
  it("desenha um bloco de número para cada indicador", () => {
    render(<EsqueletoRegua quantidade={4} />)
    expect(screen.getAllByTestId("esqueleto-indicador")).toHaveLength(4)
  })
})

describe("EsqueletoPagina", () => {
  it("monta cabeçalho e lista, com um único aviso de carregamento", () => {
    render(<EsqueletoPagina rotulo="Carregando a página" />)
    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(screen.getByRole("status", { name: "Carregando a página" })).toBeInTheDocument()
    expect(screen.getByTestId("esqueleto-cabecalho")).toBeInTheDocument()
    expect(screen.getAllByTestId("esqueleto-linha").length).toBeGreaterThan(0)
  })
})
