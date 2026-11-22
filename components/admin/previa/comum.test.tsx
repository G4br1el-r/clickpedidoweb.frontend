import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { Entrada } from "./comum"

// O Motion lê "reduzir movimento" uma vez só, na primeira vez que alguém pergunta: por isso
// este arquivo fica só com o movimento reduzido ligado.
beforeEach(() => {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("prefers-reduced-motion"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }))
})

describe("Entrada", () => {
  test("com reduzir movimento, o bloco já aparece no lugar, sem entrada", () => {
    render(<Entrada alvo="bloco:teste">Conteúdo</Entrada>)

    const bloco = screen.getByText("Conteúdo")
    expect(bloco).not.toHaveStyle({ opacity: "0" })
    // Só a perspectiva fixa do bloco; nada deslocado, girado ou encolhido.
    expect(bloco.style.transform).not.toMatch(/translate|rotate|scale/)
  })
})
