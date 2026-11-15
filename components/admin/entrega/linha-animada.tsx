"use client"

import { motion, useReducedMotion } from "motion/react"
import type { ComponentProps } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { TableRow } from "@/components/ui/table"

const MotionRow = motion.create(TableRow)

/** Alvo de toque de 44 px no celular, sem aumentar o botão desenhado. */
export const ALVO_DE_TOQUE = "relative after:absolute after:-inset-2 sm:after:hidden"
const CURVA = [0.23, 1, 0.32, 1] as const

/**
 * Linha de cadastro que entra e sai da lista (dentro de um `AnimatePresence`): entra subindo
 * 4 px em 200 ms e sai em 150 ms. Com movimento reduzido, só a opacidade muda.
 */
export function LinhaAnimada(props: ComponentProps<typeof TableRow>) {
  const semMovimento = useReducedMotion()
  return (
    <MotionRow
      layout={semMovimento ? false : "position"}
      initial={{ opacity: 0, y: semMovimento ? 0 : 4 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: CURVA } }}
      exit={{ opacity: 0, transition: { duration: 0.15, ease: CURVA } }}
      transition={{ layout: { duration: 0.25, ease: CURVA } }}
      onUpdate={semRelogioDoNavegador}
      {...(props as ComponentProps<typeof MotionRow>)}
    />
  )
}

/** Esqueleto com o formato da lista: o cabeçalho e algumas linhas entre fios. */
export function EsqueletoLinhas({ rotulo, linhas = 5 }: { rotulo: string; linhas?: number }) {
  return (
    <div role="status" aria-label={rotulo} className="flex flex-col">
      <div className="h-10 border-b border-border/70" />
      {Array.from({ length: linhas }, (_, indice) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: linhas fixas do esqueleto.
          key={indice}
          className="flex h-14 items-center gap-4 border-b border-border/70 px-2"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-12" />
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/**
 * Passado como `onUpdate` de um `motion.*`, tira a animação do WAAPI. A saída das barras
 * flutuantes começava no futuro quando o relógio da página está parado e não terminava.
 */
export function semRelogioDoNavegador() {}
