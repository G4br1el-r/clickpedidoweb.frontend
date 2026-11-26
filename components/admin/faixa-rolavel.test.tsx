import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FaixaRolavel } from "./faixa-rolavel"

function medir(elemento: HTMLElement, { rolagem, largura, visivel }: Record<string, number>) {
  Object.defineProperty(elemento, "scrollLeft", { value: rolagem, configurable: true })
  Object.defineProperty(elemento, "scrollWidth", { value: largura, configurable: true })
  Object.defineProperty(elemento, "clientWidth", { value: visivel, configurable: true })
  fireEvent.scroll(elemento)
}

/** jsdom não mede nada: a faixa vai de 0 a 300 px e cada item marcado fica onde o teste disser. */
function posicionar(itens: Record<string, { left: number; width: number }>) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const nome = this.getAttribute("aria-label") ?? this.textContent?.trim() ?? ""
    const item = itens[nome]
    return (item ?? { left: 0, width: 300 }) as DOMRect
  })
}

describe("FaixaRolavel", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("mostra o que está dentro", () => {
    render(
      <FaixaRolavel>
        <button type="button">Resumo</button>
        <button type="button">Vendas</button>
      </FaixaRolavel>,
    )
    expect(screen.getByRole("button", { name: "Resumo" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Vendas" })).toBeInTheDocument()
  })

  it("quando tudo cabe, não esmaece nenhuma borda", () => {
    render(<FaixaRolavel>conteúdo</FaixaRolavel>)
    const faixa = screen.getByTestId("faixa-rolavel")
    medir(faixa, { rolagem: 0, largura: 300, visivel: 300 })
    expect(faixa).toHaveAttribute("data-mais-esquerda", "false")
    expect(faixa).toHaveAttribute("data-mais-direita", "false")
  })

  it("no começo, só a borda direita esmaece: há mais para ver ali", () => {
    render(<FaixaRolavel>conteúdo</FaixaRolavel>)
    const faixa = screen.getByTestId("faixa-rolavel")
    medir(faixa, { rolagem: 0, largura: 600, visivel: 300 })
    expect(faixa).toHaveAttribute("data-mais-esquerda", "false")
    expect(faixa).toHaveAttribute("data-mais-direita", "true")
  })

  it("no meio, as duas bordas esmaecem", () => {
    render(<FaixaRolavel>conteúdo</FaixaRolavel>)
    const faixa = screen.getByTestId("faixa-rolavel")
    medir(faixa, { rolagem: 120, largura: 600, visivel: 300 })
    expect(faixa).toHaveAttribute("data-mais-esquerda", "true")
    expect(faixa).toHaveAttribute("data-mais-direita", "true")
  })

  it("no fim, só a borda esquerda esmaece", () => {
    render(<FaixaRolavel>conteúdo</FaixaRolavel>)
    const faixa = screen.getByTestId("faixa-rolavel")
    medir(faixa, { rolagem: 300, largura: 600, visivel: 300 })
    expect(faixa).toHaveAttribute("data-mais-esquerda", "true")
    expect(faixa).toHaveAttribute("data-mais-direita", "false")
  })

  it("leva a aba marcada ao meio da faixa rolando só a faixa, nunca a página", () => {
    posicionar({ Financeiro: { left: 500, width: 100 } })
    const daFaixa = vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => {})
    const daPagina = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {})
    render(
      <FaixaRolavel>
        <button type="button" role="tab" aria-selected="false">
          Resumo
        </button>
        <button type="button" role="tab" aria-selected="true">
          Financeiro
        </button>
      </FaixaRolavel>,
    )
    // A faixa tem 300 px (meio em 150) e a aba está com o meio em 550: anda 400 px.
    expect(daFaixa).toHaveBeenCalledWith({ left: 400, behavior: "smooth" })
    expect(daFaixa.mock.contexts[0]).toBe(screen.getByTestId("faixa-rolavel"))
    expect(daPagina).not.toHaveBeenCalled()
  })

  it("leva também a opção marcada de um grupo de filtros", () => {
    posicionar({ "30 dias": { left: 340, width: 60 } })
    const daFaixa = vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => {})
    render(
      <FaixaRolavel>
        <input type="radio" aria-label="Hoje" aria-checked="false" readOnly />
        <input type="radio" aria-label="30 dias" aria-checked="true" readOnly />
      </FaixaRolavel>,
    )
    expect(daFaixa).toHaveBeenCalledWith({ left: 220, behavior: "smooth" })
  })

  it("sem item marcado, não rola nada", () => {
    const daFaixa = vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => {})
    render(<FaixaRolavel>conteúdo</FaixaRolavel>)
    expect(daFaixa).not.toHaveBeenCalled()
  })

  it("não deixa a barra de rolagem aparecer", () => {
    render(<FaixaRolavel>conteúdo</FaixaRolavel>)
    expect(screen.getByTestId("faixa-rolavel").className).toContain("[scrollbar-width:none]")
  })
})
