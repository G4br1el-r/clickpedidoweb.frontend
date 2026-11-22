import { isSameDay, startOfDay } from "date-fns"
import { emReais } from "@/lib/formato"
import type { Pedido, StatusPedido } from "../dados/tipos"
import { type SegmentoPainelId, temModulo } from "../segmentos-painel"
import { rotuloPagamento } from "./rotulos"

export type ColunaFila = { id: string; titulo: string; status: StatusPedido; pedidos: Pedido[] }
export type Urgencia = "normal" | "atencao" | "atrasado"

const criado = (pedido: Pedido) => Date.parse(pedido.criadoEm)
const inicio = (pedido: Pedido) => Date.parse(pedido.agendamento?.inicio ?? pedido.criadoEm)

/**
 * Colunas do quadro: comida vai de Novos a A caminho (só com entrega no segmento);
 * o salão mostra os agendamentos de hoje (e os atrasados de dias anteriores), pela hora
 * marcada, e quem está em atendimento.
 */
export function colunasDaFila(
  pedidos: Pedido[],
  segmento: SegmentoPainelId,
  agora: Date,
): ColunaFila[] {
  const com = (status: StatusPedido) => pedidos.filter((pedido) => pedido.status === status)

  if (segmento === "salao") {
    return [
      {
        id: "agendados",
        titulo: "Agendados",
        status: "recebido",
        // Os de hoje e os que ficaram para trás de outro dia (aparecem como atrasados).
        pedidos: com("recebido")
          .filter(
            (pedido) =>
              isSameDay(inicio(pedido), agora) || inicio(pedido) < startOfDay(agora).getTime(),
          )
          .sort((a, b) => inicio(a) - inicio(b)),
      },
      {
        id: "atendimento",
        titulo: "Em atendimento",
        status: "em-preparo",
        pedidos: com("em-preparo").sort((a, b) => inicio(a) - inicio(b)),
      },
    ]
  }

  const colunas: [string, string, StatusPedido][] = [
    ["novos", "Novos", "recebido"],
    ["preparo", "Em preparo", "em-preparo"],
    ["prontos", "Prontos", "pronto"],
  ]
  if (temModulo(segmento, "motoboys")) colunas.push(["rota", "A caminho", "saiu-para-entrega"])
  return colunas.map(([id, titulo, status]) => ({
    id,
    titulo,
    status,
    pedidos: com(status).sort((a, b) => criado(a) - criado(b)),
  }))
}

/** A partir de quantos minutos desde a criação o pedido está atrasado (a fila fica vermelha). */
export const MINUTOS_DE_ATRASO = 40

/** Âmbar a partir de 25 minutos, vermelho a partir de 40; no salão, quem passou da hora. */
export function urgencia(pedido: Pedido, agora: Date): Urgencia {
  if (pedido.agendamento) {
    return pedido.status === "recebido" && inicio(pedido) < agora.getTime() ? "atrasado" : "normal"
  }
  const minutos = (agora.getTime() - criado(pedido)) / 60_000
  if (minutos >= MINUTOS_DE_ATRASO) return "atrasado"
  if (minutos >= 25) return "atencao"
  return "normal"
}

/** Linha de cobrança do cartão: o que está pago e o que o entregador ou o caixa cobra. */
export function textoCobranca(pedido: Pedido): string {
  const forma = rotuloPagamento(pedido.pagamento)
  if (pedido.situacaoPagamento === "pago") return `Pago · ${forma}`
  if (pedido.situacaoPagamento === "pendente") return `Aguardando pagamento · ${forma}`
  const troco = pedido.trocoPara ? ` · troco para ${emReais(pedido.trocoPara)}` : ""
  return `Cobrar ${emReais(pedido.total)} · ${forma}${troco}`
}

/** Pedidos novos que não estavam na última leitura: tocam o alerta e entram com destaque. */
export function novosPedidos(conhecidos: ReadonlySet<number>, pedidos: Pedido[]): number[] {
  return pedidos
    .filter((pedido) => pedido.status === "recebido" && !conhecidos.has(pedido.id))
    .map((pedido) => pedido.id)
}

export function resumoDaFila(pedidos: Pedido[], segmento: SegmentoPainelId, agora: Date) {
  return {
    emAndamento: colunasDaFila(pedidos, segmento, agora).reduce(
      (soma, coluna) => soma + coluna.pedidos.length,
      0,
    ),
    concluidosHoje: pedidos.filter(
      (pedido) => pedido.status === "concluido" && isSameDay(new Date(pedido.atualizadoEm), agora),
    ).length,
    aguardandoPagamento: pedidos.filter((pedido) => pedido.status === "aguardando-pagamento")
      .length,
  }
}
