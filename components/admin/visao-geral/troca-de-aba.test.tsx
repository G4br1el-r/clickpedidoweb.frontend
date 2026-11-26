import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { Etapa } from "../secoes/sequencia"
import { TrocaDeAba } from "./troca-de-aba"

const conteudo = (aba: string) => (
  <TrocaDeAba chave={aba}>
    <p>Conteúdo de {aba}</p>
  </TrocaDeAba>
)

describe("TrocaDeAba", () => {
  test("na primeira vez o conteúdo já está na tela, sem esperar o fade", () => {
    render(conteudo("resumo"))
    expect(screen.getByText("Conteúdo de resumo").parentElement).not.toHaveStyle({ opacity: "0" })
  })

  test("a aba antiga sai e a nova entra no lugar dela", async () => {
    const { rerender } = render(conteudo("resumo"))
    rerender(conteudo("vendas"))
    expect(await screen.findByText("Conteúdo de vendas")).toBeInTheDocument()
    expect(screen.queryByText("Conteúdo de resumo")).not.toBeInTheDocument()
  })

  test("a aba nova chega aparecendo, de transparente a visível", async () => {
    const { rerender } = render(conteudo("resumo"))
    rerender(conteudo("vendas"))
    const nova = (await screen.findByText("Conteúdo de vendas")).parentElement as HTMLElement
    await waitFor(() => expect(nova).toHaveStyle({ opacity: "1" }))
  })

  test("só uma aba fica montada por vez depois da troca", async () => {
    const { rerender } = render(conteudo("resumo"))
    rerender(conteudo("vendas"))
    await screen.findByText("Conteúdo de vendas")
    expect(screen.getAllByText(/Conteúdo de/)).toHaveLength(1)
  })
})

describe("TrocaDeAba com etapas", () => {
  test("as seções da aba nova sobem em sequência depois da troca", () => {
    // A entrada é do CSS: as seções já estão no documento e levam a classe que as faz subir.
    const aba = (nome: string) => (
      <TrocaDeAba chave={nome}>
        <Etapa como="section">Seção A de {nome}</Etapa>
        <Etapa como="section">Seção B de {nome}</Etapa>
      </TrocaDeAba>
    )
    const { rerender } = render(aba("resumo"))
    rerender(aba("vendas"))
    expect(screen.getByText("Seção A de vendas")).toHaveClass("entra-bloco")
    expect(screen.getByText("Seção B de vendas")).toHaveClass("entra-bloco")
  })
})

describe("TrocaDeAba sem esperar a saída", () => {
  test("a aba nova está na tela no mesmo instante e a antiga já saiu", () => {
    const { rerender } = render(conteudo("resumo"))
    rerender(conteudo("vendas"))
    // Esperar a saída da antiga prendia a aba nova quando o relógio da página estava parado.
    expect(screen.getByText("Conteúdo de vendas")).toBeInTheDocument()
    expect(screen.queryByText("Conteúdo de resumo")).not.toBeInTheDocument()
  })
})
