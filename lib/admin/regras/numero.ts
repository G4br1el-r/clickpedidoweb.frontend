import { addDays, isSameDay, isSameMonth, parse } from "date-fns"

/**
 * Número do pedido novo. Sequencial, é o próprio id; mensal (lanchonete), segue o
 * último pedido no mesmo mês e recomeça do 1 no mês novo.
 */
export function proximoNumero({
  id,
  mensal,
  ultimo,
  agora,
}: {
  id: number
  mensal: boolean
  ultimo: { numero: number; criadoEm: string } | undefined
  agora: Date
}): number {
  if (!mensal) return id
  if (!ultimo || !isSameMonth(new Date(ultimo.criadoEm), agora)) return 1
  return ultimo.numero + 1
}

const DIAS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."]

/** "sáb., 14/11", a partir do dia guardado como 2026-11-14. */
function diaEData(dia: string): string {
  const data = parse(dia, "yyyy-MM-dd", new Date())
  const dd = String(data.getDate()).padStart(2, "0")
  const mm = String(data.getMonth() + 1).padStart(2, "0")
  return `${DIAS[data.getDay()]}, ${dd}/${mm}`
}

/** Açougue: "Retirar sáb., 14/11". */
export const textoRetirada = (dia: string) => `Retirar ${diaEData(dia)}`

/** Título de cada dia das próximas retiradas: "Amanhã, sáb., 14/11" ou "seg., 16/11". */
export function diaDaRetirada(dia: string, agora: Date): string {
  const amanha = isSameDay(parse(dia, "yyyy-MM-dd", agora), addDays(agora, 1))
  return amanha ? `Amanhã, ${diaEData(dia)}` : diaEData(dia)
}
