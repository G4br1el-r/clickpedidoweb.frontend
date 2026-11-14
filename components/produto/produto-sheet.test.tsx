import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLojaAtual } from "@/lib/loja-atual"
import { cardapioDrogariaBemEstar } from "@/lib/mock/drogaria-bem-estar"
import { useSacola } from "@/lib/sacola"
import { ProdutoSheet } from "./produto-sheet"

const produto = (id: string) => {
  const achado = cardapioDrogariaBemEstar
    .flatMap((categoria) => categoria.produtos)
    .find((item) => item.id === id)
  if (!achado) throw new Error(`Produto ${id} não existe`)
  return achado
}

function abrir(id: string) {
  render(
    <TooltipProvider>
      <ProdutoSheet produto={produto(id)} aberto aoMudar={() => {}} />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  useLojaAtual.setState({ id: "drogaria-bem-estar", hidratada: true })
  useSacola.setState({ ...useSacola.getInitialState(), hidratada: true }, true)
})

describe("ProdutoSheet na farmácia", () => {
  test("mostra a ficha do remédio e leva para a sacola marcado para pedir a receita", async () => {
    abrir("amoxicilina-500")
    expect(await screen.findByText("Amoxicilina tri-hidratada")).toBeInTheDocument()
    expect(screen.getByText("Retém a receita")).toBeInTheDocument()
    await userEvent.setup().click(screen.getByTestId("cta-adicionar"))
    expect(useSacola.getState().itens[0]).toMatchObject({
      produtoId: "amoxicilina-500",
      venda: "receita-retida",
    })
  })

  test("controlado não tem como adicionar", async () => {
    abrir("clonazepam-2")
    expect(await screen.findByText(/a lei não permite venda pela internet/)).toBeInTheDocument()
    expect(screen.getByTestId("cta-adicionar")).toBeDisabled()
    expect(screen.getByTestId("cta-adicionar")).toHaveTextContent("Só no balcão")
  })
})
