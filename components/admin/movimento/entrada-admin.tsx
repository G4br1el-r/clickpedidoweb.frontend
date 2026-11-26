"use client"

import { type HTMLMotionProps, motion, useReducedMotion } from "motion/react"
import {
  estiloDeEntrada,
  semRelogioDoNavegador,
  variantesDoBloco,
  variantesDoItem,
} from "@/lib/admin/movimento"
import { cn } from "@/lib/utils"

type Elemento = "div" | "section" | "li" | "article" | "aside" | "tr" | "button"

type BlocoProps = Omit<HTMLMotionProps<"div">, "variants" | "initial" | "animate" | "exit"> & {
  como?: Elemento
}

type ItemProps = BlocoProps & {
  /** Posição na lista: define a espera, que para de crescer no oitavo item. */
  indice: number
}

/**
 * Bloco que chega sozinho (seção, painel, página): sobe um pouco e aparece. A entrada é do CSS
 * (`.entra-bloco`, na primeira pintura); o Motion cuida só da saída, dentro de um `AnimatePresence`.
 */
export function BlocoEntrando({ como = "div", className, ...props }: BlocoProps) {
  const reduzido = useReducedMotion() ?? false
  const Elemento = motion[como] as typeof motion.div
  return (
    <Elemento
      variants={variantesDoBloco(reduzido)}
      initial="entrar"
      animate="parado"
      onUpdate={semRelogioDoNavegador}
      exit="sair"
      className={cn("entra-bloco", className)}
      {...props}
    />
  )
}

/**
 * Linha ou cartão de lista. Entra com a espera do próprio lugar (CSS, `.entra-item`) e, dentro de
 * um `AnimatePresence`, a saída também anima: o item some em vez de estalar para fora.
 */
export function ItemEntrando({ como = "div", indice, className, style, ...props }: ItemProps) {
  const reduzido = useReducedMotion() ?? false
  const Elemento = motion[como] as typeof motion.div
  return (
    <Elemento
      variants={variantesDoItem(reduzido)}
      custom={indice}
      initial="entrar"
      animate="parado"
      onUpdate={semRelogioDoNavegador}
      exit="sair"
      className={cn("entra-item", className)}
      style={{ ...estiloDeEntrada(indice), ...style }}
      {...props}
    />
  )
}
