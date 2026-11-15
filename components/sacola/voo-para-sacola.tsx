"use client"

import { motion } from "motion/react"
import { useVoos } from "@/lib/voo"

/** A curva de saída da casa: começa rápido e assenta macio. */
const SAIDA = [0.23, 1, 0.32, 1] as const
/** Tempo do deslize; a sacola reage quando ele termina (CHEGADA_S na barra e no ícone). */
const DURACAO_S = 0.3

/**
 * Camada das etiquetas a caminho da sacola: a etiqueta do produto se solta e desliza
 * até a sacola. Não recebe cliques e fica fora da leitura de tela.
 */
export function VooParaSacola() {
  const voos = useVoos((estado) => estado.voos)
  const concluir = useVoos((estado) => estado.concluir)

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {voos.map(({ id, rotulo, de, para }) => (
        <motion.div
          key={id}
          data-testid="voo"
          className="absolute top-0 left-0"
          // Nasce já visível, no lugar da etiqueta, e encolhe ao entrar na sacola.
          initial={{ x: de.x, y: de.y, scale: 1, opacity: 1 }}
          animate={{ x: para.x, y: para.y, scale: 0.6, opacity: [1, 1, 0] }}
          transition={{
            duration: DURACAO_S,
            ease: SAIDA,
            opacity: { duration: DURACAO_S, times: [0, 0.8, 1] },
          }}
          onAnimationComplete={() => concluir(id)}
        >
          {/* A mesma etiqueta da linha, agora solta: o traço da loja e o preço. */}
          <span className="sombra-flutuante flex h-8 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg bg-card px-2.5 text-[15px] font-semibold tracking-[-0.01em] whitespace-nowrap text-card-foreground tabular-nums ring-1 ring-border">
            <span aria-hidden="true" className="h-3.5 w-[3px] rounded-full bg-primary" />
            {rotulo}
          </span>
        </motion.div>
      ))}
    </div>
  )
}
