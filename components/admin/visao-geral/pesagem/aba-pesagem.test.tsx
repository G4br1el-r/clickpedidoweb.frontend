import { render, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido } from "@/lib/admin/dados/tipos"
import { PERIODO_DE_TESTE, pedidoDeTeste } from "@/lib/admin/regras/pedidos-de-teste"
import { AbaPesagem } from "./aba-pesagem"

const regiao = (nome: string) => within(screen.getByRole("region", { name: nome }))
const fato = (onde: ReturnType<typeof regiao>, rotulo: string) =>
  onde.getByText(rotulo, { selector: "dt" }).closest("[data-indicador]")
const texto = (elemento: Element) => elemento.textContent?.replace(/ /g, " ")

const DIA = new Date(2026, 10, 13, 10)

const porKg = (gramas: number, quantidade: number, pesoReal?: number): ItemPedido => ({
  id: "picanha",
  produtoId: "picanha",
  nome: "Picanha",
  quantidade,
  precoUnitario: 50,
  opcoes: [],
  total: 50,
  pesoGramas: gramas,
  precoKg: 100,
  ...(pesoReal === undefined ? {} : { pesoReal }),
})

const pesado = (id: number, totalEstimado: number, diferenca: number, pesoReal: number): Pedido =>
  pedidoDeTeste(id, DIA, totalEstimado + diferenca, {
    itens: [porKg(500, 2, pesoReal)],
    pesagem: { totalEstimado, diferenca, pesadoEm: DIA.toISOString() },
    dataRetirada: "2026-11-14",
  })

const PEDIDOS = [
  pesado(1, 100, 4, 1040),
  pesado(2, 100, -2, 980),
  // Esperando a balança para fechar o valor.
  pedidoDeTeste(3, DIA, 75, {
    status: "recebido",
    pagamento: "pagar-apos-pesagem",
    situacaoPagamento: "pendente",
    itens: [porKg(750, 1)],
    dataRetirada: "2026-11-13",
  }),
]

describe("AbaPesagem", () => {
  test("a régua: quilos vendidos, pesados, diferença média e quem espera a balança", () => {
    render(<AbaPesagem pedidos={PEDIDOS} periodo={PERIODO_DE_TESTE} />)
    const regua = regiao("Balança do período")
    expect(fato(regua, "Vendido")).toHaveTextContent("2,77 kg")
    expect(fato(regua, "Pesados")).toHaveTextContent("2")
    expect(fato(regua, "Diferença média")).toHaveTextContent("+R$ 1,00")
    expect(fato(regua, "Diferença média")).toHaveTextContent("+1% sobre o estimado")
    expect(fato(regua, "Esperando pesagem")).toHaveTextContent("1")
  })

  test("as retiradas marcadas para cada dia", () => {
    render(<AbaPesagem pedidos={PEDIDOS} periodo={PERIODO_DE_TESTE} />)
    expect(regiao("Retiradas por dia").getAllByRole("listitem").map(texto)).toEqual([
      "sexta, 13/111 pedidoR$ 75,0027%",
      "sábado, 14/112 pedidosR$ 202,0073%",
    ])
  })

  test("sem nada pesado, a diferença não aparece", () => {
    render(<AbaPesagem pedidos={[]} periodo={PERIODO_DE_TESTE} />)
    expect(fato(regiao("Balança do período"), "Diferença média")).toHaveTextContent("—")
    expect(
      regiao("Retiradas por dia").getByText("Nenhuma retirada marcada no período."),
    ).toBeInTheDocument()
  })
})
