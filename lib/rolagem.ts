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
