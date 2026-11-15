"use client"

import { AnimatePresence, motion } from "motion/react"
import type { ReactNode } from "react"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { CURVA_SAIDA } from "./movimento"

/** Altura e cantos de todos os campos do checkout: confortáveis para o dedo. */
export const ESTILO_CAMPO =
  "h-12 rounded-xl bg-background px-3.5 text-base transition-[border-color,box-shadow] duration-150 md:text-base"

type CampoProps = {
  id: string
  rotulo: string
  opcional?: boolean
  erro?: string
  dica?: ReactNode
  className?: string
  children: ReactNode
}

/** Rótulo, campo, dica e erro; o erro abre e fecha com animação, sem empurrar de repente. */
export function Campo({ id, rotulo, opcional, erro, dica, className, children }: CampoProps) {
  return (
    <Field data-invalid={Boolean(erro) || undefined} className={cn("gap-2", className)}>
      <FieldLabel htmlFor={id} className="text-sm font-medium">
        {rotulo}
        {opcional && <span className="font-normal text-muted-foreground">(opcional)</span>}
      </FieldLabel>
      {children}
      <AnimatePresence initial={false}>
        {erro ? (
          <motion.div
            key="erro"
            // O erro desce do campo, curto: o aviso chega sem empurrar a tela de repente.
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.14 } }}
            transition={{ duration: 0.2, ease: CURVA_SAIDA }}
            className="overflow-hidden"
          >
            <FieldError id={`${id}-erro`}>{erro}</FieldError>
          </motion.div>
        ) : dica ? (
          <motion.div
            key="dica"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <FieldDescription>{dica}</FieldDescription>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Field>
  )
}
