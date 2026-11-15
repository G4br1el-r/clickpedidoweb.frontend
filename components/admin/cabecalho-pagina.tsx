import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Título de cada página do painel: o nome da tela, uma linha de resumo e as ações à direita.
 * Igual em todas as telas, para o olho achar sempre no mesmo lugar o que está acontecendo.
 * `vivo`: o resumo muda sozinho (fila, cozinha) e o leitor de tela anuncia a mudança.
 */
export function CabecalhoPagina({
  titulo,
  resumo,
  vivo = false,
  acoes,
  className,
}: {
  titulo: string
  resumo?: ReactNode
  vivo?: boolean
  acoes?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn("flex flex-col gap-3 md:flex-row md:items-end md:justify-between", className)}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance">
          {titulo}
        </h1>
        {resumo && (
          <p
            className="text-sm text-muted-foreground tabular-nums"
            aria-live={vivo ? "polite" : undefined}
          >
            {resumo}
          </p>
        )}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  )
}
