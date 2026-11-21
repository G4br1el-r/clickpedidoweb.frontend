"use client"

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import type { FiltroEstadoMesa, OrdemMesas } from "@/lib/admin/regras/filtro-mesas"

/** Os estados do filtro, na ordem do Select, com o rótulo de cada um. É a lista única. */
export const ROTULOS_ESTADO = {
  livre: "Livre",
  ocupada: "Ocupada",
  "na-cozinha": "Na cozinha",
  servir: "Servir",
  "conta-pedida": "Pediu a conta",
  reservada: "Reservada",
  limpeza: "Limpeza",
  bloqueada: "Bloqueada",
  juntada: "Juntada",
} satisfies Record<FiltroEstadoMesa, string>

const ESTADOS = Object.keys(ROTULOS_ESTADO) as FiltroEstadoMesa[]
const ORDENS: readonly OrdemMesas[] = ["numero", "tempo"]

/** Busca, filtros e ordem da grade de mesas, no endereço da página. O padrão não aparece. */
export const PARAMETROS_GRADE = {
  busca: parseAsString.withDefault(""),
  area: parseAsString,
  estado: parseAsStringLiteral(ESTADOS),
  garcom: parseAsString,
  atencao: parseAsStringLiteral(["sim"] as const),
  ordem: parseAsStringLiteral(ORDENS).withDefault("numero"),
}

export function useEstadoGrade() {
  return useQueryStates(PARAMETROS_GRADE)
}

/** Tudo de volta ao padrão: o endereço fica limpo. */
export const LIMPAR_GRADE = {
  busca: null,
  area: null,
  estado: null,
  garcom: null,
  atencao: null,
  ordem: null,
} satisfies Record<keyof typeof PARAMETROS_GRADE, null>
