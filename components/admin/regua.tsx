import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Um fato da régua: rótulo, número e detalhe. Na régua, os fatos ficam lado a lado entre
 * fios, como a régua de entrega, retirada e mínimo da vitrine; sem cartões nem ícones.
 */
export function Indicador({
  rotulo,
  children,
  detalhe,
}: {
  rotulo: string
  children: ReactNode
  detalhe?: ReactNode
}) {
  return (
    <div data-indicador="" className="flex min-w-0 flex-col gap-1.5 py-4">
      <dt className="text-[13px] text-muted-foreground">{rotulo}</dt>
      <dd className="text-[22px] leading-none font-semibold tracking-[-0.025em] tabular-nums sm:text-2xl lg:text-[28px]">
        {children}
      </dd>
      {detalhe && <dd className="text-xs text-muted-foreground">{detalhe}</dd>}
    </div>
  )
}

/**
 * Régua de quatro fatos: duas colunas no celular e uma linha do notebook em diante,
 * separadas por fios de 1 px. A primeira coluna encosta na margem do título.
 */
export function Regua({ children }: { children: ReactNode }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 border-y border-border/70 lg:grid-cols-4",
        "*:border-border/70 *:px-4",
        // Celular: 2 por linha, fio entre as colunas e entre as linhas.
        "[&>*:first-child]:pl-0 max-lg:[&>*:nth-child(3)]:pl-0 max-lg:[&>*:nth-child(even)]:border-l max-lg:[&>*:nth-child(n+3)]:border-t",
        // Notebook em diante: uma linha, fio entre os fatos.
        "lg:[&>*:not(:first-child)]:border-l",
      )}
    >
      {children}
    </dl>
  )
}

/** Ponto verde parado: o bloco está ao vivo. O painel não tem movimento contínuo. */
export function AoVivo({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="size-2 rounded-full bg-(--tom-pronto)" />
      {children}
    </span>
  )
}
