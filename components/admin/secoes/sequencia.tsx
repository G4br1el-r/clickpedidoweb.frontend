"use client"

import { motion, useReducedMotion, type Variants } from "motion/react"
import type { ComponentProps, ElementType } from "react"
import { DURACAO, semRelogioDoNavegador } from "@/lib/admin/movimento"
import { cn } from "@/lib/utils"

type Elemento = "div" | "section" | "li" | "article" | "aside" | "ul"
type Propriedades = { como?: Elemento } & Omit<ComponentProps<"div">, "ref">

/**
 * Pai da sequência: a página, a aba ou o formulário inteiro. As etapas filhas entram uma depois
 * da outra por CSS (`.sequencia-admin > .entra-bloco`, em admin.css), na primeira pintura. O
 * Motion cuida só da saída, dentro de um `AnimatePresence`.
 */
export function Sequencia({ como = "div", className, ...props }: Propriedades) {
  const reduzido = useReducedMotion() ?? false
  const Elemento = motion[como] as typeof motion.div
  const variantes: Variants = {
    entrar: { opacity: 1 },
    parado: { opacity: 1 },
    sair: { opacity: 0, transition: { duration: reduzido ? DURACAO.rapida : DURACAO.saida } },
  }
  return (
    <Elemento
      variants={variantes}
      initial="entrar"
      animate="parado"
      onUpdate={semRelogioDoNavegador}
      exit="sair"
      className={cn("sequencia-admin", className)}
      {...(props as object)}
    />
  )
}

/**
 * Uma etapa da sequência (seção, bloco de campos): sobe 8 px e aparece na sua vez. Em CSS puro,
 * então já aparece na primeira pintura. Fora de uma `Sequencia`, entra sem espera.
 */
export function Etapa({ como = "section", className, ...props }: Propriedades) {
  const Elemento = como as ElementType
  return <Elemento className={cn("entra-bloco", className)} {...props} />
}
