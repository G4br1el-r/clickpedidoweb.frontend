import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { EsqueletoGrafico, EsqueletoVisaoGeral } from "./esqueletos-visao-geral"

describe("EsqueletoVisaoGeral", () => {
  test("avisa o leitor de tela uma vez só, com o nome que a tela já usava", () => {
    render(<EsqueletoVisaoGeral />)
    expect(screen.getAllByRole("status")).toHaveLength(1)
    expect(screen.getByRole("status", { name: "Carregando a visão geral" })).toHaveAttribute(
      "aria-busy",
      "true",
    )
  })

  test("o Resumo imita a tela: duas réguas, o gráfico e duas listas", () => {
    render(<EsqueletoVisaoGeral aba="resumo" />)
    expect(screen.getAllByTestId("esqueleto-regua")).toHaveLength(2)
    expect(screen.getAllByTestId("esqueleto-indicador")).toHaveLength(8)
    expect(screen.getByTestId("esqueleto-grafico")).toBeInTheDocument()
    expect(screen.getAllByTestId("esqueleto-lista")).toHaveLength(2)
  })

  test("uma aba sem gráfico não reserva o espaço dele", () => {
    render(<EsqueletoVisaoGeral aba="clientes" />)
    expect(screen.getAllByTestId("esqueleto-regua")).toHaveLength(1)
    expect(screen.queryByTestId("esqueleto-grafico")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("esqueleto-lista")).toHaveLength(2)
  })

  test("Agenda e Pesagem têm uma lista só", () => {
    const { rerender } = render(<EsqueletoVisaoGeral aba="agenda" />)
    expect(screen.getAllByTestId("esqueleto-lista")).toHaveLength(1)
    rerender(<EsqueletoVisaoGeral aba="pesagem" />)
    expect(screen.getAllByTestId("esqueleto-lista")).toHaveLength(1)
  })

  test("os blocos entram um depois do outro", () => {
    render(<EsqueletoVisaoGeral aba="resumo" />)
    const reguas = screen.getAllByTestId("esqueleto-regua")
    expect(reguas[0].style.animationDelay).toBe("0s")
    expect(Number.parseFloat(reguas[1].style.animationDelay)).toBeGreaterThan(0)
  })
})

describe("EsqueletoGrafico", () => {
  test("mostra as colunas do gráfico e o anel de quem espera", () => {
    render(<EsqueletoGrafico />)
    expect(screen.getByRole("status", { name: "Carregando o gráfico" })).toBeInTheDocument()
    expect(screen.getByTestId("carregador-anel")).toBeInTheDocument()
    expect(screen.getAllByTestId("esqueleto-coluna").length).toBeGreaterThanOrEqual(7)
  })
})
