import type { StatusPedido, TipoPedido } from "../dados/tipos"

/**
 * Próxima etapa do pedido, ou `null` quando não há (mesa pronta só conclui ao
 * fechar a conta; aguardando pagamento só sai pelo pagamento).
 */
export function proximoStatus(tipo: TipoPedido, status: StatusPedido): StatusPedido | null {
  switch (status) {
    case "recebido":
      return "em-preparo"
    case "em-preparo":
      return tipo === "atendimento" ? "concluido" : "pronto"
    case "pronto":
      if (tipo === "entrega") return "saiu-para-entrega"
      if (tipo === "retirada") return "concluido"
      return null
    case "saiu-para-entrega":
      return "concluido"
    default:
      return null
  }
}

const ROTULO_COMUM: Record<StatusPedido, string> = {
  "aguardando-pagamento": "Aguardando pagamento",
  recebido: "Novo",
  "em-preparo": "Em preparo",
  pronto: "Pronto",
  "saiu-para-entrega": "Saiu para entrega",
  concluido: "Concluído",
  cancelado: "Cancelado",
}

const ROTULO_POR_TIPO: Record<TipoPedido, Partial<Record<StatusPedido, string>>> = {
  entrega: { concluido: "Entregue" },
  retirada: { pronto: "Pronto para retirada", concluido: "Retirado" },
  mesa: { pronto: "Pronto para servir", concluido: "Conta fechada" },
  atendimento: { recebido: "Agendado", "em-preparo": "Em atendimento" },
}

/** Nome do status para a loja, conforme o tipo do pedido. */
export function rotuloStatus(tipo: TipoPedido, status: StatusPedido): string {
  return ROTULO_POR_TIPO[tipo][status] ?? ROTULO_COMUM[status]
}

/** Texto do botão que leva o pedido à próxima etapa, ou `null` se não houver. */
export function rotuloAcao(tipo: TipoPedido, status: StatusPedido): string | null {
  const proximo = proximoStatus(tipo, status)
  if (!proximo) return null
  if (tipo === "atendimento") {
    return proximo === "em-preparo" ? "Iniciar atendimento" : "Concluir atendimento"
  }
  switch (proximo) {
    case "em-preparo":
      return "Iniciar preparo"
    case "pronto":
      return "Marcar como pronto"
    case "saiu-para-entrega":
      return "Saiu para entrega"
    default:
      return tipo === "retirada" ? "Cliente retirou" : "Confirmar entrega"
  }
}

/** Nome do status sem depender do tipo do pedido: usado nos filtros. */
export const rotuloStatusComum = (status: StatusPedido) => ROTULO_COMUM[status]
