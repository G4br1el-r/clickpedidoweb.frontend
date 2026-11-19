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

  test("o mapa de calor é uma tabela: dias da semana nas linhas, horas nas colunas", () => {
    renderizar()
    const mapa = screen.getByRole("table", { name: "Pedidos por dia da semana e hora" })
    expect(
      within(mapa)
        .getAllByRole("columnheader")
        .map((celula) => celula.textContent),
    ).toEqual(["Dia", "19h", "20h"])
    // 12/11/2026 é quinta: um pedido às 19h e outro às 20h.
    const quinta = within(mapa).getByRole("rowheader", { name: "Quinta" }).closest("tr")
    expect(
      within(quinta as HTMLElement)
        .getAllByRole("cell")
        .map((celula) => celula.textContent),
    ).toEqual(["1 pedido, R$ 50,00", "1 pedido, R$ 30,00"])
    const segunda = within(mapa).getByRole("rowheader", { name: "Segunda" }).closest("tr")
    expect(
      within(segunda as HTMLElement)
        .getAllByRole("cell")
        .map((celula) => celula.textContent),
    ).toEqual(["Sem pedidos", "Sem pedidos"])
  })

  test("a média por hora mostra quanto a loja vende por dia em cada hora", () => {
    renderizar()
    const horas = regiao("Média por hora do dia").getAllByRole("listitem")
    expect(horas.map((hora) => hora.textContent?.replace(/\s/g, " "))).toEqual([
      "19h1 pedido por diaR$ 60,00",
      "20h1 pedido por diaR$ 25,00",
    ])
  })

  test("canais e origens levam para os pedidos já filtrados no período", () => {
    renderizar()
    expect(regiao("Canais de venda").getByRole("link", { name: "Entrega" })).toHaveAttribute(
      "href",
      "/admin/pedidos?canal=entrega&de=2026-11-12&ate=2026-11-13",
    )
    expect(regiao("Origem dos pedidos").getByRole("link", { name: "Site" })).toHaveAttribute(
      "href",
      "/admin/pedidos?origem=site&de=2026-11-12&ate=2026-11-13",
    )
  })

  test("o dia a dia fica recolhido e abre com o dia mais recente primeiro", () => {
    renderizar()
    expect(screen.queryByRole("table", { name: "Dia a dia do período" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Dia a dia do período, em tabela" }))
    const linhas = within(screen.getByRole("table", { name: "Dia a dia do período" }))
      .getAllByRole("row")
      .slice(1)
      .map((linha) => linha.textContent?.replace(/\s/g, " "))
    expect(linhas).toEqual(["sexta, 13/112R$ 90,00R$ 45,00", "quinta, 12/112R$ 80,00R$ 40,00"])
  })
})
