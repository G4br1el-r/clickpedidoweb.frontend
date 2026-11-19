export type Seta = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
export type AcaoDoAtalho =
  | "mover"
  | "avancar"
  | "aceitar"
  | "recusar"
  | "imprimir"
  | "buscar"
  | "ajuda"

const SETAS: readonly string[] = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]

const ACOES: Record<string, AcaoDoAtalho> = {
  enter: "avancar",
  a: "aceitar",
  r: "recusar",
  p: "imprimir",
  "/": "buscar",
  "?": "ajuda",
}

/** O que a tecla faz na fila (só no computador, fora de campo de texto). */
export function acaoDaTecla(tecla: string): AcaoDoAtalho | null {
  if (SETAS.includes(tecla)) return "mover"
  return ACOES[tecla.toLowerCase()] ?? null
}

/**
 * O cartão que a seta leva: para cima e para baixo na coluna, para os lados pulando coluna
 * vazia e mantendo a altura que der. Nas pontas, fica onde está. Sem foco, o primeiro.
 */
export function vizinho(colunas: number[][], atual: number | null, seta: Seta): number | null {
  const cheias = colunas.filter((coluna) => coluna.length > 0)
  if (cheias.length === 0) return null
  const coluna = cheias.findIndex((ids) => atual !== null && ids.includes(atual))
  if (coluna < 0) return cheias[0][0]
  const linha = cheias[coluna].indexOf(atual as number)
  switch (seta) {
    case "ArrowUp":
      return cheias[coluna][Math.max(0, linha - 1)]
    case "ArrowDown":
      return cheias[coluna][Math.min(cheias[coluna].length - 1, linha + 1)]
    case "ArrowLeft":
    case "ArrowRight": {
      const destino = seta === "ArrowLeft" ? coluna - 1 : coluna + 1
      if (destino < 0 || destino >= cheias.length) return atual
      const ids = cheias[destino]
      return ids[Math.min(ids.length - 1, linha)]
    }
  }
}
