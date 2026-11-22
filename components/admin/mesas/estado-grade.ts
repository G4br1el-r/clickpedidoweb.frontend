"use client"

import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from "nuqs"
import type { FiltroEstadoMesa, OrdemMesas } from "@/lib/admin/regras/filtro-mesas"

/** Os estados do filtro, na ordem do Select, com o rótulo de cada um. É a lista única. */
export const ROTULOS_ESTADO = {
  livre: "Livre",
  reservada: "Reservada",
  ocupada: "Ocupada",
  "na-cozinha": "Na cozinha",
  servir: "Servir",
  "conta-pedida": "Pediu a conta",
  juntada: "Juntada",
  limpeza: "Limpeza",
  bloqueada: "Bloqueada",
} satisfies Partial<Record<FiltroEstadoMesa, string>>

/** Um estado que o filtro oferece. */
export type EstadoNoFiltro = keyof typeof ROTULOS_ESTADO

const ESTADOS = Object.keys(ROTULOS_ESTADO) as EstadoNoFiltro[]
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

export const VISTAS = ["grade", "mapa"] as const
export type Vista = (typeof VISTAS)[number]

/** Grade (o padrão, fora do endereço) ou mapa do salão (`?vista=mapa`). */
export function useVista() {
  return useQueryState("vista", parseAsStringLiteral(VISTAS).withDefault("grade"))
}

/** A mesa com a gaveta aberta, pelo número (`?mesa=3`). Sem a mesa, o parâmetro some. */
export function useMesaAberta() {
  return useQueryState("mesa", parseAsInteger)
}
