import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLojaAtual } from "@/lib/loja-atual"
import { CabecalhoLoja } from "./cabecalho-loja"
import { RodapeLoja } from "./rodape-loja"

beforeEach(() => {
  useLojaAtual.setState(useLojaAtual.getInitialState(), true)
})

describe("vitrine da loja escolhida", () => {
  test("o cabeçalho e o rodapé mostram a loja escolhida no topo e trocam junto", () => {
    render(
      // No app, o TooltipProvider vem dos provedores da raiz.
      <TooltipProvider>
        <CabecalhoLoja aoVerDetalhes={() => {}} termo="" aoBuscar={() => {}} />
        <RodapeLoja />
      </TooltipProvider>,
    )
    expect(screen.getByRole("heading", { level: 1, name: "Casa da Pizza" })).toBeInTheDocument()

    act(() => useLojaAtual.getState().escolher("drogaria-bem-estar"))

    expect(
      screen.getByRole("heading", { level: 1, name: "Drogaria Bem Estar" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Cuidado de verdade, perto de você")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Logo da Drogaria Bem Estar" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "(12) 98877-6655" })).toHaveAttribute(
      "href",
      "tel:+5512988776655",
    )
  })
})
