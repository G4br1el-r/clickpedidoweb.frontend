"use client"

import { motion, useReducedMotion } from "motion/react"
import type { ComponentProps } from "react"
import { TableRow } from "@/components/ui/table"
import { CURVA_SAIDA, DURACAO, semRelogioDoNavegador, variantesDoItem } from "@/lib/admin/movimento"

// Mantido aqui para quem já importava deste arquivo; a definição é a de lib/admin/movimento.
export { semRelogioDoNavegador }

import { cn } from "@/lib/utils"

const MotionRow = motion.create(TableRow)

/** Alvo de toque de 44 px no celular, sem aumentar o botão desenhado. */
export const ALVO_DE_TOQUE = "relative after:absolute after:-inset-2 sm:after:hidden"
/** O mesmo para a caixa de marcar (16 px): o toque de 44 px cobre só o espaço vazio em volta. */
export const ALVO_DA_CAIXA = "relative after:absolute after:-inset-3.5 sm:after:hidden"
/** E para a chave liga/desliga, que é larga e baixa. */
export const ALVO_DA_CHAVE =
  "relative after:absolute after:-inset-x-1.5 after:-inset-y-3.5 sm:after:hidden"

/**
 * Linha de cadastro que entra e sai da lista (dentro de um `AnimatePresence`): as mesmas
 * variantes de item das outras listas do painel (sobe 6 px e aparece, sai só com o fade) e,
 * ao redor, as linhas vizinhas deslizam para ocupar o lugar. Com movimento reduzido, só a
 * opacidade muda e nada desliza.
 */
export function LinhaAnimada({ className, ...props }: ComponentProps<typeof TableRow>) {
  const reduzido = useReducedMotion() ?? false
  return (
    <MotionRow
      className={cn("entra-item", className)}
      layout={reduzido ? false : "position"}
      variants={variantesDoItem(reduzido)}
      custom={0}
      initial="entrar"
      animate="parado"
      exit="sair"
      transition={{ layout: { duration: DURACAO.entrada, ease: CURVA_SAIDA } }}
      onUpdate={semRelogioDoNavegador}
      {...(props as ComponentProps<typeof MotionRow>)}
    />
  )
}
