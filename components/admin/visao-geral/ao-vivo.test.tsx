import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { AoVivoRadar } from "./ao-vivo"

describe("AoVivoRadar", () => {
  test("parado, é o ponto verde com o texto e nenhum movimento", () => {
    render(<AoVivoRadar sincronizando={false}>Ao vivo, desde a abertura</AoVivoRadar>)
    expect(screen.getByText("Ao vivo, desde a abertura")).toBeInTheDocument()
    expect(screen.queryByTestId("carregador-radar")).not.toBeInTheDocument()
  })

  test("enquanto confere os pedidos, o radar emite as ondas e avisa o leitor de tela", () => {
    render(<AoVivoRadar sincronizando>Ao vivo, desde a abertura</AoVivoRadar>)
    expect(screen.getByRole("status", { name: "Atualizando ao vivo" })).toBeInTheDocument()
    expect(screen.getByTestId("carregador-radar")).toBeInTheDocument()
    expect(screen.getByText("Ao vivo, desde a abertura")).toBeInTheDocument()
  })

  test("o texto continua o mesmo nos dois estados", () => {
    const { rerender } = render(<AoVivoRadar sincronizando={false}>Ao vivo</AoVivoRadar>)
    rerender(<AoVivoRadar sincronizando>Ao vivo</AoVivoRadar>)
    expect(screen.getByText("Ao vivo")).toBeInTheDocument()
  })
})
