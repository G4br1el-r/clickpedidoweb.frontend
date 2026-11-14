import { isSameMonth, parse } from "date-fns"

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

/** Açougue: "Retirar sáb., 14/11", a partir do dia guardado como 2026-11-14. */
export function textoRetirada(dia: string): string {
  const data = parse(dia, "yyyy-MM-dd", new Date())
  const dd = String(data.getDate()).padStart(2, "0")
  const mm = String(data.getMonth() + 1).padStart(2, "0")
  return `Retirar ${DIAS[data.getDay()]}, ${dd}/${mm}`
}
