import type { Lote, Pedido, Receita } from "../../dados/tipos"
import { situacaoDoLote } from "../farmacia"
import { faltaPesar } from "../pesagem"

/** Receitas que o farmacêutico ainda não aprovou nem recusou. */
export const receitasAConferir = (receitas: Receita[], decisoes: Record<string, unknown>) =>
  receitas.filter((receita) => !(receita.id in decisoes)).length

/** Lotes com saldo vencidos ou que vencem em até 30 dias. */
export const lotesVencendo = (lotes: Lote[], agora: Date) =>
  lotes.filter((lote) => {
    const { validade } = situacaoDoLote(lote, agora)
    return lote.quantidade > 0 && (validade === "vencido" || validade === "vence-em-30")
  }).length

/** Pedidos em aberto que esperam a balança para fechar o valor. */
export const pedidosAPesar = (pedidos: Pedido[]) =>
  pedidos.filter(
    (pedido) =>
      pedido.status !== "cancelado" && pedido.status !== "concluido" && faltaPesar(pedido),
  ).length
