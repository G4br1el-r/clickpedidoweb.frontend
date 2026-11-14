import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { SeletorSegmento } from "./seletor-segmento"

beforeEach(() => {
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

describe("SeletorSegmento", () => {
  test("mostra o segmento atual", () => {
    render(<SeletorSegmento />)
    expect(screen.getByRole("button", { name: /segmento: pizzaria/i })).toBeInTheDocument()
  })

  test("lista os 6 segmentos com a loja de referência e troca o painel", async () => {
    const usuario = userEvent.setup()
    render(<SeletorSegmento />)

    await usuario.click(screen.getByRole("button", { name: /segmento: pizzaria/i }))
    const opcoes = screen.getAllByRole("menuitemradio")
    expect(opcoes.map((opcao) => opcao.textContent)).toEqual([
      "AdegaAdega da Vila",
      "AçougueAçougue Sabor da Carne",
      "PizzariaCasa da Pizza",
      "Salão de belezaEmpório das Deusas",
      "LanchoneteQuiosque do Mineiro",
      "FarmáciaDrogaria Bem Estar",
    ])
    expect(screen.getByRole("menuitemradio", { name: /pizzaria/i })).toBeChecked()

    await usuario.click(screen.getByRole("menuitemradio", { name: /salão de beleza/i }))

    expect(useSegmentoAtual.getState().segmento).toBe("salao")
    expect(screen.getByRole("button", { name: /segmento: salão de beleza/i })).toBeInTheDocument()
  })
})
