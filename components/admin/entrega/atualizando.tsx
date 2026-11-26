"use client"

import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"
import { DURACAO, semRelogioDoNavegador } from "@/lib/admin/movimento"
import { cn } from "@/lib/utils"
import { Carregador } from "../movimento/carregador"

/** Atualização mais curta que isto passa sem aparecer: um carregador que pisca é ruído. */
const ATRASO_PARA_MOSTRAR_MS = 300

/** Verdadeiro só depois que `ativo` se mantém por `atraso` ms; volta a falso na hora. */
function useDemorou(ativo: boolean, atraso = ATRASO_PARA_MOSTRAR_MS) {
  const [demorou, setDemorou] = useState(false)
  useEffect(() => {
    if (!ativo) {
      setDemorou(false)
      return
    }
    const espera = setTimeout(() => setDemorou(true), atraso)
    return () => clearTimeout(espera)
  }, [ativo, atraso])
  return ativo && demorou
}

/**
 * Fio no topo de uma lista ou tabela que está atualizando. Ocupa sempre os mesmos 2 px,
 * para a lista não pular quando o fio entra e sai. Só aparece se a atualização demorar.
 */
export function BarraAtualizando({
  ativa,
  rotulo,
  className,
}: {
  ativa: boolean
  rotulo: string
  className?: string
}) {
  const mostrar = useDemorou(ativa)
  return (
    <div className={cn("h-0.5 w-full text-muted-foreground", className)}>
      <AnimatePresence>
        {mostrar && (
          <motion.div
            key="barra"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onUpdate={semRelogioDoNavegador}
            exit={{ opacity: 0 }}
            transition={{ duration: DURACAO.rapida }}
          >
            <Carregador variante="barra" rotulo={rotulo} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Radar do que se sincroniza ao vivo (mesas, garçom). Reserva o espaço de 20 px o tempo
 * todo e só desenha as ondas enquanto a conferência com o servidor demora.
 */
export function RadarAoVivo({
  ativo,
  rotulo,
  className,
}: {
  ativo: boolean
  rotulo: string
  className?: string
}) {
  const mostrar = useDemorou(ativo)
  return (
    <span
      className={cn(
        "inline-flex size-5 items-center justify-center text-muted-foreground",
        className,
      )}
    >
      <AnimatePresence>
        {mostrar && (
          <motion.span
            key="radar"
            className="inline-flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onUpdate={semRelogioDoNavegador}
            exit={{ opacity: 0 }}
            transition={{ duration: DURACAO.rapida }}
          >
            <Carregador variante="radar" rotulo={rotulo} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
