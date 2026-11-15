"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { registroSegmentos } from "@/components/segmentos/registro"
import { Progress } from "@/components/ui/progress"
import { useLoja } from "@/lib/loja-atual"
import type { ItemSacola } from "@/lib/sacola"
import { CURVA_SAIDA } from "./movimento"

/** Tempo total do envio; dividido em quatro etapas iguais. */
export const DURACAO_ENVIO_MS = 5000
const ETAPAS = 4

const MENSAGENS_PADRAO = [
  "Recebendo seu pedido",
  "Separando os itens",
  "Preparando tudo",
  "Quase lá!",
]

/**
 * Carregamento do envio do pedido, temático por segmento (na pizzaria, a pizza sendo
 * montada e indo ao forno). Dura 5 segundos, em quatro etapas: a arte do nicho muda,
 * a frase troca num crossfade e o fio de progresso enche em linha reta.
 */
export function CarregamentoEnvio({ itens }: { itens: ItemSacola[] }) {
  const lojaEscolhida = useLoja()
  const { ArteEnvio, mensagensEnvio } = registroSegmentos[lojaEscolhida.segmento]
  const mensagens = mensagensEnvio ?? MENSAGENS_PADRAO
  const reduzido = useReducedMotion()
  const [etapa, setEtapa] = useState(0)
  const [progresso, setProgresso] = useState(0)

  useEffect(() => {
    // O progresso enche em linha reta pelos 5 segundos (transição em CSS).
    const quadro = requestAnimationFrame(() => setProgresso(100))
    const passos = Array.from({ length: ETAPAS - 1 }, (_, indice) =>
      setTimeout(() => setEtapa(indice + 1), ((indice + 1) * DURACAO_ENVIO_MS) / ETAPAS),
    )
    return () => {
      cancelAnimationFrame(quadro)
      for (const passo of passos) clearTimeout(passo)
    }
  }, [])

  return (
    <motion.div
      role="status"
      aria-label="Enviando seu pedido"
      data-testid="carregamento-envio"
      className="fixed inset-0 z-50 grid place-items-center bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.28, ease: CURVA_SAIDA }}
    >
      {/* O conteúdo chega um instante depois do fundo, subindo pouco: a tela "assenta". */}
      <motion.div
        className="flex w-full max-w-sm flex-col items-center px-6 text-center"
        initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.06, ease: CURVA_SAIDA }}
      >
        <ArteEnvio etapa={etapa} itens={itens} />

        {/* As frases dividem a mesma célula: a nova entra enquanto a antiga sai, sem pular. */}
        <div aria-live="polite" className="mt-8 grid min-h-9 w-full place-items-center">
          <AnimatePresence initial={false}>
            <motion.p
              key={etapa}
              className="col-start-1 row-start-1 text-2xl leading-9 font-semibold tracking-[-0.022em] text-balance md:text-[26px]"
              initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={
                reduzido
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : {
                      opacity: 0,
                      y: -10,
                      filter: "blur(3px)",
                      transition: { duration: 0.2, ease: CURVA_SAIDA },
                    }
              }
              transition={{ duration: 0.34, ease: CURVA_SAIDA }}
            >
              {mensagens[etapa]}
            </motion.p>
          </AnimatePresence>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{lojaEscolhida.nome}</p>

        <div className="mt-7 flex w-60 flex-col gap-2 md:w-72">
          <Progress
            value={progresso}
            aria-label="Andamento do envio"
            className="h-[3px] bg-border [&_[data-slot=progress-indicator]]:duration-[4800ms] [&_[data-slot=progress-indicator]]:ease-linear"
          />
          <p className="text-[13px] text-muted-foreground tabular-nums">
            Etapa {etapa + 1} de {ETAPAS}
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
