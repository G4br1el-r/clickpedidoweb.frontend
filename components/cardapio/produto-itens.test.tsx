import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cardapioDrogariaBemEstar } from "@/lib/mock/drogaria-bem-estar"
import { useSacola } from "@/lib/sacola"
import { ProdutoLinha } from "./produto-itens"

const produto = (id: string) =>
  cardapioDrogariaBemEstar.flatMap((categoria) => categoria.produtos).find((item) => item.id === id)

beforeEach(() => {
  useSacola.setState({ ...useSacola.getInitialState(), hidratada: true }, true)
})

describe("ProdutoLinha na farmácia", () => {
  test("o cartão do remédio mostra a tarja e se pede receita", () => {
    const amoxicilina = produto("amoxicilina-500")
    const protetor = produto("protetor-50")
    if (!amoxicilina || !protetor) throw new Error("produto não existe")
    render(
      <TooltipProvider>
        <ProdutoLinha produto={amoxicilina} aoAbrir={() => {}} />
        <ProdutoLinha produto={protetor} aoAbrir={() => {}} />
      </TooltipProvider>,
    )
    const remedio = within(screen.getByTestId("produto-amoxicilina-500"))
    expect(remedio.getByText("Tarja vermelha")).toBeInTheDocument()
    expect(remedio.getByText("Retém a receita")).toBeInTheDocument()
    expect(
      within(screen.getByTestId("produto-protetor-50")).queryByText(/Tarja|receita/),
    ).not.toBeInTheDocument()
  })
})
