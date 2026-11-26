import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SeloLista, SeloReceita, SeloTarja } from "./selos"

describe("selos da farmácia", () => {
  it("a lista da Portaria 344 se lê em 12 px, nunca em 11", () => {
    render(<SeloLista lista="B1" />)
    const selo = screen.getByText("B1")
    expect(selo.className).toContain("text-xs")
    expect(selo.className).not.toContain("text-[11px]")
  })

  it("antimicrobiano aparece como ATM", () => {
    render(<SeloLista lista="antimicrobiano" />)
    expect(screen.getByText("ATM")).toBeInTheDocument()
  })

  it("a tarja e o papel da receita trazem o nome por extenso", () => {
    render(
      <>
        <SeloTarja tarja="preta" />
        <SeloReceita tipo="notificacao-b" />
      </>,
    )
    expect(screen.getByText("Tarja preta")).toBeInTheDocument()
    expect(screen.getByText("Notificação de receita B")).toBeInTheDocument()
  })
})
