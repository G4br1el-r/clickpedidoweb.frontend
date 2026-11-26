"use client"

import { motion, useReducedMotion } from "motion/react"
import type { ComponentProps } from "react"
import { TableRow } from "@/components/ui/table"
import { estiloDeEntrada, semRelogioDoNavegador, variantesDoItem } from "@/lib/admin/movimento"
import { cn } from "@/lib/utils"

const LinhaMovel = motion.create(TableRow)

type LinhaAnimadaProps = Omit<
  ComponentProps<typeof LinhaMovel>,
  "variants" | "initial" | "animate" | "exit" | "custom"
> & {
  /** Posição na lista: define a espera, que para de crescer no oitavo item. */
  indice: number
}

/**
 * Linha de tabela que entra em sequência e sai com fade. É o `ItemEntrando` para `<tr>`, que
 * as primitivas de movimento não cobrem. Dentro de um `AnimatePresence`, a saída também anima.
 */
export function LinhaAnimada({ indice, className, style, ...props }: LinhaAnimadaProps) {
  const reduzido = useReducedMotion() ?? false
  return (
    <LinhaMovel
      className={cn("entra-item", className)}
      style={{ ...estiloDeEntrada(indice), ...style }}
      variants={variantesDoItem(reduzido)}
      custom={indice}
      initial="entrar"
      animate="parado"
      onUpdate={semRelogioDoNavegador}
      exit="sair"
      {...props}
    />
  )
}
