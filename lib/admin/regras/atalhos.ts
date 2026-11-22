export type Direcao = "esquerda" | "direita" | "cima" | "baixo"

/**
 * Para que ticket a seta leva, no quadro em colunas (os ids de cada coluna, em ordem).
 * Sem ticket em foco, vai para o primeiro do quadro.
 */
export function vizinhoNoQuadro(
  grade: string[][],
  atual: string | null,
  direcao: Direcao,
): string | null {
  const primeiro = grade.find((coluna) => coluna.length > 0)?.[0] ?? null
  const x = grade.findIndex((coluna) => atual !== null && coluna.includes(atual))
  if (x < 0) return primeiro
  const coluna = grade[x]
  const y = coluna.indexOf(atual as string)
  if (direcao === "cima") return coluna[Math.max(0, y - 1)]
  if (direcao === "baixo") return coluna[Math.min(coluna.length - 1, y + 1)]
  const passo = direcao === "direita" ? 1 : -1
  for (let outra = x + passo; outra >= 0 && outra < grade.length; outra += passo) {
    const vizinha = grade[outra]
    if (vizinha.length > 0) return vizinha[Math.min(vizinha.length - 1, y)]
  }
  return atual
}
