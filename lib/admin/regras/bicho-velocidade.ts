export type Bicho = "tartaruga" | "coelho"

/**
 * Como a tartaruga e o coelho do controle de velocidade se mexem. O escolhido cresce e anima
 * em laço (a tartaruga anda, o coelho pula); o outro fica parado e encolhe um pouco, mais
 * quanto mais perto o controle está do bicho oposto. Com movimento reduzido, nada se desloca
 * nem repete: só o tamanho muda.
 */
export function movimentoDoBicho({
  bicho,
  ativo,
  fracao,
  reduzido,
}: {
  bicho: Bicho
  /** Este é o lado escolhido. */
  ativo: boolean
  /** De 0 (tartaruga) a 1 (coelho): onde o controle está. */
  fracao: number
  reduzido: boolean
}) {
  const tamanho = bicho === "tartaruga" ? 1 - fracao * 0.15 : 0.85 + fracao * 0.15
  const tamanhoParado = Math.round(tamanho * 1000) / 1000
  if (reduzido) {
    return {
      animate: { x: 0, y: 0, rotate: 0, scale: ativo ? 1.2 : tamanhoParado },
      transition: { duration: 0 },
    }
  }
  if (bicho === "tartaruga") {
    return ativo
      ? {
          animate: { x: [0, 2.5, 0, -1, 0], rotate: [0, -5, 0, 3, 0], scale: 1.2 },
          transition: {
            duration: 2.2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut" as const,
          },
        }
      : { animate: { x: 0, rotate: 0, scale: tamanhoParado }, transition: { duration: 0.3 } }
  }
  return ativo
    ? {
        animate: { y: [0, -7, 0, -3, 0], rotate: [0, -8, 0, -4, 0], scale: 1.2 },
        transition: {
          duration: 0.55,
          repeat: Number.POSITIVE_INFINITY,
          repeatDelay: 0.35,
          ease: "easeOut" as const,
        },
      }
    : { animate: { y: 0, rotate: 0, scale: tamanhoParado }, transition: { duration: 0.3 } }
}
