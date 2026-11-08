"use client"

import { motion } from "motion/react"
import type { MouseEvent } from "react"
import { Foto } from "@/components/foto"
import { registroSegmentos } from "@/components/segmentos/registro"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroupItem } from "@/components/ui/radio-group"
import { clienteAtual } from "@/lib/cliente"
import { emReais } from "@/lib/formato"
import type { GrupoOpcao, ItemOpcao } from "@/lib/tipos"
import { cn } from "@/lib/utils"

const CURVA = [0.23, 1, 0.32, 1] as const

/**
 * Imagem da opção. O segmento desenha a sua (a pizzaria desenha sabores e bordas em SVG).
 * Sem desenho do segmento, usa a foto; sem foto, a inicial do nome. Sempre aparece algo.
 */
function Miniatura({
  grupo,
  item,
  selecionada,
}: {
  grupo: GrupoOpcao
  item: ItemOpcao
  selecionada: boolean
}) {
  const { MiniaturaOpcao } = registroSegmentos[clienteAtual.segmento]

  return (
    <span className="relative flex size-14 shrink-0 items-center justify-center" aria-hidden="true">
      <span className="size-12 overflow-hidden rounded-full">
        {MiniaturaOpcao ? (
          <MiniaturaOpcao grupo={grupo} item={item} />
        ) : item.imagem ? (
          <Foto src={item.imagem} alt="" sizes="48px" className="size-12" />
        ) : (
          <span className="flex size-12 items-center justify-center bg-accent font-heading text-lg font-bold text-accent-foreground">
            {item.nome.charAt(0)}
          </span>
        )}
      </span>
      <svg viewBox="0 0 56 56" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <motion.circle
          cx="28"
          cy="28"
          r="26.5"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: selecionada ? 1 : 0, opacity: selecionada ? 1 : 0 }}
          transition={{ duration: 0.35, ease: CURVA }}
        />
      </svg>
    </span>
  )
}

type OpcaoLinhaProps = {
  grupo: GrupoOpcao
  item: ItemOpcao
  selecionada: boolean
  /** Grupo obrigatório que ficou sem escolha ao tentar adicionar. */
  invalida: boolean
  aoClicar: (evento: MouseEvent<HTMLLabelElement>) => void
}

/** Cartão de escolha do shadcn (FieldLabel + RadioGroupItem), com a miniatura desenhada. */
export function OpcaoLinha({ grupo, item, selecionada, invalida, aoClicar }: OpcaoLinhaProps) {
  const id = `opcao-${grupo.id}-${item.id}`

  return (
    <FieldLabel
      htmlFor={id}
      onClick={aoClicar}
      className={cn(
        "w-full rounded-2xl transition-[border-color,background-color,transform] duration-200 ease-saida active:scale-[0.99]",
        invalida && "border-destructive/70",
      )}
    >
      <Field orientation="horizontal" className="items-center gap-3 py-2! pr-3.5! pl-2!">
        <Miniatura grupo={grupo} item={item} selecionada={selecionada} />
        <FieldContent className="min-w-0">
          <FieldTitle className={cn("text-base", selecionada && "font-bold")}>
            {item.nome}
          </FieldTitle>
          {item.descricao && <FieldDescription>{item.descricao}</FieldDescription>}
        </FieldContent>
        <span className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums">
          {item.extra > 0 ? `+ ${emReais(item.extra)}` : "Incluso"}
        </span>
        <RadioGroupItem
          value={item.id}
          id={id}
          data-testid={`opcao-${item.id}`}
          aria-label={item.nome}
          aria-invalid={invalida || undefined}
          className="size-5"
        />
      </Field>
    </FieldLabel>
  )
}
