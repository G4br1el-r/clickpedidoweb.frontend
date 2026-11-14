import { addDays, format, parseISO, startOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { HorarioFuncionamento } from "./admin/dados/tipos"
import { expediente, horariosLivres } from "./admin/regras/agenda"

/** Salão: quanto tempo os serviços da sacola tomam juntos (60 min quando o serviço não diz). */
export function duracaoDaSacola(itens: { duracaoMin?: number; quantidade: number }[]): number {
  return itens.reduce((soma, item) => soma + (item.duracaoMin ?? 60) * item.quantidade, 0)
}

/** Os próximos `quantos` dias em que a loja abre, a partir de hoje (hoje só se ainda abre). */
export function diasParaAgendar(
  horarios: HorarioFuncionamento[],
  agora: Date,
  quantos = 7,
): Date[] {
  const dias: Date[] = []
  for (let passo = 0; dias.length < quantos && passo < 60; passo += 1) {
    const dia = addDays(startOfDay(agora), passo)
    const aberto = expediente(dia, horarios)
    if (aberto && aberto.fecha > agora) dias.push(dia)
  }
  return dias
}

/**
 * Horários do dia em que todos os serviços cabem antes de fechar, sem passar da capacidade.
 * A vitrine não vê a agenda da loja: a demonstração parte dela vazia.
 */
export function horariosParaAgendar(consulta: {
  dia: Date
  duracaoMin: number
  horarios: HorarioFuncionamento[]
  capacidade: number
  agora: Date
}): Date[] {
  return horariosLivres({ ...consulta, agendamentos: [] })
}

/** "sábado, 14/11, às 10:00": como a revisão e o acompanhamento mostram o horário. */
export function textoDoHorario(inicio: string): string {
  return format(parseISO(inicio), "EEEE, dd/MM, 'às' HH:mm", { locale: ptBR })
}
