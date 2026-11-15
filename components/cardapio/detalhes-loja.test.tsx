import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLojaAtual } from "@/lib/loja-atual"
import { DetalhesLoja } from "./detalhes-loja"

beforeEach(() => {
  useLojaAtual.setState(useLojaAtual.getInitialState(), true)
})

describe("A loja", () => {
  test("dá para ligar e abrir o endereço no mapa direto do painel", () => {
    render(
      <TooltipProvider>
        <DetalhesLoja aberto aoMudar={() => {}} />
      </TooltipProvider>,
    )
    expect(screen.getByRole("link", { name: "Ligar para a loja" })).toHaveAttribute(
      "href",
      "tel:+5512998887766",
    )
    const mapa = screen.getByRole("link", { name: "Ver no mapa" })
    expect(mapa).toHaveAttribute("href", expect.stringContaining("google.com/maps/search"))
    expect(mapa).toHaveAttribute("target", "_blank")
    expect(mapa).toHaveAttribute("rel", "noopener noreferrer")
  })

  test("o botão de fechar é um alvo de toque de verdade, com nome", () => {
    render(
      <TooltipProvider>
        <DetalhesLoja aberto aoMudar={() => {}} />
      </TooltipProvider>,
    )
    expect(screen.getByRole("button", { name: "Fechar informações" })).toHaveAttribute(
      "data-fechar-painel",
    )
  })
})
