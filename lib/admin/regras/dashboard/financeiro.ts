import type { Pedido, TaxasPagamento } from "../../dados/tipos"
import type { Periodo } from "../periodo"
import { ehValido, noPeriodo, reais } from "./comum"

const somar = (pedidos: Pedido[], valor: (pedido: Pedido) => number) =>
  reais(pedidos.reduce((total, pedido) => total + valor(pedido), 0))

/** Régua do Financeiro: do bruto (subtotal) ao líquido, com descontos e taxas de entrega. */
export function reguaFinanceira(pedidos: Pedido[], periodo: Periodo) {
  const validos = noPeriodo(pedidos, periodo).filter(ehValido)
  return {
    bruto: somar(validos, (pedido) => pedido.subtotal),
    descontos: somar(validos, (pedido) => pedido.desconto),
    taxasEntrega: somar(validos, (pedido) => pedido.taxaEntrega),
    liquido: somar(validos, (pedido) => pedido.total),
  }
}

const contagem = (pedidos: Pedido[]) => ({
  pedidos: pedidos.length,
  total: somar(pedidos, (pedido) => pedido.total),
})

/**
 * O que falta receber dos pedidos do período: o pagamento na entrega ainda aberto e os
 * pendentes (o Pix que não caiu, o que paga depois de pesar). Cancelado não conta.
 */
export function aReceber(pedidos: Pedido[], periodo: Periodo) {
  const abertos = noPeriodo(pedidos, periodo).filter((pedido) => pedido.status !== "cancelado")
  return {
    naEntrega: contagem(abertos.filter((pedido) => pedido.situacaoPagamento === "na-entrega")),
    pendentes: contagem(abertos.filter((pedido) => pedido.situacaoPagamento === "pendente")),
  }
}

/** Descontos dados no PDV: quantas vendas do balcão tiveram desconto e quanto somam. */
export function descontosDoPdv(pedidos: Pedido[], periodo: Periodo) {
  const comDesconto = noPeriodo(pedidos, periodo).filter(
    (pedido) => ehValido(pedido) && pedido.origem === "pdv" && pedido.desconto > 0,
  )
  return {
    pedidos: comDesconto.length,
    total: somar(comDesconto, (pedido) => pedido.desconto),
  }
}

export type FormaComTaxa = keyof TaxasPagamento

const FORMAS_COM_TAXA: FormaComTaxa[] = ["pixOnline", "cartaoOnline", "maquininha"]

/** Em que taxa o pedido cai: Pix pelo site, cartão online ou maquininha. O resto não tem taxa. */
export function formaComTaxa(pedido: Pedido): FormaComTaxa | null {
  if (pedido.pagamento === "pix") return pedido.origem === "site" ? "pixOnline" : null
  if (pedido.pagamento === "cartao-online") return "cartaoOnline"
  if (pedido.pagamento === "cartao-na-entrega") return "maquininha"
  return null
}

/**
 * Taxas de pagamento estimadas no período: cada forma com taxa leva a % configurada do que
 * vendeu. Forma usada sem taxa informada conta como 0% e aparece em `semTaxa`.
 */
export function taxasEstimadas(
  pedidos: Pedido[],
  periodo: Periodo,
  taxas: TaxasPagamento | undefined,
) {
  const validos = noPeriodo(pedidos, periodo).filter(ehValido)
  const formas = FORMAS_COM_TAXA.flatMap((forma) => {
    const dela = validos.filter((pedido) => formaComTaxa(pedido) === forma)
    if (dela.length === 0) return []
    const vendido = somar(dela, (pedido) => pedido.total)
    const taxa = taxas?.[forma]
    return [
      { forma, pedidos: dela.length, vendido, taxa, valor: reais((vendido * (taxa ?? 0)) / 100) },
    ]
  })
  const total = reais(formas.reduce((soma, forma) => soma + forma.valor, 0))
  return {
    formas,
    total,
    liquidoDepois: reais(somar(validos, (pedido) => pedido.total) - total),
    semTaxa: formas.filter((forma) => forma.taxa === undefined).map((forma) => forma.forma),
  }
}
