import { addDays, addMinutes, endOfDay, format, setHours, startOfDay } from "date-fns"
import type { HorarioFuncionamento, Pedido, StatusPedido } from "../dados/tipos"
import { filtrarPedidos } from "./filtro-pedidos"

/** De quanto em quanto tempo a agenda oferece horários. */
export const INTERVALO_MIN = 30

/** Atendimento que ainda ocupa a agenda: marcado ou em andamento. */
const ocupa = (pedido: Pedido) =>
  pedido.agendamento !== undefined &&
  (pedido.status === "recebido" || pedido.status === "em-preparo")

const minutosDe = (hora: string) => {
  const [h, m] = hora.split(":").map(Number)
  return h * 60 + m
}

const inicioDe = (pedido: Pedido) => Date.parse(pedido.agendamento?.inicio ?? pedido.criadoEm)
const fimDe = (pedido: Pedido) => inicioDe(pedido) + (pedido.agendamento?.duracaoMin ?? 0) * 60_000

/** Horário da loja no dia, ou `null` se fecha. */
export function expediente(dia: Date, horarios: HorarioFuncionamento[]) {
  const horario = horarios.find((item) => item.dia === dia.getDay())
  if (!horario?.aberto) return null
  const meiaNoite = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate())
  return {
    abre: addMinutes(meiaNoite, minutosDe(horario.abre)),
    fecha: addMinutes(meiaNoite, minutosDe(horario.fecha)),
  }
}

/** Quantos atendimentos acontecem ao mesmo tempo, no pior momento do intervalo. */
function picoNoIntervalo(inicio: number, fim: number, agendamentos: Pedido[]) {
  const cruzam = agendamentos.filter((item) => inicioDe(item) < fim && fimDe(item) > inicio)
  // O pico acontece no início do intervalo ou no início de algum atendimento dentro dele.
  const momentos = [inicio, ...cruzam.map(inicioDe).filter((momento) => momento > inicio)]
  return Math.max(
    0,
    ...momentos.map(
      (momento) =>
        cruzam.filter((item) => inicioDe(item) <= momento && fimDe(item) > momento).length,
    ),
  )
}

export type ConsultaHorarios = {
  dia: Date
  duracaoMin: number
  agendamentos: Pedido[]
  horarios: HorarioFuncionamento[]
  /** Quantos atendimentos cabem ao mesmo tempo. */
  capacidade: number
  agora: Date
  /** Na remarcação, o próprio agendamento não ocupa lugar. */
  ignorarId?: number
}

/**
 * Horários em que o serviço cabe: dia aberto, de 30 em 30 min, terminando até o
 * fechamento, ainda não passou e sem ultrapassar a capacidade em nenhum momento.
 */
export function horariosLivres({
  dia,
  duracaoMin,
  agendamentos,
  horarios,
  capacidade,
  agora,
  ignorarId,
}: ConsultaHorarios): Date[] {
  const dele = expediente(dia, horarios)
  if (!dele) return []
  // Só o que cai no expediente deste dia: a agenda inteira pode ter meses.
  const abre = dele.abre.getTime()
  const fecha = dele.fecha.getTime()
  const ativos = agendamentos.filter(
    (item) => ocupa(item) && item.id !== ignorarId && inicioDe(item) < fecha && fimDe(item) > abre,
  )
  const livres: Date[] = []
  for (
    let inicio = dele.abre;
    addMinutes(inicio, duracaoMin) <= dele.fecha;
    inicio = addMinutes(inicio, INTERVALO_MIN)
  ) {
    if (inicio < agora) continue
    const fim = addMinutes(inicio, duracaoMin).getTime()
    if (picoNoIntervalo(inicio.getTime(), fim, ativos) < capacidade) livres.push(inicio)
  }
  return livres
}

/**
 * Posição dos blocos na linha do tempo: quem se cruza fica lado a lado. `faixas` é
 * quantas colunas o grupo de atendimentos que se cruzam precisa.
 */
export function faixasDoDia(
  agendamentos: Pedido[],
): Map<number, { faixa: number; faixas: number }> {
  const resultado = new Map<number, { faixa: number; faixas: number }>()
  const ordenados = agendamentos.toSorted((a, b) => inicioDe(a) - inicioDe(b) || a.id - b.id)
  let grupo: Pedido[] = []
  let fimDoGrupo = -Infinity
  // Em cada faixa, quando ela fica livre.
  let livreEm: number[] = []

  const fecharGrupo = () => {
    for (const item of grupo) {
      const atual = resultado.get(item.id)
      if (atual) atual.faixas = livreEm.length
    }
    grupo = []
    livreEm = []
    fimDoGrupo = -Infinity
  }

  for (const item of ordenados) {
    if (inicioDe(item) >= fimDoGrupo) fecharGrupo()
    let faixa = livreEm.findIndex((momento) => momento <= inicioDe(item))
    if (faixa < 0) faixa = livreEm.push(0) - 1
    livreEm[faixa] = fimDe(item)
    resultado.set(item.id, { faixa, faixas: 0 })
    grupo.push(item)
    fimDoGrupo = Math.max(fimDoGrupo, fimDe(item))
  }
  fecharGrupo()
  return resultado
}

type Contagem = { quantidade: number; total: number }

/** Hoje, amanhã e os próximos 7 dias (com hoje), pelo dia do atendimento e sem cancelados. */
export function resumoDaAgenda(pedidos: Pedido[], agora: Date) {
  const hoje = startOfDay(agora)
  const contar = (de: Date, ate: Date): Contagem => {
    const nele = pedidos.filter(
      (pedido) =>
        pedido.agendamento &&
        pedido.status !== "cancelado" &&
        inicioDe(pedido) >= de.getTime() &&
        inicioDe(pedido) < ate.getTime(),
    )
    return {
      quantidade: nele.length,
      total: Math.round(nele.reduce((soma, pedido) => soma + pedido.total, 0) * 100) / 100,
    }
  }
  return {
    hoje: contar(hoje, addDays(hoje, 1)),
    amanha: contar(addDays(hoje, 1), addDays(hoje, 2)),
    semana: contar(hoje, addDays(hoje, 7)),
  }
}

export type FiltroAgenda = { busca?: string; status?: StatusPedido[]; de?: Date; ate?: Date }

/** Lista da agenda: só agendamentos, pelo período e a hora do atendimento, com busca e status. */
export function listaDaAgenda(pedidos: Pedido[], { busca, status, de, ate }: FiltroAgenda) {
  const inicio = de ? startOfDay(de).getTime() : -Infinity
  const fim = ate ? endOfDay(ate).getTime() : Infinity
  const doPeriodo = pedidos.filter(
    (pedido) => pedido.agendamento && inicioDe(pedido) >= inicio && inicioDe(pedido) <= fim,
  )
  return filtrarPedidos(doPeriodo, {
    ...(busca ? { busca } : {}),
    ...(status ? { status } : {}),
  }).toSorted((a, b) => inicioDe(a) - inicioDe(b))
}

/** Os lembretes que a loja manda sozinha (simulados): na véspera às 18h e 1 h antes. */
function lembretesDoAgendamento(pedido: Pedido) {
  if (!pedido.agendamento) return []
  const inicio = new Date(pedido.agendamento.inicio)
  const vespera = setHours(startOfDay(addDays(inicio, -1)), 18)
  const criado = Date.parse(pedido.criadoEm)
  return [
    { nome: "véspera", em: vespera },
    { nome: "1 h antes", em: addMinutes(inicio, -60) },
  ].filter((lembrete) => lembrete.em.getTime() >= criado)
}

/**
 * "Lembretes: véspera enviado · 1 h antes às 14:00": o que já saiu e quando sai o próximo.
 * Marcado depois da hora de um lembrete, aquele não sai. Sem nenhum, `null`.
 */
export function textoDosLembretes(pedido: Pedido, agora: Date): string | null {
  const lembretes = lembretesDoAgendamento(pedido)
  if (lembretes.length === 0) return null
  const partes = lembretes.map(({ nome, em }) =>
    em <= agora ? `${nome} enviado` : `${nome} às ${format(em, "HH:mm")}`,
  )
  return `Lembretes: ${partes.join(" · ")}`
}
