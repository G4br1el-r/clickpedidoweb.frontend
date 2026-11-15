import { act, render, screen } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { usePrevia } from "./estado"
import { MarcaFoco } from "./marca-foco"

/** Uma tela de prévia mínima: o banner existe; o bloco de ofertas, não (desligado). */
function Previa() {
  const tela = useRef<HTMLDivElement>(null)
  return (
    <div className="relative">
      <div ref={tela} data-testid="tela">
        <section data-alvo="bloco:promocional">Banner</section>
      </div>
      <MarcaFoco tela={tela} />
    </div>
  )
}

beforeEach(() => {
  usePrevia.setState(usePrevia.getInitialState(), true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("MarcaFoco", () => {
  test("sem foco, não mostra nada", () => {
    render(<Previa />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  test("com foco num pedaço da tela, diz onde está mexendo e leva até ele", () => {
    const rolar = vi.fn()
    Element.prototype.scrollTo = rolar
    render(<Previa />)
    act(() =>
      usePrevia.getState().focar({
        alvo: "bloco:promocional",
        secao: "Página inicial",
        rotulo: "Banner promocional",
      }),
    )
    expect(screen.getByRole("status")).toHaveTextContent("Página inicial: Banner promocional")
    expect(screen.getByTestId("contorno-foco")).toBeInTheDocument()
    expect(rolar).toHaveBeenCalled()
  })

  test("rola o pedaço para logo abaixo do aviso do topo, na escala da prévia", () => {
    const rolar = vi.fn()
    Element.prototype.scrollTo = rolar
    // A tela tem 800 px de altura de verdade e aparece com 400: está na metade do tamanho.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(800)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      const top = this.dataset.alvo ? 400 : 100
      return { top, left: 0, width: 200, height: 400, right: 200, bottom: top + 400 } as DOMRect
    })
    render(<Previa />)
    act(() =>
      usePrevia.getState().focar({
        alvo: "bloco:promocional",
        secao: "Página inicial",
        rotulo: "Banner promocional",
      }),
    )
    // O banner está 300 px (na tela) abaixo do topo: 600 px na tela de verdade. Fica 80 px
    // (na tela) abaixo do topo, o espaço do aviso: 160 px de verdade. 600 − 160 = 440.
    expect(rolar).toHaveBeenLastCalledWith({ top: 440, behavior: "smooth" })
  })

  test("item que não aparece na tela explica o porquê, sem contorno", () => {
    render(<Previa />)
    act(() =>
      usePrevia.getState().focar({
        alvo: "bloco:ofertas",
        secao: "Página inicial",
        rotulo: "Ofertas do dia",
        desligado: true,
      }),
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ofertas do dia está desligado e não aparece na loja",
    )
    expect(screen.queryByTestId("contorno-foco")).not.toBeInTheDocument()
  })

  test("item que vale para a loja toda (sem lugar marcado) só diz a seção e o item", () => {
    render(<Previa />)
    act(() =>
      usePrevia
        .getState()
        .focar({ alvo: "cores.primaria", secao: "Cores e botões", rotulo: "Cor principal" }),
    )
    expect(screen.getByRole("status")).toHaveTextContent("Cores e botões: Cor principal")
    expect(screen.queryByTestId("contorno-foco")).not.toBeInTheDocument()
  })

  test("ao soltar o item, o aviso some", () => {
    render(<Previa />)
    act(() =>
      usePrevia.getState().focar({
        alvo: "bloco:promocional",
        secao: "Página inicial",
        rotulo: "Banner promocional",
      }),
    )
    act(() => usePrevia.getState().soltar("bloco:promocional"))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
