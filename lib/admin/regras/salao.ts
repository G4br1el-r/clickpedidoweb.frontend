import type { Mesa, PosicaoMesa } from "../dados/tipos"

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

/**
 * Primeira posição do mapa da área em que a mesa nova cabe: varre linha a linha, da esquerda
 * para a direita, e recusa o que cruza outra mesa da mesma área (encostar na borda vale).
 * Devolve null quando a área não tem mais espaço.
 */
export function primeiraPosicaoLivre(
  mesas: Mesa[],
  areaId: string,
  nova: Pick<Mesa, "forma" | "lugares">,
): PosicaoMesa | null {
  const { largura, altura } = tamanhoDaMesa(nova)
  const ocupadas = mesas
    .filter((mesa) => mesa.areaId === areaId)
    .map((mesa) => ({ ...mesa.posicao, ...tamanhoDaMesa(mesa) }))
  for (let y = 0; y + altura <= GRADE_MAPA.linhas; y++) {
    for (let x = 0; x + largura <= GRADE_MAPA.colunas; x++) {
      const cruza = ocupadas.some(
        (o) => x < o.x + o.largura && o.x < x + largura && y < o.y + o.altura && o.y < y + altura,
      )
      if (!cruza) return { x, y }
    }
  }
  return null
}
