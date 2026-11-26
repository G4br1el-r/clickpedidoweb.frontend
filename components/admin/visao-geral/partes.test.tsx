import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { Sequencia } from "../secoes/sequencia"
import { ListaDeFatias, Secao } from "./partes"

describe("Secao", () => {
  test("é uma região com o nome do título, com a descrição e a ação ao lado", () => {
    render(
      <Secao titulo="Canais" descricao="No período" acao={<button type="button">CSV</button>}>
        conteúdo
      </Secao>,
    )
    expect(screen.getByRole("region", { name: "Canais" })).toHaveTextContent("No período")
    expect(screen.getByRole("button", { name: "CSV" })).toBeInTheDocument()
  })

  test("numa aba que entra, a seção sobe na sua vez", () => {
    render(
      <Sequencia>
        <Secao titulo="Hoje">conteúdo</Secao>
      </Sequencia>,
    )
    expect(screen.getByRole("region", { name: "Hoje" })).toHaveClass("entra-bloco")
  })
})

describe("ListaDeFatias", () => {
  const itens = [
    { chave: "a", nome: "Balcão", pedidos: 3, total: 90, percentual: 60 },
    { chave: "b", nome: "Site", pedidos: 2, total: 60, percentual: 40 },
  ]

  test("cada fatia com o nome, o total e a barra", () => {
    render(<ListaDeFatias itens={itens} vazio="Nada" />)
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByRole("progressbar", { name: "Balcão: 60%" })).toBeInTheDocument()
  })

  test("as fatias chegam uma depois da outra, sem pular", () => {
    render(<ListaDeFatias itens={itens} vazio="Nada" />)
    const [primeira, segunda] = screen.getAllByRole("listitem")
    expect(primeira).toHaveClass("entra-item")
    expect(primeira.style.getPropertyValue("--atraso")).toBe("0s")
    expect(segunda.style.getPropertyValue("--atraso")).toBe("0.04s")
  })

  test("vazia, diz o motivo", () => {
    render(<ListaDeFatias itens={[]} vazio="Nada por aqui" />)
    expect(screen.getByText("Nada por aqui")).toBeInTheDocument()
  })
})
