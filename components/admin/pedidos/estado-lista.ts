"use client"

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from "nuqs"
import type {
  FormaPagamento,
  OrigemPedido,
  StatusPedido,
  TipoPedido,
} from "@/lib/admin/dados/tipos"
import type { MotivoDoFiltro } from "@/lib/admin/regras/filtro-pedidos"
import { MOTIVOS_CANCELAMENTO } from "@/lib/admin/regras/rotulos"

const STATUS: readonly StatusPedido[] = [
  "aguardando-pagamento",
  "recebido",
  "em-preparo",
  "pronto",
  "saiu-para-entrega",
  "concluido",
  "cancelado",
]
const TIPOS: readonly TipoPedido[] = ["entrega", "retirada", "mesa", "atendimento"]
const PAGAMENTOS: readonly FormaPagamento[] = [
  "pix",
  "cartao-online",
  "dinheiro",
  "cartao-na-entrega",
  "pagar-apos-pesagem",
]
const ORIGENS: readonly OrigemPedido[] = ["site", "pdv", "garcom", "painel"]
const MOTIVOS: readonly MotivoDoFiltro[] = [...MOTIVOS_CANCELAMENTO, "nao-informado"]
const COLUNAS = ["numero", "criadoEm", "total"] as const
export type ColunaOrdenavel = (typeof COLUNAS)[number]

/** Filtros, ordem e página da lista de pedidos, no endereço da página. */
export const PARAMETROS_LISTA = {
  busca: parseAsString.withDefault(""),
  status: parseAsArrayOf(parseAsStringLiteral(STATUS)).withDefault([]),
  canal: parseAsArrayOf(parseAsStringLiteral(TIPOS)).withDefault([]),
  pagamento: parseAsArrayOf(parseAsStringLiteral(PAGAMENTOS)).withDefault([]),
  /** Só pelo endereço (vem dos gráficos da visão geral): aparece como etiqueta removível. */
  origem: parseAsArrayOf(parseAsStringLiteral(ORIGENS)).withDefault([]),
  /** Telefones do cliente (só dígitos), vindos da aba Clientes. Etiqueta removível. */
  cliente: parseAsArrayOf(parseAsString).withDefault([]),
  /** Motivos de cancelamento, vindos da aba Operação. Etiqueta removível. */
  motivo: parseAsArrayOf(parseAsStringLiteral(MOTIVOS)).withDefault([]),
  ordem: parseAsStringLiteral(COLUNAS).withDefault("criadoEm"),
  crescente: parseAsStringLiteral(["sim"] as const),
  pagina: parseAsInteger.withDefault(1),
}

export function useEstadoLista() {
  return useQueryStates(PARAMETROS_LISTA)
}

/** Pedido aberto nos detalhes (`?pedido=123`). Entra no histórico: o voltar fecha. */
export function usePedidoAberto() {
  return useQueryState("pedido", parseAsInteger.withOptions({ history: "push" }))
}
