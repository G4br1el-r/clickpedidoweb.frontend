import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import type { DadosMedicamento } from "@/lib/admin/dados/tipos"
import { InfoRemedio, SeloRemedio } from "./info-remedio"

const dados = (resto: Partial<DadosMedicamento>): DadosMedicamento => ({
  tarja: "vermelha",
  tipo: "generico",
  principioAtivo: "Amoxicilina tri-hidratada",
  apresentacao: "500 mg, 21 cápsulas",
  laboratorio: "EMS",
  registroMs: "1023508930064",
  ...resto,
})

describe("SeloRemedio", () => {
  test("mostra a tarja e o que o pedido vai pedir", () => {
    const { rerender } = render(
      <SeloRemedio medicamento={dados({ tarja: "vermelha-retencao", lista: "antimicrobiano" })} />,
    )
    expect(screen.getByText("Tarja vermelha")).toBeInTheDocument()
    expect(screen.getByText("Retém a receita")).toBeInTheDocument()

    rerender(<SeloRemedio medicamento={dados({ tarja: "sem-tarja" })} />)
    expect(screen.getByText("Sem receita")).toBeInTheDocument()

    rerender(<SeloRemedio medicamento={dados({ tarja: "preta", lista: "B1" })} />)
    expect(screen.getByText("Tarja preta")).toBeInTheDocument()
    expect(screen.getByText("Só no balcão")).toBeInTheDocument()
  })
})

describe("InfoRemedio", () => {
  test("a ficha traz princípio ativo, laboratório, registro e o aviso do pedido", () => {
    render(
      <InfoRemedio medicamento={dados({ tarja: "vermelha-retencao", lista: "antimicrobiano" })} />,
    )
    expect(screen.getByText("Amoxicilina tri-hidratada")).toBeInTheDocument()
    expect(screen.getByText("Genérico · EMS")).toBeInTheDocument()
    expect(screen.getByText("MS 1.0235.0893.006-4")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Você manda a foto da receita ao finalizar. Na entrega, a via original fica com a farmácia.",
      ),
    ).toBeInTheDocument()
  })

  test("controlado explica por que não tem venda pelo site", () => {
    render(<InfoRemedio medicamento={dados({ tarja: "preta", lista: "B1" })} />)
    expect(
      screen.getByText(
        "Controlado: a lei não permite venda pela internet. Leve a notificação de receita original ao balcão.",
      ),
    ).toBeInTheDocument()
  })
})
