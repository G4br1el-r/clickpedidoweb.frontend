"use client"

import { motion, useReducedMotion } from "motion/react"
import type { MouseEvent } from "react"
import { Foto } from "@/components/foto"
import { registroSegmentos } from "@/components/segmentos/registro"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroupItem } from "@/components/ui/radio-group"
import { emReais } from "@/lib/formato"
import { useLoja } from "@/lib/loja-atual"
import type { GrupoOpcao, ItemOpcao } from "@/lib/tipos"
import { cn } from "@/lib/utils"

const CURVA = [0.23, 1, 0.32, 1] as const

/**
 * Imagem da opção. O segmento desenha a sua (a pizzaria desenha sabores e bordas em SVG);
 * sem desenho, usa a foto. Sem nenhum dos dois, não há imagem: a linha fica só com o texto,
 * em vez de uma inicial que ocupa espaço e não diz nada.
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
  const lojaEscolhida = useLoja()
  const { MiniaturaOpcao } = registroSegmentos[lojaEscolhida.segmento]
  const reduzido = useReducedMotion()
  if (!MiniaturaOpcao && !item.imagem) return null

  return (
    <span
      data-miniatura=""
      className="relative flex size-14 shrink-0 items-center justify-center"
      aria-hidden="true"
    >
      <span className="size-12 overflow-hidden rounded-full">
        {MiniaturaOpcao ? (
          <MiniaturaOpcao grupo={grupo} item={item} />
        ) : (
          item.imagem && <Foto src={item.imagem} alt="" sizes="48px" className="size-12" />
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
          // O anel se fecha em volta da escolha; com movimento reduzido, só aparece.
          animate={{
            pathLength: selecionada || reduzido ? 1 : 0,
            opacity: selecionada ? 1 : 0,
          }}
          transition={{ duration: reduzido ? 0.15 : 0.28, ease: CURVA }}
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

/**
 * Linha de escolha, sem cartão: as opções se separam por um fio, como a lista da vitrine.
 * A escolha aparece no rádio e no anel na cor da loja; o toque escurece a linha um instante.
 */
const CARTAO =
  "w-full has-[>[data-slot=field]]:rounded-none has-[>[data-slot=field]]:border-0 has-[>[data-slot=field]]:border-b has-[>[data-slot=field]]:border-border/70 has-data-checked:bg-transparent dark:has-data-checked:bg-transparent has-[>[data-slot=field]]:has-[:focus-visible]:ring-inset transition-[background-color] duration-150 ease-saida active:bg-muted/70"

/** Cartão de escolha do shadcn (FieldLabel + RadioGroupItem), com a miniatura desenhada. */
export function OpcaoLinha({ grupo, item, selecionada, invalida, aoClicar }: OpcaoLinhaProps) {
  const id = `opcao-${grupo.id}-${item.id}`

  return (
    <FieldLabel
      htmlFor={id}
      onClick={aoClicar}
      className={cn(CARTAO, invalida && "border-destructive/70")}
    >
      <Field
        orientation="horizontal"
        className="min-h-14 items-center gap-3 py-2! pr-3.5! pl-2! has-[>[data-slot=field-content]]:items-center"
      >
        <Miniatura grupo={grupo} item={item} selecionada={selecionada} />
        <FieldContent className="min-w-0">
          <FieldTitle className="text-[15px] font-medium tracking-[-0.01em]">
            {item.nome}
          </FieldTitle>
          {item.descricao && (
            <FieldDescription className="text-[13px] leading-snug">
              {item.descricao}
            </FieldDescription>
          )}
        </FieldContent>
        <span
          className={cn(
            "shrink-0 text-sm tabular-nums transition-colors duration-150",
            selecionada ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
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

type OpcaoCaixaProps = {
  grupo: GrupoOpcao
  item: ItemOpcao
  marcada: boolean
  /** O grupo chegou ao máximo e esta não está marcada. */
  desligada: boolean
  /** Fica grátis se for marcada agora (ainda dentro do "grátis até"). */
  gratis: boolean
  aoAlternar: () => void
}

/** Opção de grupo com várias escolhas (adicionais, gelos do combo): caixa de marcar. */
export function OpcaoCaixa({
  grupo,
  item,
  marcada,
  desligada,
  gratis,
  aoAlternar,
}: OpcaoCaixaProps) {
  const id = `opcao-${grupo.id}-${item.id}`
  return (
    <FieldLabel
      htmlFor={id}
      className={cn(
        CARTAO,
        "transition-[border-color,background-color,opacity,transform]",
        desligada && "opacity-55 active:scale-100",
      )}
    >
      <Field
        orientation="horizontal"
        className="min-h-14 items-center gap-3 py-2! pr-3.5! pl-2! has-[>[data-slot=field-content]]:items-center"
      >
        <Miniatura grupo={grupo} item={item} selecionada={marcada} />
        <FieldContent className="min-w-0">
          <FieldTitle className="text-[15px] font-medium tracking-[-0.01em]">
            {item.nome}
          </FieldTitle>
          {item.descricao && (
            <FieldDescription className="text-[13px] leading-snug">
              {item.descricao}
            </FieldDescription>
          )}
        </FieldContent>
        <span
          className={cn(
            "shrink-0 text-sm tabular-nums transition-colors duration-150",
            marcada ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {item.extra > 0 && !gratis ? `+ ${emReais(item.extra)}` : "Grátis"}
        </span>
        <Checkbox
          id={id}
          checked={marcada}
          disabled={desligada}
          onCheckedChange={aoAlternar}
          data-testid={`opcao-${item.id}`}
          aria-label={item.nome}
          className="size-5"
        />
      </Field>
    </FieldLabel>
  )
}
