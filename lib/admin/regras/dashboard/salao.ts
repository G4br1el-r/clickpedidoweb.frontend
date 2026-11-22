import { addDays, eachDayOfInterval, endOfDay, startOfDay } from "date-fns"
import type { HorarioFuncionamento, Pedido } from "../../dados/tipos"
import { expediente, horariosLivres, INTERVALO_MIN } from "../agenda"
import type { Periodo } from "../periodo"
import { reais, soma } from "./comum"

/** Atendimentos marcados para um dia do período, pela hora do atendimento. */
const marcadosNoPeriodo = (pedidos: Pedido[], { de, ate }: Periodo) => {
  const inicio = startOfDay(de).getTime()
  const fim = endOfDay(ate).getTime()
  return pedidos.filter((pedido) => {
    if (!pedido.agendamento) return false
    const quando = Date.parse(pedido.agendamento.inicio)
    return quando >= inicio && quando <= fim
  })
}

export type Agenda = { horarios: HorarioFuncionamento[]; capacidade: number; periodo: Periodo }

/**
 * Quanto da agenda foi ocupada: os minutos marcados (sem os cancelados) sobre os minutos em
 * que a loja abriu no período, vezes quantos atendimentos cabem ao mesmo tempo.
 */
export function ocupacaoDaAgenda(pedidos: Pedido[], { horarios, capacidade, periodo }: Agenda) {
  const disponiveis = eachDayOfInterval({ start: periodo.de, end: periodo.ate }).reduce(
    (total, dia) => {
      const aberto = expediente(dia, horarios)
      return aberto
        ? total + ((aberto.fecha.getTime() - aberto.abre.getTime()) / 60_000) * capacidade
        : total
    },
    0,
  )
  const marcados = marcadosNoPeriodo(pedidos, periodo)
    .filter((pedido) => pedido.status !== "cancelado")
    .reduce((total, pedido) => total + (pedido.agendamento?.duracaoMin ?? 0), 0)
  return {
    marcados,
    disponiveis,
    percentual: disponiveis ? (marcados / disponiveis) * 100 : 0,
  }
}

/** Horários de 30 minutos ainda livres hoje (dali em diante) e amanhã, pela capacidade. */
export function vagosHojeEAmanha(
  pedidos: Pedido[],
  { horarios, capacidade, agora }: Omit<Agenda, "periodo"> & { agora: Date },
) {
  const livres = (dia: Date) =>
    horariosLivres({
      dia,
      duracaoMin: INTERVALO_MIN,
      agendamentos: pedidos,
      horarios,
      capacidade,
      agora,
    }).length
  return { hoje: livres(agora), amanha: livres(addDays(startOfDay(agora), 1)) }
}

/** Serviços dos atendimentos marcados para o período (sem os cancelados), do mais marcado ao menos. */
export function servicosMaisAgendados(pedidos: Pedido[], periodo: Periodo) {
  const servicos = new Map<string, { nome: string; vezes: number; total: number }>()
  for (const pedido of marcadosNoPeriodo(pedidos, periodo)) {
    if (pedido.status === "cancelado") continue
    for (const item of pedido.itens) {
      const atual = servicos.get(item.nome) ?? { nome: item.nome, vezes: 0, total: 0 }
      servicos.set(item.nome, {
        nome: item.nome,
        vezes: atual.vezes + item.quantidade,
        total: reais(atual.total + item.total),
      })
    }
  }
  return [...servicos.values()].sort((a, b) => b.vezes - a.vezes || b.total - a.total)
}

/** Dos atendimentos marcados para o período, quantos cancelaram e o valor que deixou de entrar. */
export function cancelamentosDaAgenda(pedidos: Pedido[], periodo: Periodo) {
  const marcados = marcadosNoPeriodo(pedidos, periodo)
  const cancelados = marcados.filter((pedido) => pedido.status === "cancelado")
  return {
    marcados: marcados.length,
    cancelados: cancelados.length,
    taxa: marcados.length ? (cancelados.length / marcados.length) * 100 : 0,
    perdido: soma(cancelados),
  }
}
