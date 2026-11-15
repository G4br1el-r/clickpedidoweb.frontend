import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"
import { Painel, PainelDescricao, PainelTitulo } from "./painel-responsivo"

/** A tela do computador: o painel vira janela central. */
function simularTelaGrande(grande: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (consulta: string) =>
      ({
        matches: grande && consulta === "(min-width: 768px)",
        media: consulta,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
}

function abrir() {
  render(
    <Painel aberto aoMudar={() => {}} testId="painel" className="movimento-proprio">
      <PainelTitulo>Título</PainelTitulo>
      <PainelDescricao>Descrição</PainelDescricao>
    </Painel>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Painel", () => {
  test("no celular, a gaveta recebe as classes de quem a usa", () => {
    simularTelaGrande(false)
    abrir()
    expect(screen.getByTestId("painel")).toHaveAttribute("data-vaul-drawer")
    expect(screen.getByTestId("painel")).toHaveClass("movimento-proprio")
  })

  test("no computador, a janela central também", () => {
    simularTelaGrande(true)
    abrir()
    expect(screen.getByTestId("painel")).not.toHaveAttribute("data-vaul-drawer")
    expect(screen.getByTestId("painel")).toHaveClass("movimento-proprio")
  })
})
