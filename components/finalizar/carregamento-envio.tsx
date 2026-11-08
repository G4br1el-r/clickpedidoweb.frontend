"use client"

import { ShoppingBagIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"
import { registroSegmentos } from "@/components/segmentos/registro"
import { Progress } from "@/components/ui/progress"
import { clienteAtual } from "@/lib/cliente"
import type { ItemSacola } from "@/lib/sacola"

/** Tempo total do envio; dividido em quatro etapas iguais. */
export const DURACAO_ENVIO_MS = 5000
const ETAPAS = 4

const MENSAGENS_PADRAO = [
  "Recebendo seu pedido",
  "Separando os itens",
  "Preparando tudo",
  "Quase lá!",
]

/** Arte para segmentos sem uma própria: a sacola pulando a cada etapa. */
function ArtePadrao({ etapa }: { etapa: number }) {
  return (
    <motion.div
      key={etapa}
      className="grid size-40 place-items-center rounded-full bg-accent text-marca-texto"
      initial={{ scale: 0.9, y: 6 }}
      animate={{ scale: [0.9, 1.08, 1], y: [6, -8, 0] }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <ShoppingBagIcon className="size-16" />
    </motion.div>
  )
}

/**
 * Carregamento do envio do pedido, temático por segmento (na pizzaria, a pizza sendo
 * montada e indo ao forno). Dura 5 segundos, com mensagem e progresso por etapa.
 */
export function CarregamentoEnvio({ itens }: { itens: ItemSacola[] }) {
  const { ArteEnvio, mensagensEnvio } = registroSegmentos[clienteAtual.segmento]
  const mensagens = mensagensEnvio ?? MENSAGENS_PADRAO
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
      className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col items-center gap-7 px-6 text-center">
        {ArteEnvio ? <ArteEnvio etapa={etapa} itens={itens} /> : <ArtePadrao etapa={etapa} />}
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative h-8 w-72 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={etapa}
                aria-live="polite"
                className="absolute inset-x-0 font-heading text-2xl font-extrabold tracking-tight"
                initial={{ y: 22, opacity: 0, filter: "blur(4px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ y: -22, opacity: 0, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              >
                {mensagens[etapa]}
              </motion.p>
            </AnimatePresence>
          </div>
          <p className="text-sm text-muted-foreground">{clienteAtual.nome}</p>
        </div>
        <Progress
          value={progresso}
          aria-label="Andamento do envio"
          className="w-56 md:w-64 [&_[data-slot=progress-indicator]]:duration-[4800ms] [&_[data-slot=progress-indicator]]:ease-linear"
        />
      </div>
    </motion.div>
  )
}
