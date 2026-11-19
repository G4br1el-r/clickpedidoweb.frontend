import type { Cancelamento, MotivoCancelamento, Pedido, TipoPedido } from "../dados/tipos"
import type { SegmentoPainelId } from "../segmentos-painel"

export type OpcaoMotivo = { id: MotivoCancelamento; rotulo: string }

const COMIDA: OpcaoMotivo[] = [
  { id: "sem-estoque", rotulo: "Sem estoque de um item" },
  { id: "fora-da-area", rotulo: "Fora da área de entrega" },
  { id: "loja-cheia", rotulo: "Loja cheia" },
  { id: "cliente-pediu", rotulo: "Cliente pediu para cancelar" },
  { id: "endereco-invalido", rotulo: "Endereço inválido" },
  { id: "fraude", rotulo: "Suspeita de fraude" },
]
const OUTRO: OpcaoMotivo = { id: "outro", rotulo: "Outro motivo" }

/** Motivos para recusar ou cancelar, na ordem da lista. "Outro motivo" sempre por último. */
export function motivosDeCancelamento(segmento: SegmentoPainelId): OpcaoMotivo[] {
  if (segmento === "salao") {
    return [
      { id: "loja-cheia", rotulo: "Agenda cheia" },
      { id: "cliente-pediu", rotulo: "Cliente pediu para cancelar" },
      { id: "cliente-nao-veio", rotulo: "Cliente não veio" },
      { id: "fraude", rotulo: "Suspeita de fraude" },
      OUTRO,
    ]
  }
  if (segmento === "farmacia") {
    return [...COMIDA, { id: "receita-invalida", rotulo: "Receita inválida" }, OUTRO]
  }
  return [...COMIDA, OUTRO]
}

/** O motivo em texto: o "Outro" mostra o que a pessoa escreveu; no salão, a loja é a agenda. */
export function textoDoMotivo(cancelamento: Cancelamento, tipo: TipoPedido): string {
  if (cancelamento.motivo === "outro" && cancelamento.detalhe) return cancelamento.detalhe
  const lista = motivosDeCancelamento(tipo === "atendimento" ? "salao" : "farmacia")
  const opcao = [...lista, ...COMIDA].find((item) => item.id === cancelamento.motivo)
  return opcao?.rotulo ?? OUTRO.rotulo
}

/** O alarme insiste enquanto algum pedido espera a loja aceitar ou recusar. */
export const alarmeTocando = (pedidos: Pedido[]) =>
  pedidos.some((pedido) => pedido.esperaAceite && pedido.status === "recebido")

/** Quanto o pedido já espera o aceite e se passou do limite; `null` se não espera. */
export function esperaDoAceite(
  pedido: Pedido,
  agora: Date,
  limiteMin: number,
): { minutos: number; passou: boolean } | null {
  if (!pedido.esperaAceite || pedido.status !== "recebido") return null
  const minutos = Math.floor((agora.getTime() - Date.parse(pedido.criadoEm)) / 60_000)
  return { minutos, passou: minutos >= limiteMin }
}
