"use client"

import { AnimatePresence, motion } from "motion/react"
import { DURACAO, semRelogioDoNavegador } from "@/lib/admin/movimento"
import { Carregador } from "../movimento/carregador"

/**
 * Fio que corre acima de uma lista ou tabela quando os dados estão sendo conferidos de novo.
 * A altura fica reservada mesmo parado: a lista não pula quando o fio chega nem quando some.
 * Só opacidade: é uma resposta de fundo, não pede atenção.
 */
export function FioDeAtualizacao({ ativo, rotulo }: { ativo: boolean; rotulo: string }) {
  return (
    <div className="-mb-3 h-0.5">
      <AnimatePresence>
        {ativo && (
          <motion.div
            key="fio"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onUpdate={semRelogioDoNavegador}
            exit={{ opacity: 0 }}
            transition={{ duration: DURACAO.rapida }}
            className="text-muted-foreground"
          >
            <Carregador variante="barra" rotulo={rotulo} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
