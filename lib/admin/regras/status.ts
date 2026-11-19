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

const EM_ANDAMENTO: readonly StatusPedido[] = [
  "recebido",
  "em-preparo",
  "pronto",
  "saiu-para-entrega",
]

/**
 * A etapa de antes: a que avança para esta. Serve para desfazer, arrastar de volta e reabrir.
 * Novo é o começo; cancelado e a conta fechada da mesa não voltam pela fila.
 */
export function statusAnterior(tipo: TipoPedido, status: StatusPedido): StatusPedido | null {
  const caminho = etapasDoCaminho(tipo)
  return (
    EM_ANDAMENTO.find(
      (anterior) => caminho.includes(anterior) && proximoStatus(tipo, anterior) === status,
    ) ?? null
  )
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

/**
 * Tom do traço de cada status, na ordem em que o pedido anda: esperando pagamento, novo
 * (pede ação), em preparo, pronto, a caminho. Concluído sai da operação e fica apagado.
 */
export type TomStatus = "espera" | "novo" | "preparo" | "pronto" | "caminho" | "fim" | "cancelado"

const TOM: Record<StatusPedido, TomStatus> = {
  "aguardando-pagamento": "espera",
  recebido: "novo",
  "em-preparo": "preparo",
  pronto: "pronto",
  "saiu-para-entrega": "caminho",
  concluido: "fim",
  cancelado: "cancelado",
}

export const tomDoStatus = (status: StatusPedido): TomStatus => TOM[status]

/**
 * Etapas por que o pedido passa, do novo ao fim, conforme o tipo. Segue `proximoStatus`:
 * só a entrega sai para entrega, e o atendimento do salão não tem "pronto".
 */
export function etapasDoCaminho(tipo: TipoPedido): StatusPedido[] {
  const etapas: StatusPedido[] = ["recebido"]
  let atual: StatusPedido | null = "recebido"
  while (atual) {
    // Mesa pronta só conclui ao fechar a conta: fora do `proximoStatus`, mas é o fim do caminho.
    atual = proximoStatus(tipo, atual) ?? (atual === "pronto" ? "concluido" : null)
    if (atual) etapas.push(atual)
  }
  return etapas
}
