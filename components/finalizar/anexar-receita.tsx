"use client"

import { CameraIcon, FileTextIcon, RefreshCwIcon } from "lucide-react"
import { useEffect, useId } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ReceitaAnexada = { nome: string; url: string }

type AnexarReceitaProps = {
  /** O que a sacola pede (lib/farmacia.ts → receitaDaSacola). */
  exigida: { itens: string[]; retida: boolean }
  receita: ReceitaAnexada | null
  aoMudar: (receita: ReceitaAnexada | null) => void
  /** A pessoa tentou enviar sem a foto. */
  invalida?: boolean
}

/**
 * Farmácia: a foto da receita, pedida na revisão quando a sacola tem remédio de tarja vermelha.
 * A farmacêutica confere antes de separar (painel → Receitas).
 */
export function AnexarReceita({ exigida, receita, aoMudar, invalida = false }: AnexarReceitaProps) {
  const id = useId()

  // A prévia é um endereço temporário do navegador: solta ao trocar ou sair.
  useEffect(() => {
    if (!receita) return
    return () => URL.revokeObjectURL(receita.url)
  }, [receita])

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className={cn(
        "flex flex-col gap-3 rounded-3xl bg-card p-4 ring-1 ring-border md:p-5",
        invalida && !receita && "ring-2 ring-destructive",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <FileTextIcon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-titulo`} className="text-lg font-bold">
            Receita médica
          </h2>
          <p className="text-sm text-muted-foreground">
            Pedem receita: <span className="text-foreground">{exigida.itens.join(", ")}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            A farmacêutica confere a foto antes de separar o pedido.
          </p>
        </div>
      </div>

      {exigida.retida && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/30">
          Tenha a via original em mãos: o entregador recolhe na entrega.
        </p>
      )}

      {receita ? (
        <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-2.5">
          {/* biome-ignore lint/performance/noImgElement: prévia local (blob:) da foto escolhida, fora do otimizador do Next. */}
          <img
            src={receita.url}
            alt="Receita anexada"
            className="size-16 shrink-0 rounded-xl object-cover"
          />
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{receita.nome}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Trocar a foto da receita"
            onClick={() => aoMudar(null)}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Trocar
          </Button>
        </div>
      ) : (
        <label
          htmlFor={`${id}-arquivo`}
          className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 text-sm font-semibold text-marca-texto outline-none transition-colors hover:border-primary hover:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
        >
          <CameraIcon className="size-5" aria-hidden="true" />
          Tirar foto ou escolher arquivo
          <input
            id={`${id}-arquivo`}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Foto da receita"
            className="sr-only"
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0]
              if (arquivo) aoMudar({ nome: arquivo.name, url: URL.createObjectURL(arquivo) })
            }}
          />
        </label>
      )}

      {invalida && !receita && (
        <p role="alert" className="text-sm font-medium text-destructive">
          Anexe a foto da receita para enviar.
        </p>
      )}
    </section>
  )
}
