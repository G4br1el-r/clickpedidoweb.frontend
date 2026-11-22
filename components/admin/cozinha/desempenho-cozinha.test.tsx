import { render, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { FaixaDoTurno, ListaDeTempos, ReguaDoDesempenho } from "./desempenho-cozinha"

describe("FaixaDoTurno", () => {
  test("tempo médio, prontos, atrasados agora e o mais pedido de hoje", () => {
    render(
      <FaixaDoTurno
        resumo={{
          tempoMedioMin: 14,
          prontos: 23,
          atrasadosAgora: 2,
          maisPedido: { nome: "Calabresa", quantidade: 9 },
        }}
      />,
    )
    const faixa = within(screen.getByRole("region", { name: "Turno de hoje" }))
    const valor = (rotulo: string) => faixa.getByText(rotulo).nextElementSibling?.textContent
    expect(valor("Tempo médio até pronto")).toBe("14 min")
    expect(valor("Prontos hoje")).toBe("23")
    expect(valor("Atrasados agora")).toBe("2")
    expect(valor("Mais pedido")).toBe("Calabresa")
    expect(faixa.getByText("9 hoje")).toBeInTheDocument()
  })

  test("sem movimento, traço no lugar do número", () => {
    render(
      <FaixaDoTurno
        resumo={{ tempoMedioMin: null, prontos: 0, atrasadosAgora: 0, maisPedido: null }}
      />,
    )
    const faixa = within(screen.getByRole("region", { name: "Turno de hoje" }))
    expect(faixa.getByText("Tempo médio até pronto").nextElementSibling).toHaveTextContent("—")
    expect(faixa.getByText("Mais pedido").nextElementSibling).toHaveTextContent("—")
  })
})

describe("ReguaDoDesempenho", () => {
  test("os números principais do período", () => {
    render(
      <ReguaDoDesempenho
        numeros={{
          tickets: 120,
          tempoMedioMin: 18,
          noPrazoPct: 87,
          refeitos: 3,
          retrabalhoPct: 3,
          canceladosDepoisDeIniciar: 2,
        }}
      />,
    )
    const valor = (rotulo: string) => screen.getByText(rotulo).nextElementSibling?.textContent
    expect(valor("Tempo até pronto")).toBe("18 min")
    expect(valor("No prazo")).toBe("87%")
    expect(valor("Tickets")).toBe("120")
    expect(valor("Retrabalho")).toBe("3%")
    expect(screen.getByText("3 refeitos")).toBeInTheDocument()
    expect(screen.getByText("2 cancelados depois de iniciar")).toBeInTheDocument()
  })
})

describe("ListaDeTempos", () => {
  test("uma linha por grupo, com tickets e tempo médio, e a barra proporcional ao maior", () => {
    render(
      <ListaDeTempos
        titulo="Por praça"
        linhas={[
          { chave: "forno", nome: "Forno", tickets: 40, tempoMedioMin: 20 },
          { chave: "bar", nome: "Bar", tickets: 12, tempoMedioMin: 5 },
        ]}
      />,
    )
    const lista = within(screen.getByRole("list", { name: "Por praça" }))
    const [forno, bar] = lista.getAllByRole("listitem")
    expect(forno).toHaveTextContent("Forno")
    expect(forno).toHaveTextContent("40 tickets")
    expect(forno).toHaveTextContent("20 min")
    expect(bar.querySelector("[data-barra]")).toHaveStyle({ width: "25%" })
  })
})
