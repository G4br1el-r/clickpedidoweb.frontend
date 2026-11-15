/** Folga para arredondamentos de subpixel: menos que isso não conta como rolagem. */
const FOLGA = 1

type MedidasDaRolagem = {
  /** Quanto já rolou (scrollLeft). */
  posicao: number
  /** Largura de todo o conteúdo (scrollWidth). */
  total: number
  /** Largura à vista (clientWidth). */
  visivel: number
}

/** Quais setas fazem sentido: só aparece a que ainda tem para onde rolar. */
export function setasDaRolagem({ posicao, total, visivel }: MedidasDaRolagem) {
  return {
    anterior: posicao > FOLGA,
    proxima: posicao + visivel < total - FOLGA,
  }
}

/** Cada toque na seta anda 80% do que está à vista: o último item visível continua de referência. */
export function distanciaDaSeta(visivel: number) {
  return Math.floor(visivel * 0.8)
}

/**
 * Máscara de uma lista que rola na vertical: esmaece só a borda que ainda tem conteúdo,
 * no lugar da barra de rolagem. O pé esmaece um pouco mais, porque é para lá que se rola.
 * Com tudo à vista, nada esmaece.
 */
export function mascaraDaRolagem(medidas: MedidasDaRolagem): string | undefined {
  const { anterior: temAcima, proxima: temAbaixo } = setasDaRolagem(medidas)
  if (!temAcima && !temAbaixo) return undefined
  const inicio = temAcima ? "transparent 0, #000 24px" : "#000 0"
  const fim = temAbaixo ? "#000 calc(100% - 32px), transparent 100%" : "#000 100%"
  return `linear-gradient(to bottom, ${inicio}, ${fim})`
}
