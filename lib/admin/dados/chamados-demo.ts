import { addMinutes, format } from "date-fns"
import type { Chamado, Mesa } from "./tipos"

/**
 * O chamado da demonstração no dia de `agora`: a primeira mesa ocupada (pelo número) chamou o
 * garçom há 3 min. O id leva a data: o dia seguinte não repete.
 */
export function chamadosDemo(mesas: Mesa[], agora: Date): Chamado[] {
  const [mesa] = mesas
    .filter((item) => item.status === "ocupada" && !item.juntadaCom)
    .toSorted((a, b) => a.numero - b.numero)
  if (!mesa) return []
  return [
    {
      id: `chamado-${format(agora, "yyyyMMdd")}-1`,
      mesaId: mesa.id,
      tipo: "garcom",
      criadoEm: addMinutes(agora, -3).toISOString(),
    },
  ]
}
