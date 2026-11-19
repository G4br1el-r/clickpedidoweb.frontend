import type { Mesa, PosicaoMesa } from "../dados/tipos"

/** Grade do mapa de cada área, em células. */
export const GRADE_MAPA = { colunas: 24, linhas: 16 } as const

/** Tamanho da mesa no mapa, em células: quadrada e redonda 2 × 2, retangular 3 × 2 (4 × 2 com mais de 6 lugares). */
export function tamanhoDaMesa(mesa: Pick<Mesa, "forma" | "lugares">): {
  largura: number
  altura: number
} {
  if (mesa.forma !== "retangular") return { largura: 2, altura: 2 }
  return { largura: mesa.lugares > 6 ? 4 : 3, altura: 2 }
}

type Retangulo = Pick<Mesa, "forma" | "lugares" | "posicao">

/** Duas mesas se cruzam quando seus retângulos no mapa se sobrepõem; encostar na borda não conta. */
export function mesasSeCruzam(a: Retangulo, b: Retangulo): boolean {
  const ta = tamanhoDaMesa(a)
  const tb = tamanhoDaMesa(b)
  return (
    a.posicao.x < b.posicao.x + tb.largura &&
    b.posicao.x < a.posicao.x + ta.largura &&
    a.posicao.y < b.posicao.y + tb.altura &&
    b.posicao.y < a.posicao.y + ta.altura
  )
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
  const daArea = mesas.filter((mesa) => mesa.areaId === areaId)
  for (let y = 0; y + altura <= GRADE_MAPA.linhas; y++) {
    for (let x = 0; x + largura <= GRADE_MAPA.colunas; x++) {
      const candidata = { ...nova, posicao: { x, y } }
      if (!daArea.some((outra) => mesasSeCruzam(candidata, outra))) return { x, y }
    }
  }
  return null
}
