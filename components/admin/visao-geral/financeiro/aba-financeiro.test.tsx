import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { Pedido } from "@/lib/admin/dados/tipos"
import {
  AGORA_DE_TESTE,
  PERIODO_DE_TESTE,
  pedidoDeTeste,
} from "@/lib/admin/regras/pedidos-de-teste"
import { AbaFinanceiro } from "./aba-financeiro"

const regiao = (nome: string) => within(screen.getByRole("region", { name: nome }))
const fato = (onde: ReturnType<typeof regiao>, rotulo: string) =>
  onde.getByText(rotulo, { selector: "dt" }).closest("[data-indicador]")

const NO_PERIODO = new Date(2026, 10, 13, 19)

/** Um período com de tudo: desconto no PDV e no site, entrega, cartão e um pedido aberto. */
const PEDIDOS: Pedido[] = [
  pedidoDeTeste(1, NO_PERIODO, 95, {
    origem: "pdv",
    subtotal: 100,
    desconto: 5,
    pagamento: "cartao-na-entrega",
    itens: [
      {
        id: "1",
        produtoId: "Pizza",
        nome: "Pizza",
        quantidade: 2,
        precoUnitario: 50,
        total: 100,
        opcoes: [],
        custoUnitario: 20,
      },
    ],
  }),
  pedidoDeTeste(2, NO_PERIODO, 105, {
    origem: "site",
    subtotal: 110,
    desconto: 10,
    taxaEntrega: 5,
    tipo: "entrega",
    pagamento: "cartao-online",
    itens: [
      {
        id: "2",
        produtoId: "Lanche",
        nome: "Lanche",
        quantidade: 1,
        precoUnitario: 110,
        total: 110,
        opcoes: [],
      },
    ],
  }),
  pedidoDeTeste(3, NO_PERIODO, 40, {
    status: "saiu-para-entrega",
    situacaoPagamento: "na-entrega",
    pagamento: "dinheiro",
    subtotal: 40,
  }),
]

function renderizar(mudancas: Partial<ComponentProps<typeof AbaFinanceiro>> = {}) {
  return render(
    <AbaFinanceiro
      pedidos={PEDIDOS}
      periodo={PERIODO_DE_TESTE}
      taxas={{ pixOnline: 1, cartaoOnline: 5, maquininha: 2 }}
      {...mudancas}
    />,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA_DE_TESTE)
  return () => vi.useRealTimers()
})

describe("AbaFinanceiro", () => {
  test("a régua vai do bruto ao líquido, com os descontos do PDV no detalhe", () => {
    renderizar()
    const regua = regiao("Do bruto ao líquido")
    expect(fato(regua, "Bruto")).toHaveTextContent("R$ 250,00")
    expect(fato(regua, "Descontos")).toHaveTextContent("R$ 15,00")
    expect(fato(regua, "Descontos")).toHaveTextContent("R$ 5,00 no PDV, em 1 venda")
    expect(fato(regua, "Taxas de entrega")).toHaveTextContent("R$ 5,00")
    expect(fato(regua, "Líquido")).toHaveTextContent("R$ 240,00")
  })

  test("depois das taxas e do custo: taxas estimadas, líquido, margem bruta e o que falta receber", () => {
    renderizar()
    const depois = regiao("Depois das taxas e do custo")
    // Maquininha 2% de R$ 95 (R$ 1,90) e cartão online 5% de R$ 105 (R$ 5,25).
    expect(fato(depois, "Taxas de pagamento")).toHaveTextContent("R$ 7,15")
    expect(fato(depois, "Líquido depois das taxas")).toHaveTextContent("R$ 232,85")
    // Só a pizza tem custo: R$ 100 vendidos, R$ 40 de custo.
    expect(fato(depois, "Margem bruta")).toHaveTextContent("R$ 60,00")
    expect(fato(depois, "Margem bruta")).toHaveTextContent(
      "60% · custo informado em 40% do faturamento",
    )
    expect(fato(depois, "A receber")).toHaveTextContent("R$ 40,00")
    expect(fato(depois, "A receber")).toHaveTextContent("1 pedido na entrega")
  })

  test("as formas de pagamento levam aos pedidos de cada uma no período", () => {
    renderizar()
    const formas = regiao("Formas de pagamento")
    // Do líquido de R$ 240: cartão online R$ 105, maquininha R$ 95 e dinheiro R$ 40.
    expect(formas.getAllByRole("listitem")[0]).toHaveTextContent(
      "Cartão online1 pedidoR$ 105,0044%",
    )
    expect(formas.getByRole("link", { name: "Cartão online" })).toHaveAttribute(
      "href",
      "/admin/pedidos?pagamento=cartao-online&de=2026-11-12&ate=2026-11-13",
    )
  })

  test("cada forma com taxa mostra a % e quanto ela leva; a forma sem taxa vira aviso", () => {
    const { unmount } = renderizar()
    const taxas = regiao("Taxas por forma")
    expect(
      taxas.getAllByRole("listitem").map((item) => item.textContent?.replace(/\s/g, " ")),
    ).toEqual(["Cartão online5% de R$ 105,00R$ 5,25", "Cartão na maquininha2% de R$ 95,00R$ 1,90"])
    expect(taxas.queryByText(/Sem taxa informada/)).not.toBeInTheDocument()
    unmount()

    renderizar({ taxas: { cartaoOnline: 5 } })
    const semTaxa = regiao("Taxas por forma")
    expect(
      semTaxa.getByText(/Sem taxa informada para Cartão na maquininha: conta como 0%\./),
    ).toBeInTheDocument()
    expect(semTaxa.getByRole("link", { name: "Configurar as taxas" })).toHaveAttribute(
      "href",
      "/admin/loja",
    )
  })
})

describe("AbaFinanceiro: taxa de serviço (Q34)", () => {
  /** Conta de mesa de R$ 110,00 (100 + 10% de taxa), paga em Pix no período. */
  const contaDeMesa = pedidoDeTeste(20, NO_PERIODO, 110, {
    tipo: "mesa",
    mesa: { id: "mesa-1", numero: 1, pessoas: 2 },
    subtotal: 100,
    pagamento: "pix",
    taxaServico: { percentual: 10 },
    itens: [
      {
        id: "20",
        produtoId: "Pizza",
        nome: "Pizza",
        quantidade: 1,
        precoUnitario: 100,
        total: 100,
        opcoes: [],
      },
    ],
    pagoEm: new Date(2026, 10, 13, 20).toISOString(),
    pagamentos: [{ id: "p20", forma: "pix", valor: 110, em: "" }],
  })

  test("a taxa de serviço aparece à parte, dos garçons", () => {
    renderizar({ pedidos: [...PEDIDOS, contaDeMesa] })
    const taxa = screen.getByRole("region", { name: "Taxa de serviço" })
    expect(taxa).toHaveTextContent("R$ 10,00")
    expect(taxa).toHaveTextContent("dos garçons")
  })

  test("com taxa de serviço, as formas de pagamento avisam que incluem a taxa", () => {
    renderizar({ pedidos: [...PEDIDOS, contaDeMesa] })
    expect(screen.getByRole("region", { name: "Formas de pagamento" })).toHaveTextContent(
      "O que entrou no caixa, inclui a taxa de serviço",
    )
  })

  test("sem taxa de serviço no período, o bloco não aparece", () => {
    renderizar()
    expect(screen.queryByRole("region", { name: "Taxa de serviço" })).not.toBeInTheDocument()
  })
})
