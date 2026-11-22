import { isSameDay } from "date-fns"
import type { ItemPedido, Pedido, Praca, Produto } from "../dados/tipos"
import {
  type ConfigCozinha,
  type FiltroCozinha,
  statusDaRodada,
  TEMPOS_PADRAO,
  type TicketCozinha,
} from "./cozinha"
import { normalizar } from "./filtro-pedidos"
import { pracaDoItem } from "./pracas"
import { NOME_DO_MOTIVO } from "./refazer"

const rodadaDo = (item: ItemPedido) => item.rodada ?? 1

/**
 * Todas as rodadas que passaram pela cozinha, já servidas ou não: o que o Histórico
 * mostra. O salão (atendimento) e o item que não foi para a cozinha ficam de fora.
 */
export function ticketsDoHistorico(pedidos: Pedido[]): TicketCozinha[] {
  return pedidos
    .filter((pedido) => pedido.tipo !== "atendimento")
    .flatMap((pedido) => {
      const daCozinha = pedido.itens.filter(
        (item) => item.vaiParaCozinha ?? pedido.enviarParaCozinha,
      )
      const rodadas = [...new Set(daCozinha.map(rodadaDo))].sort((a, b) => a - b)
      return rodadas.map((rodada) => {
        const itens = daCozinha.filter((item) => rodadaDo(item) === rodada)
        return {
          id: `${pedido.id}:${rodada}`,
          pedido,
          rodada,
          status: statusDaRodada(itens),
          itens,
          chegouEm: itens.find((item) => item.lancadoEm)?.lancadoEm ?? pedido.criadoEm,
          avisos: (pedido.avisosCozinha ?? []).filter(
            (aviso) => aviso.tipo === "cancelado" || aviso.rodada === rodada,
          ),
        }
      })
    })
    .concat(pedidos.flatMap(refacoesDoHistorico))
}

/** Cada refazer do pedido, já entregue ou não, como uma linha própria. */
function refacoesDoHistorico(pedido: Pedido): TicketCozinha[] {
  return (pedido.refacoes ?? []).map((refacao) => ({
    id: `${pedido.id}:${refacao.rodada}:r${refacao.numero}`,
    pedido,
    rodada: refacao.rodada,
    status: statusDaRodada(refacao.itens),
    itens: refacao.itens,
    chegouEm: refacao.em,
    avisos: [],
    refazer: {
      numero: refacao.numero,
      motivo: refacao.motivo,
      ...(refacao.texto ? { texto: refacao.texto } : {}),
    },
  }))
}

/** Os refazer feitos a partir desta rodada (o ticket original). */
const refacoesDaRodada = (ticket: TicketCozinha) =>
  ticket.refazer
    ? []
    : (ticket.pedido.refacoes ?? []).filter((refacao) => refacao.rodada === ticket.rodada)

/** Quando a cozinha entregou o refazer (entrega e retirada). */
const entregueEm = (ticket: TicketCozinha) =>
  ticket.pedido.refacoes?.find((refacao) => refacao.numero === ticket.refazer?.numero)?.entregueEm

/** Como o ticket terminou (ou onde está agora). */
export type FimDoTicket =
  | "no-quadro"
  | "pronto"
  | "servido"
  | "saiu"
  | "retirado"
  | "entregue"
  | "cancelado"

/** Uma linha do Histórico: um ticket da cozinha, e como ele terminou. */
export type LinhaDoHistorico = {
  ticket: TicketCozinha
  fim: FimDoTicket
  /** Da chegada ao último item riscado; `null` se ainda não ficou pronto. */
  minutosAtePronto: number | null
  /** Levou (ou já está levando) o tempo de atraso da loja ou mais. */
  atrasado: boolean
  /** O ticket original que teve algum refazer. */
  refeito: boolean
}

/** Quando a rodada ficou pronta: o último item riscado. */
const prontoEm = (ticket: TicketCozinha) =>
  ticket.status === "pronto"
    ? Math.max(...ticket.itens.map((item) => Date.parse(item.feitoEm ?? "")))
    : null

function fimDo(ticket: TicketCozinha): FimDoTicket {
  const { pedido } = ticket
  if (pedido.status === "cancelado") return "cancelado"
  if (ticket.status !== "pronto") return "no-quadro"
  if (ticket.itens.every((item) => item.servidoEm)) return "servido"
  // O refazer sai pelo Entregue da cozinha, não pelas etapas do pedido.
  if (ticket.refazer) return entregueEm(ticket) ? "entregue" : "pronto"
  if (pedido.etapas?.["saiu-para-entrega"]) return "saiu"
  if (pedido.tipo === "retirada" && pedido.etapas?.concluido) return "retirado"
  return "pronto"
}

function linhaDo(ticket: TicketCozinha, agora: Date, tempos: ConfigCozinha): LinhaDoHistorico {
  const fim = fimDo(ticket)
  const chegou = Date.parse(ticket.chegouEm)
  const pronto = prontoEm(ticket)
  const minutosAtePronto = pronto === null ? null : Math.round((pronto - chegou) / 60_000)
  const correndo = fim === "no-quadro" ? Math.floor((agora.getTime() - chegou) / 60_000) : null
  return {
    ticket,
    fim,
    minutosAtePronto,
    atrasado: (minutosAtePronto ?? correndo ?? 0) >= tempos.atrasoMin,
    refeito: refacoesDaRodada(ticket).length > 0,
  }
}

export type SituacaoNoHistorico = "todos" | "atrasados" | "cancelados" | "refeitos"

const DO_TIPO: Record<FiltroCozinha, (pedido: Pedido) => boolean> = {
  todos: () => true,
  mesas: (pedido) => pedido.tipo === "mesa",
  entrega: (pedido) => pedido.tipo === "entrega",
  retirada: (pedido) => pedido.tipo === "retirada",
}

const NA_SITUACAO: Record<SituacaoNoHistorico, (linha: LinhaDoHistorico) => boolean> = {
  todos: () => true,
  atrasados: (linha) => linha.atrasado,
  cancelados: (linha) => linha.fim === "cancelado",
  refeitos: (linha) => linha.refeito || Boolean(linha.ticket.refazer),
}

/** A busca do Histórico: número ("1410", "#1410"), mesa ("mesa 5") ou nome do cliente. */
function combina(pedido: Pedido, busca: string): boolean {
  const texto = normalizar(busca).trim()
  if (!texto) return true
  const mesa = /^mesa\s*(\d+)$/.exec(texto)
  if (mesa) return pedido.mesa?.numero === Number(mesa[1])
  const numero = /^#?(\d+)$/.exec(texto)
  if (numero) return pedido.numero === Number(numero[1])
  return normalizar(pedido.cliente.nome).includes(texto)
}

/** O Histórico de um dia: as rodadas que chegaram nele, da mais nova para a mais antiga. */
export function historicoDoDia(
  pedidos: Pedido[],
  dia: Date,
  {
    agora,
    tempos = TEMPOS_PADRAO,
    filtro = "todos",
    situacao = "todos",
    busca = "",
  }: {
    agora: Date
    tempos?: ConfigCozinha
    filtro?: FiltroCozinha
    situacao?: SituacaoNoHistorico
    busca?: string
  },
): LinhaDoHistorico[] {
  return ticketsDoHistorico(pedidos)
    .filter(
      (ticket) =>
        isSameDay(new Date(ticket.chegouEm), dia) &&
        DO_TIPO[filtro](ticket.pedido) &&
        combina(ticket.pedido, busca),
    )
    .sort((a, b) => Date.parse(b.chegouEm) - Date.parse(a.chegouEm))
    .map((ticket) => linhaDo(ticket, agora, tempos))
    .filter(NA_SITUACAO[situacao])
}

/** Um passo da linha do tempo, com quanto levou desde o anterior. */
export type PassoDoTicket = { rotulo: string; em: string; minutos: number | null }

const ultima = (horas: (string | undefined)[]) =>
  horas.every(Boolean)
    ? new Date(Math.max(...horas.map((hora) => Date.parse(hora ?? "")))).toISOString()
    : undefined

/** Como o ticket saiu da cozinha: servido, saiu para entrega, retirado ou cancelado. */
function saidaDo(ticket: TicketCozinha): { rotulo: string; em: string }[] {
  const { pedido, itens } = ticket
  const fim = fimDo(ticket)
  if (fim === "servido") {
    return [{ rotulo: "Servido", em: ultima(itens.map((item) => item.servidoEm)) as string }]
  }
  if (fim === "entregue") return [{ rotulo: "Entregue", em: entregueEm(ticket) as string }]
  const etapas = pedido.etapas ?? {}
  if (fim === "saiu" && etapas["saiu-para-entrega"]) {
    return [{ rotulo: "Saiu para entrega", em: etapas["saiu-para-entrega"] }]
  }
  if (fim === "retirado" && etapas.concluido) return [{ rotulo: "Retirado", em: etapas.concluido }]
  // O cancelamento que a cozinha viu vem do aviso, com o ciente.
  if (
    fim === "cancelado" &&
    etapas.cancelado &&
    !ticket.avisos.some((a) => a.tipo === "cancelado")
  ) {
    return [{ rotulo: "Cancelado", em: etapas.cancelado }]
  }
  return []
}

/**
 * A linha do tempo do ticket: chegou, iniciou, cada praça pronta (o último item dela
 * riscado), pronto e a saída. Cada passo diz quanto levou desde o anterior.
 */
export function linhaDoTempo(
  ticket: TicketCozinha,
  { produtos, pracas }: { produtos: Produto[]; pracas: Praca[] },
): PassoDoTicket[] {
  const { itens } = ticket
  const iniciou = itens
    .map((item) => item.iniciadoEm)
    .filter(Boolean)
    .sort()[0]
  // Com uma praça só no ticket, o pronto dela é o próprio Pronto: não repete.
  const pracasDoTicket = new Set(itens.map((item) => pracaDoItem(item, produtos, pracas)))
  const daPraca = (pracasDoTicket.size > 1 ? pracas : []).flatMap((praca) => {
    const dela = itens.filter((item) => pracaDoItem(item, produtos, pracas) === praca.id)
    const pronta = dela.length > 0 ? ultima(dela.map((item) => item.feitoEm)) : undefined
    return pronta ? [{ rotulo: `${praca.nome} pronto`, em: pronta }] : []
  })
  const passos = [
    { rotulo: "Chegou", em: ticket.chegouEm },
    ...(iniciou ? [{ rotulo: "Iniciou", em: iniciou }] : []),
    ...daPraca,
    ...(ticket.status === "pronto"
      ? [{ rotulo: "Pronto", em: ultima(itens.map((item) => item.feitoEm)) as string }]
      : []),
    ...saidaDo(ticket),
    ...refacoesDaRodada(ticket).map((refacao) => ({
      rotulo: `Refeito: ${NOME_DO_MOTIVO[refacao.motivo].toLocaleLowerCase("pt-BR")}`,
      em: refacao.em,
    })),
    ...ticket.avisos.flatMap((aviso) => {
      const cancelado = aviso.tipo === "cancelado"
      const oQue = cancelado
        ? "Cancelado"
        : `Alterado: ${(aviso.itens ?? []).map((saiu) => `−${saiu.quantidade} ${saiu.nome}`).join(", ")}`
      return [
        { rotulo: oQue, em: aviso.em },
        ...(aviso.cienteEm
          ? [
              {
                rotulo: cancelado ? "Ciente do cancelamento" : "Ciente da alteração",
                em: aviso.cienteEm,
              },
            ]
          : []),
      ]
    }),
  ].sort((a, b) => Date.parse(a.em) - Date.parse(b.em))
  return passos.map((passo, indice) => ({
    ...passo,
    minutos:
      indice === 0
        ? null
        : Math.round((Date.parse(passo.em) - Date.parse(passos[indice - 1].em)) / 60_000),
  }))
}
