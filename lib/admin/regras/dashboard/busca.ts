import { min, startOfDay, startOfMonth, subWeeks } from "date-fns"
import { type Periodo, periodoAnterior } from "../periodo"

/**
 * Os dias que o Resumo precisa numa busca só: o período e o anterior (para comparar),
 * o mês corrente (para a meta) e o mesmo dia da semana passada, até hoje.
 */
export function periodoDaBusca(periodo: Periodo, agora: Date): Periodo {
  return {
    de: min([periodoAnterior(periodo).de, startOfMonth(agora), startOfDay(subWeeks(agora, 1))]),
    ate: startOfDay(agora),
  }
}
