"use client"

import type { ReactNode } from "react"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroupItem } from "@/components/ui/radio-group"
import { vibrar } from "@/lib/haptico"
import { cn } from "@/lib/utils"

type CartaoOpcaoProps = {
  valor: string
  selecionado: boolean
  icone: ReactNode
  titulo: string
  detalhe: ReactNode
  lateral?: ReactNode
  testId?: string
}

/**
 * Cartão de escolha do shadcn (FieldLabel + RadioGroupItem), grande e fácil de tocar:
 * ícone, título, detalhe e, à direita, preço ou prazo. Vai dentro de um RadioGroup.
 */
export function CartaoOpcao({
  valor,
  selecionado,
  icone,
  titulo,
  detalhe,
  lateral,
  testId,
}: CartaoOpcaoProps) {
  const id = `escolha-${valor}`

  return (
    <FieldLabel
      htmlFor={id}
      onClick={(evento) => {
        if (evento.detail > 0) vibrar()
      }}
      className="w-full rounded-2xl transition-[border-color,background-color,transform] duration-200 ease-saida active:scale-[0.99]"
    >
      <Field orientation="horizontal" className="min-h-[72px] items-center gap-3 p-3! pr-4!">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 [&_svg]:size-5",
            selecionado ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
          )}
        >
          {icone}
        </span>
        <FieldContent className="min-w-0">
          <FieldTitle className="text-base">{titulo}</FieldTitle>
          <FieldDescription>{detalhe}</FieldDescription>
        </FieldContent>
        {lateral && <span className="shrink-0 text-sm font-semibold tabular-nums">{lateral}</span>}
        <RadioGroupItem
          value={valor}
          id={id}
          data-testid={testId}
          aria-label={titulo}
          className="size-5"
        />
      </Field>
    </FieldLabel>
  )
}
