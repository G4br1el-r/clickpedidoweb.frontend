import type { Pedido } from "../dados/tipos"
import { resumoDaConta } from "./conta"

/**
 * O endereço da vitrine em modo mesa: a loja é o segmento do painel e a mesa vai pelo id, para o
 * QR de uma mesa excluída não abrir a mesa nova com o mesmo número.
 */
export function urlDaMesa(origem: string, segmento: string, mesaId: string): string {
  const parametros = new URLSearchParams({ loja: segmento, mesa: mesaId })
  return `${origem}/mesa?${parametros}`
}

/** A conta da mesa como o cliente vê pelo QR: sem custo, histórico, token nem garçom. */
export type ContaQr = {
  itens: { nome: string; quantidade: number; opcoes: string[]; total: number; cortesia?: true }[]
  /** Os itens somados, antes da cortesia e do desconto. */
  subtotal: number
  cortesias: number
  descontos: number
  taxa: number
  couvert: number
  total: number
  pago: number
  saldo: number
}

export function contaQr(comanda: Pedido): ContaQr {
  const { itens, cortesias, descontos, taxa, couvert, total, pago, saldo } = resumoDaConta(comanda)
  return {
    itens: comanda.itens.map((item) => ({
      nome: item.nome,
      quantidade: item.quantidade,
      opcoes: item.opcoes,
      total: item.total,
      ...(item.cortesia ? { cortesia: true as const } : {}),
    })),
    subtotal: itens,
    cortesias,
    descontos,
    taxa,
    couvert,
    total,
    pago,
    saldo,
  }
}
