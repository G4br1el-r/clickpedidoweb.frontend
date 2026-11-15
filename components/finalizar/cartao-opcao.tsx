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
 * Opção de escolha (FieldLabel + RadioGroupItem do shadcn), grande e fácil de tocar:
 * ícone, título, detalhe e, à direita, preço ou prazo. Plana, só com o fio; escolhida,
 * o fio e o rádio ganham a cor da loja. Vai dentro de um RadioGroup.
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
      className={cn(
        "w-full cursor-pointer rounded-xl border-border! bg-transparent! hover:bg-muted/40! transition-[border-color,box-shadow,transform] duration-150 ease-saida active:scale-[0.985]",
        // Escolhida: o fio vira a cor da loja e engrossa por dentro, sem mudar o tamanho.
        "has-data-checked:border-primary! has-data-checked:shadow-[inset_0_0_0_1px_var(--primary)]",
      )}
    >
      <Field orientation="horizontal" className="min-h-16 items-center gap-3.5 px-4! py-3!">
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 transition-colors duration-150 [&_svg]:size-5",
            selecionado ? "text-marca-texto" : "text-muted-foreground",
          )}
        >
          {icone}
        </span>
        <FieldContent className="min-w-0 gap-0.5">
          <FieldTitle className="text-[15px] font-medium tracking-[-0.01em]">{titulo}</FieldTitle>
          <FieldDescription className="text-[13px] leading-snug">{detalhe}</FieldDescription>
        </FieldContent>
        {lateral && (
          <span className="shrink-0 text-[13px] font-medium tabular-nums">{lateral}</span>
        )}
        <RadioGroupItem
          value={valor}
          id={id}
          data-testid={testId}
          aria-label={titulo}
          className="size-5 [&_[data-slot=radio-group-indicator]]:size-5"
        />
      </Field>
    </FieldLabel>
  )
}
