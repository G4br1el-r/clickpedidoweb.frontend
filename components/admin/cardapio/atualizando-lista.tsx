"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { CURVA_SAIDA, semRelogioDoNavegador } from "@/lib/admin/movimento"
import { Carregador } from "../movimento/carregador"

/**
 * Fio que corre no topo de uma lista enquanto ela confere com o servidor. Fica por cima, no
 * pai com `relative`, e não ocupa espaço. Só aparece se a conferência demora (250 ms): a que
 * termina logo não pisca. Só opacidade, nunca mexe no tamanho da lista.
 */
export function AtualizandoLista({
  atualizando,
  rotulo,
}: {
  atualizando: boolean
  /** O que o leitor de tela diz enquanto atualiza. */
  rotulo: string
}) {
  const reduzido = useReducedMotion()
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2.5 z-10 h-0.5 text-muted-foreground">
      <AnimatePresence>
        {atualizando && (
          <motion.div
            key="atualizando"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.12, delay: reduzido ? 0 : 0.25 } }}
            onUpdate={semRelogioDoNavegador}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: CURVA_SAIDA } }}
          >
            <Carregador variante="barra" rotulo={rotulo} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
