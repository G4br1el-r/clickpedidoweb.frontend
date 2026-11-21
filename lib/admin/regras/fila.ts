import { isSameDay, parseISO, startOfDay } from "date-fns"
import { emReais } from "@/lib/formato"
import type { ConfigLoja, Pedido, StatusPedido } from "../dados/tipos"
import { type SegmentoPainelId, temModulo } from "../segmentos-painel"
import { prazoDoPedido } from "./prazo"
import { rotuloPagamento } from "./rotulos"

export type ColunaFila = { id: string; titulo: string; status: StatusPedido; pedidos: Pedido[] }
export type Urgencia = "normal" | "atencao" | "atrasado"

const criado = (pedido: Pedido) => Date.parse(pedido.criadoEm)
const inicio = (pedido: Pedido) => Date.parse(pedido.agendamento?.inicio ?? pedido.criadoEm)

const EM_ANDAMENTO: readonly StatusPedido[] = [
  "recebido",
  "em-preparo",
  "pronto",
  "saiu-para-entrega",
]

/**
 * Em andamento desde um dia que já passou: alguém esqueceu de fechar. Na retirada marcada
 * (açougue) vale o dia da retirada; o salão segue pela hora marcada, na própria coluna.
 */
function ficouParaTras(pedido: Pedido, agora: Date): boolean {
  if (!EM_ANDAMENTO.includes(pedido.status) || pedido.tipo === "atendimento") return false
  const hoje = startOfDay(agora).getTime()
  if (pedido.dataRetirada) return parseISO(pedido.dataRetirada).getTime() < hoje
  return criado(pedido) < hoje
}

/** Mesa pronta e já servida: sai da fila; a conta continua aberta em Mesas. */
const servida = (pedido: Pedido) =>
  pedido.tipo === "mesa" && pedido.status === "pronto" && Boolean(pedido.servidoEm)

/**
 * Retirada marcada para um dia depois de hoje que ninguém começou: espera na faixa
 * "Próximas retiradas" e entra em Novos no dia. Se já começou, fica no quadro.
 */
function ehParaOutroDia(pedido: Pedido, agora: Date): boolean {
  if (pedido.status !== "recebido" || !pedido.dataRetirada) return false
  return parseISO(pedido.dataRetirada).getTime() > startOfDay(agora).getTime()
}

export type GrupoDeRetirada = { dia: string; pedidos: Pedido[] }

/** As próximas retiradas, por dia (o mais perto primeiro) e, no dia, por ordem de chegada. */
export function proximasRetiradas(pedidos: Pedido[], agora: Date): GrupoDeRetirada[] {
  const grupos = new Map<string, Pedido[]>()
  for (const pedido of pedidos.filter((item) => ehParaOutroDia(item, agora))) {
    const dia = pedido.dataRetirada as string
    grupos.set(dia, [...(grupos.get(dia) ?? []), pedido])
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, doDia]) => ({ dia, pedidos: doDia.sort((a, b) => criado(a) - criado(b)) }))
}

/** O que ficou aberto de outro dia: sai das colunas e vai para o aviso, com ações em lote. */
export function pedidosDeDiasAnteriores(pedidos: Pedido[], agora: Date): Pedido[] {
  return pedidos.filter((pedido) => ficouParaTras(pedido, agora))
}

/**
 * Colunas do quadro: comida vai de Novos a A caminho (só com entrega no segmento);
 * o salão mostra os agendamentos de hoje (e os atrasados de dias anteriores), pela hora
 * marcada, quem já chegou e quem está em atendimento.
 */
export function colunasDaFila(
  pedidos: Pedido[],
  segmento: SegmentoPainelId,
  agora: Date,
): ColunaFila[] {
  const com = (status: StatusPedido) =>
    pedidos.filter(
      (pedido) =>
        pedido.status === status &&
        !ficouParaTras(pedido, agora) &&
        !servida(pedido) &&
        !ehParaOutroDia(pedido, agora),
    )

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
              !pedido.chegouEm &&
              (isSameDay(inicio(pedido), agora) || inicio(pedido) < startOfDay(agora).getTime()),
          )
          .sort((a, b) => inicio(a) - inicio(b)),
      },
      {
        id: "chegou",
        titulo: "Chegou",
        status: "recebido",
        // Na ordem em que chegaram: quem espera há mais tempo começa primeiro.
        pedidos: com("recebido")
          .filter((pedido) => pedido.chegouEm)
          .sort((a, b) => Date.parse(a.chegouEm ?? "") - Date.parse(b.chegouEm ?? "")),
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
  // Quem espera aceite vem antes: é o que pede ação primeiro.
  const espera = (pedido: Pedido) => (pedido.esperaAceite ? 0 : 1)
  return colunas.map(([id, titulo, status]) => ({
    id,
    titulo,
    status,
    pedidos: com(status).sort((a, b) => espera(a) - espera(b) || criado(a) - criado(b)),
  }))
}

/** Dashboard: de quantos minutos desde a criação o pedido conta como atrasado. */
export const MINUTOS_DE_ATRASO = 40

/** Âmbar nos 10 últimos minutos do prazo prometido, vermelho quando passa. */
const AVISO_ANTES_MIN = 10

/** Pelo prazo prometido; no salão, quem passou da hora marcada e não começou. */
export function urgencia(
  pedido: Pedido,
  agora: Date,
  loja: Pick<ConfigLoja, "tempoEntrega" | "tempoRetirada">,
): Urgencia {
  if (pedido.agendamento) {
    return pedido.status === "recebido" && inicio(pedido) < agora.getTime() ? "atrasado" : "normal"
  }
  const prazo = prazoDoPedido(pedido, loja)
  if (!prazo) return "normal"
  const faltam = (prazo.getTime() - agora.getTime()) / 60_000
  if (faltam <= 0) return "atrasado"
  if (faltam <= AVISO_ANTES_MIN) return "atencao"
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

/** Tamanho do pedido no cartão: quantos itens (somando as quantidades) e o total. */
export function resumoDosItens(pedido: Pedido): string {
  const itens = pedido.itens.reduce((soma, item) => soma + item.quantidade, 0)
  return `${itens} ${itens === 1 ? "item" : "itens"} · ${emReais(pedido.total)}`
}

/**
 * A gaveta "Finalizados hoje": o que foi concluído hoje e o que chegou hoje e foi cancelado,
 * sem repetir, do que fechou por último ao primeiro.
 */
export function finalizadosHoje(concluidosHoje: Pedido[], criadosHoje: Pedido[]): Pedido[] {
  const porId = new Map<number, Pedido>()
  for (const pedido of [...concluidosHoje, ...criadosHoje]) {
    if (pedido.status === "concluido" || pedido.status === "cancelado") porId.set(pedido.id, pedido)
  }
  return [...porId.values()].sort((a, b) => Date.parse(b.atualizadoEm) - Date.parse(a.atualizadoEm))
}
