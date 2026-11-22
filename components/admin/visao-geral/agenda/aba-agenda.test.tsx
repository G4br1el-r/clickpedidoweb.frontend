import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, test } from "vitest"
import type { HorarioFuncionamento, Pedido } from "@/lib/admin/dados/tipos"
import { PERIODO_DE_TESTE, pedidoDeTeste } from "@/lib/admin/regras/pedidos-de-teste"
import { AbaAgenda } from "./aba-agenda"

const regiao = (nome: string) => within(screen.getByRole("region", { name: nome }))
const fato = (onde: ReturnType<typeof regiao>, rotulo: string) =>
  onde.getByText(rotulo, { selector: "dt" }).closest("[data-indicador]")

/** Aberto todos os dias, das 9h às 18h. */
const HORARIOS: HorarioFuncionamento[] = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
  dia,
  aberto: true,
  abre: "09:00",
  fecha: "18:00",
}))

const servico = (nome: string, total: number) => ({
  id: nome,
  produtoId: nome,
  nome,
  quantidade: 1,
  precoUnitario: total,
  opcoes: [],
  total,
})

const atendimento = (
  id: number,
  inicio: Date,
  duracaoMin: number,
  mudancas: Partial<Pedido> = {},
): Pedido =>
  pedidoDeTeste(id, new Date(2026, 10, 1, 10), 60, {
    tipo: "atendimento",
    status: "recebido",
    origem: "painel",
    agendamento: { inicio: inicio.toISOString(), duracaoMin },
    itens: [servico("Corte", 60)],
    ...mudancas,
  })

const PEDIDOS = [
  atendimento(1, new Date(2026, 10, 12, 10), 240, { status: "concluido" }),
  atendimento(2, new Date(2026, 10, 13, 16, 30), 60),
  atendimento(3, new Date(2026, 10, 13, 9), 60, {
    status: "cancelado",
    total: 90,
    itens: [servico("Escova", 90)],
  }),
]

function renderizar(mudancas: Partial<ComponentProps<typeof AbaAgenda>> = {}) {
  return render(
    <AbaAgenda
      pedidos={PEDIDOS}
      periodo={PERIODO_DE_TESTE}
      agora={new Date(2026, 10, 13, 16)}
      horarios={HORARIOS}
      capacidade={1}
      {...mudancas}
    />,
  )
}

describe("AbaAgenda", () => {
  test("a régua: ocupação, horários vagos hoje e amanhã e os cancelamentos", () => {
    renderizar()
    const regua = regiao("Agenda do período")
    // 300 min marcados de 1.080 abertos.
    expect(fato(regua, "Ocupação")).toHaveTextContent("28%")
    expect(fato(regua, "Ocupação")).toHaveTextContent("5 h marcadas de 18 h")
    expect(fato(regua, "Vagos hoje")).toHaveTextContent("2")
    expect(fato(regua, "Vagos hoje")).toHaveTextContent("horários de 30 min")
    expect(fato(regua, "Vagos amanhã")).toHaveTextContent("18")
    expect(fato(regua, "Cancelados")).toHaveTextContent("33%")
    expect(fato(regua, "Cancelados")).toHaveTextContent("1 de 3 · R$ 90,00")
  })

  test("os serviços mais agendados, sem os cancelados", () => {
    renderizar()
    expect(regiao("Serviços mais agendados").getAllByRole("listitem")).toHaveLength(1)
    expect(regiao("Serviços mais agendados").getByRole("listitem")).toHaveTextContent(
      "Corte2 vezesR$ 120,00100%",
    )
  })

  test("sem atendimentos, a lista diz isso", () => {
    renderizar({ pedidos: [] })
    expect(
      regiao("Serviços mais agendados").getByText("Nenhum atendimento marcado no período."),
    ).toBeInTheDocument()
  })
})
