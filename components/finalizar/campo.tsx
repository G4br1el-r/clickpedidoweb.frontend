"use client"

import { AnimatePresence, motion } from "motion/react"
import type { ReactNode } from "react"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { cn } from "@/lib/utils"

/** Altura e cantos de todos os campos do checkout: confortáveis para o dedo. */
export const ESTILO_CAMPO = "h-12 rounded-xl bg-background px-3.5 text-base md:text-base"

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
    <Field data-invalid={Boolean(erro) || undefined} className={cn("gap-1.5", className)}>
      <FieldLabel htmlFor={id} className="text-sm font-semibold">
        {rotulo}
        {opcional && <span className="font-normal text-muted-foreground">(opcional)</span>}
      </FieldLabel>
      {children}
      <AnimatePresence initial={false}>
        {erro ? (
          <motion.div
            key="erro"
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
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
