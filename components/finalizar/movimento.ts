import type { TargetAndTransition, Variants } from "motion/react"

/** Curva da casa para o que entra e sai: começa rápido, assenta devagar. */
export const CURVA_SAIDA = [0.23, 1, 0.32, 1] as const
/** Curva para o que se mexe na tela (abre, fecha, desliza). */
export const CURVA_TELA = [0.77, 0, 0.175, 1] as const

const DESLOCAMENTO = 24

/**
 * Troca de passo do checkout: crossfade com um leve deslocamento na direção do caminho
 * (avançar entra da direita, voltar entra da esquerda) e um desfoque curto para os dois
 * passos não brigarem. Usa `custom` (a direção) para o passo que sai saber para onde ir,
 * mesmo quando a direção mudou depois de ele aparecer.
 */
export function variantesDoPasso(reduzido: boolean): Variants {
  if (reduzido) {
    return {
      entrar: () => ({ opacity: 0 }),
      parado: { opacity: 1, transition: { duration: 0.2 } },
      sair: () => ({ opacity: 0, transition: { duration: 0.12 } }),
    }
  }
  return {
    entrar: (direcao: number) => ({
      opacity: 0,
      x: direcao * DESLOCAMENTO,
      filter: "blur(3px)",
    }),
    parado: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { duration: 0.26, ease: CURVA_SAIDA },
    },
    sair: (direcao: number) => ({
      opacity: 0,
      x: direcao * -DESLOCAMENTO,
      filter: "blur(3px)",
      transition: { duration: 0.16, ease: CURVA_SAIDA },
    }),
  }
}

/** Erro ao avançar: um empurrão curto na ação, nunca um tremor longo. */
export function retornoDeErro(reduzido: boolean): TargetAndTransition {
  if (reduzido) return { opacity: [1, 0.6, 1], transition: { duration: 0.24 } }
  return { x: [0, -4, 4, -2, 0], transition: { duration: 0.26, ease: "easeOut" } }
}
