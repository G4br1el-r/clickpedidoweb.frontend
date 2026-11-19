import type { Mesa } from "../dados/tipos"

/** Grade do mapa de cada área, em células. */
export const GRADE_MAPA = { colunas: 24, linhas: 16 } as const

/** Tamanho da mesa no mapa, em células: quadrada e redonda 2 × 2, retangular 3 × 2 (4 × 2 a partir de 8 lugares). */
export function tamanhoDaMesa(mesa: Pick<Mesa, "forma" | "lugares">): {
  largura: number
  altura: number
} {
  if (mesa.forma !== "retangular") return { largura: 2, altura: 2 }
  return { largura: mesa.lugares >= 8 ? 4 : 3, altura: 2 }
}
