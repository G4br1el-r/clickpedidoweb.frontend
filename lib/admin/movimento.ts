import type { Variants } from "motion/react"

/** Curva da casa: começa rápido e assenta devagar. Nunca `ease-in` em interface. */
export const CURVA_SAIDA = [0.23, 1, 0.32, 1] as const

/** Tempos em segundos. A saída é sempre mais curta que a entrada: o painel responde, não encena. */
export const DURACAO = {
  /** Toque, troca de estado, o que a pessoa acabou de acionar. */
  rapida: 0.12,
  /** Saída de itens, janelas e blocos. */
  saida: 0.16,
  /** Entrada de itens e de janelas. */
  entrada: 0.24,
  /** Entrada de uma página inteira. */
  pagina: 0.28,
} as const

type OpcoesEscalonamento = {
  /** Espera entre um item e o seguinte, em segundos. */
  passo?: number
  /** Quantos itens entram em sequência; do próximo em diante, todos esperam o mesmo. */
  teto?: number
}

/**
 * Espera do item na lista. A sequência para no teto: numa lista de 200 pedidos,
 * o último não pode demorar mais para aparecer que o oitavo.
 */
export function atrasoEscalonado(
  indice: number,
  { passo = 0.04, teto = 8 }: OpcoesEscalonamento = {},
) {
  return Math.min(indice, teto) * passo
}

/**
 * A entrada (aparecer subindo) é do CSS (`.entra-bloco` e `.entra-item`, em admin.css): roda
 * na primeira pintura, sem esperar o JavaScript nem depender do relógio dele. Por isso o estado
 * `entrar` dos variantes já é o visível, e o Motion cuida só da SAÍDA (`sair`).
 */
const VISIVEL = { opacity: 1, y: 0 } as const
const VISIVEL_SEM_MOVIMENTO = { opacity: 1 } as const

/** Passa para o CSS a espera do item na lista (`--atraso`), com o mesmo teto do Motion. */
export function estiloDeEntrada(indice: number, opcoes?: OpcoesEscalonamento) {
  return { "--atraso": `${atrasoEscalonado(indice, opcoes)}s` } as Record<string, string>
}

/** Bloco que chega sozinho: a página, uma seção, um painel. Sai subindo 4 px e sumindo. */
export function variantesDoBloco(reduzido: boolean): Variants {
  if (reduzido) {
    return {
      entrar: VISIVEL_SEM_MOVIMENTO,
      parado: { opacity: 1, transition: { duration: DURACAO.entrada } },
      sair: { opacity: 0, transition: { duration: DURACAO.rapida } },
    }
  }
  return {
    entrar: VISIVEL,
    parado: { opacity: 1, y: 0, transition: { duration: DURACAO.pagina, ease: CURVA_SAIDA } },
    sair: { opacity: 0, y: -4, transition: { duration: DURACAO.saida, ease: CURVA_SAIDA } },
  }
}

/**
 * Linha ou cartão de uma lista. O `custom` é a posição do item: cada um entra um pouco
 * depois do anterior. Quem sai não espera ninguém.
 */
export function variantesDoItem(reduzido: boolean): Variants {
  if (reduzido) {
    return {
      entrar: VISIVEL_SEM_MOVIMENTO,
      parado: () => ({ opacity: 1, transition: { duration: DURACAO.entrada, delay: 0 } }),
      sair: { opacity: 0, transition: { duration: DURACAO.rapida } },
    }
  }
  return {
    entrar: VISIVEL,
    parado: (indice: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: DURACAO.entrada, ease: CURVA_SAIDA, delay: atrasoEscalonado(indice) },
    }),
    sair: { opacity: 0, transition: { duration: DURACAO.saida, ease: CURVA_SAIDA } },
  }
}

/** Janela, menu e painel que abrem sobre a tela. Parte de 96%, nunca de zero. */
export function variantesDaJanela(reduzido: boolean): Variants {
  if (reduzido) {
    return {
      entrar: { opacity: 0 },
      parado: { opacity: 1, transition: { duration: DURACAO.entrada } },
      sair: { opacity: 0, transition: { duration: DURACAO.rapida } },
    }
  }
  return {
    entrar: { opacity: 0, scale: 0.96 },
    parado: { opacity: 1, scale: 1, transition: { duration: DURACAO.entrada, ease: CURVA_SAIDA } },
    sair: { opacity: 0, scale: 0.98, transition: { duration: DURACAO.saida, ease: CURVA_SAIDA } },
  }
}

/**
 * Passado como `onUpdate` de um `motion.*`, tira a animação do WAAPI e a deixa no JavaScript.
 * Quando o relógio da página está parado ou adiantado (testes com hora fixa), a animação nativa
 * começa no futuro e o item que sai não sai: fica na tela segurando a lista.
 */
export function semRelogioDoNavegador() {}
