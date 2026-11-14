import {
  differenceInCalendarDays,
  isValid,
  max,
  min,
  parse,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns"

export type Atalho = "hoje" | "ontem" | "7d" | "15d" | "30d" | "mes"

/** Intervalo de dias inteiros: `de` e `ate` são o começo de cada dia. */
export type Periodo = { de: Date; ate: Date }

export const ATALHOS: readonly { id: Atalho; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "ontem", rotulo: "Ontem" },
  { id: "7d", rotulo: "7 dias" },
  { id: "15d", rotulo: "15 dias" },
  { id: "30d", rotulo: "30 dias" },
  { id: "mes", rotulo: "Este mês" },
]

/** O painel guarda 90 dias de histórico. */
export const MAXIMO_DE_DIAS = 90

export function periodoDoAtalho(atalho: Atalho, agora: Date): Periodo {
  const hoje = startOfDay(agora)
  switch (atalho) {
    case "hoje":
      return { de: hoje, ate: hoje }
    case "ontem":
      return { de: subDays(hoje, 1), ate: subDays(hoje, 1) }
    case "7d":
      return { de: subDays(hoje, 6), ate: hoje }
    case "15d":
      return { de: subDays(hoje, 14), ate: hoje }
    case "30d":
      return { de: subDays(hoje, 29), ate: hoje }
    case "mes":
      return { de: startOfMonth(hoje), ate: hoje }
  }
}

export function diasNoPeriodo({ de, ate }: Periodo): number {
  return differenceInCalendarDays(ate, de) + 1
}

/** O período de mesmo tamanho que termina na véspera. */
export function periodoAnterior(periodo: Periodo): Periodo {
  const ate = subDays(periodo.de, 1)
  return { de: subDays(ate, diasNoPeriodo(periodo) - 1), ate }
}

const lerData = (texto?: string) =>
  texto ? parse(texto, "yyyy-MM-dd", new Date()) : new Date(Number.NaN)

/**
 * Período a partir das datas do endereço (`yyyy-MM-dd`). Datas inválidas ou invertidas
 * voltam aos últimos 7 dias; o fim não passa de hoje e o intervalo, de 90 dias.
 */
export function normalizarPeriodo(
  { de, ate }: { de?: string | null; ate?: string | null },
  agora: Date,
): Periodo & { atalho?: Atalho } {
  const hoje = startOfDay(agora)
  const inicio = lerData(de ?? undefined)
  const fim = lerData(ate ?? undefined)
  let periodo: Periodo
  if (!isValid(inicio) || !isValid(fim) || inicio > fim) {
    periodo = periodoDoAtalho("7d", agora)
  } else {
    const ateAjustado = min([fim, hoje])
    periodo = {
      de: max([min([inicio, ateAjustado]), subDays(ateAjustado, MAXIMO_DE_DIAS - 1)]),
      ate: ateAjustado,
    }
  }
  const atalho = ATALHOS.find(({ id }) => {
    const candidato = periodoDoAtalho(id, agora)
    return (
      candidato.de.getTime() === periodo.de.getTime() &&
      candidato.ate.getTime() === periodo.ate.getTime()
    )
  })?.id
  return atalho ? { ...periodo, atalho } : periodo
}
