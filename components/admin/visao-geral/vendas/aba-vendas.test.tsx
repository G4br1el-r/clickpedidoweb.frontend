import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import {
  AGORA_DE_TESTE,
  PEDIDOS_DE_TESTE,
  PERIODO_DE_TESTE,
} from "@/lib/admin/regras/pedidos-de-teste"
import { AbaVendas } from "./aba-vendas"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

const regiao = (nome: string) => within(screen.getByRole("region", { name: nome }))
const fato = (onde: ReturnType<typeof regiao>, rotulo: string) =>
  onde.getByText(rotulo, { selector: "dt" }).closest("[data-indicador]")

function renderizar(mudancas: Partial<ComponentProps<typeof AbaVendas>> = {}) {
  return render(
    <AbaVendas
      pedidos={PEDIDOS_DE_TESTE}
      periodo={PERIODO_DE_TESTE}
      segmento="pizzaria"
      {...mudancas}
    />,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA_DE_TESTE)
  return () => vi.useRealTimers()
})

describe("AbaVendas", () => {
  test("a régua mostra faturamento, pedidos, ticket e itens por pedido, comparados ao período anterior", () => {
    renderizar()
    const vendas = regiao("Vendas do período")
    expect(fato(vendas, "Faturamento")).toHaveTextContent("R$ 170,00")
    expect(fato(vendas, "Faturamento")).toHaveTextContent("+6,3% sobre os 2 dias anteriores")
    expect(fato(vendas, "Pedidos")).toHaveTextContent("4")
    expect(fato(vendas, "Ticket médio")).toHaveTextContent("R$ 42,50")
    expect(fato(vendas, "Itens por pedido")).toHaveTextContent("1,8")
    expect(fato(vendas, "Itens por pedido")).toHaveTextContent("-41,7% sobre os 2 dias anteriores")
  })

  test("o gráfico troca entre faturamento e pedidos; com menos de 14 dias, não agrupa por semana", () => {
    renderizar()
    expect(screen.getByRole("heading", { name: "Faturamento por dia" })).toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: "Semana" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: "Qtd." }))
    expect(screen.getByRole("heading", { name: "Pedidos por dia" })).toBeInTheDocument()
  })

  test("com 14 dias ou mais, o gráfico pode agrupar por semana", () => {
    renderizar({ periodo: { de: new Date(2026, 10, 1), ate: new Date(2026, 10, 15) } })
    fireEvent.click(screen.getByRole("radio", { name: "Semana" }))
    expect(screen.getByRole("heading", { name: "Faturamento por semana" })).toBeInTheDocument()
  })
})
