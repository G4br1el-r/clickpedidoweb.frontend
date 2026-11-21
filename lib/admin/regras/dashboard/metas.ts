import { addDays, eachDayOfInterval, endOfMonth, startOfDay, startOfMonth } from "date-fns"
import type { HorarioFuncionamento, Pedido } from "../../dados/tipos"
import { expediente } from "../agenda"
import { ehValido, noPeriodo, reais, soma } from "./comum"

export type Meta = { faturamento: number; pedidos: number | null }

export type SituacaoMeta = {
  mes: { meta: number; realizado: number; percentual: number }
  hoje: { meta: number; realizado: number }
  /** Onde o mês fecha no ritmo atual; `null` antes do 3º dia aberto. */
  projecao: number | null
  emRisco: boolean
  pedidos: { meta: number; realizado: number } | null
}

/** A partir desta hora, a meta de hoje pode ficar em risco. */
export const HORA_DO_RISCO = 18
/** A projeção só aparece a partir deste dia aberto do mês. */
export const DIA_DA_PROJECAO = 3

const abre = (dia: Date, horarios: HorarioFuncionamento[]) =>
  horarios.some((horario) => horario.dia === dia.getDay() && horario.aberto)

/** Quanto do expediente de hoje já passou, de 0 a 1. Expediente que vira a noite vai até o dia seguinte. */
function expedienteQuePassou(agora: Date, horarios: HorarioFuncionamento[]) {
  const hoje = expediente(agora, horarios)
  if (!hoje) return 0
  const fecha = hoje.fecha <= hoje.abre ? addDays(hoje.fecha, 1) : hoje.fecha
  const fracao = (agora.getTime() - hoje.abre.getTime()) / (fecha.getTime() - hoje.abre.getTime())
  return Math.min(1, Math.max(0, fracao))
}

/** Como está a meta do mês: o realizado, a meta de hoje, a projeção e o risco de não bater hoje. */
export function situacaoDaMeta(
  meta: Meta,
  pedidos: Pedido[],
  horarios: HorarioFuncionamento[],
  agora: Date,
): SituacaoMeta {
  const hoje = startOfDay(agora)
  const diasDoMes = eachDayOfInterval({ start: startOfMonth(agora), end: endOfMonth(agora) })
  const abertosAntes = diasDoMes.filter((dia) => dia < hoje && abre(dia, horarios)).length
  const abertosQueRestam = diasDoMes.filter((dia) => dia >= hoje && abre(dia, horarios)).length

  const doMes = noPeriodo(pedidos, { de: startOfMonth(agora), ate: agora }).filter(ehValido)
  const deHoje = doMes.filter((pedido) => Date.parse(pedido.criadoEm) >= hoje.getTime())
  const realizado = soma(doMes)
  const ateOntem = reais(realizado - soma(deHoje))

  const metaDeHoje = abertosQueRestam
    ? reais(Math.max(0, meta.faturamento - ateOntem) / abertosQueRestam)
    : 0
  const diaAberto = abertosAntes + (abre(hoje, horarios) ? 1 : 0)

  return {
    mes: { meta: meta.faturamento, realizado, percentual: (realizado / meta.faturamento) * 100 },
    hoje: { meta: metaDeHoje, realizado: soma(deHoje) },
    projecao:
      diaAberto >= DIA_DA_PROJECAO && abertosAntes > 0
        ? reais(ateOntem + (ateOntem / abertosAntes) * abertosQueRestam)
        : null,
    emRisco:
      agora.getHours() >= HORA_DO_RISCO &&
      soma(deHoje) < metaDeHoje * expedienteQuePassou(agora, horarios),
    pedidos: meta.pedidos === null ? null : { meta: meta.pedidos, realizado: doMes.length },
  }
}
