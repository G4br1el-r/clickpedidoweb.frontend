"use client"

import { ChevronDownIcon, SlidersHorizontalIcon } from "lucide-react"
import { type ReactNode, useId, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Ajustes da fila (loja aberta, entrega, som, simulação). No celular ficam recolhidos
 * atrás de um botão que resume o estado, para os pedidos aparecerem na primeira tela.
 * No tablet em diante os controles ficam sempre à vista, numa linha. O painel abre por
 * CSS (linhas da grade), então o toque interrompe a animação no meio sem pular.
 */
export function AjustesDaFila({ resumo, children }: { resumo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const id = useId()
  return (
    <div className="flex flex-col border-y border-border/70">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((atual) => !atual)}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2 text-left text-sm md:hidden"
      >
        <SlidersHorizontalIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-medium">Ajustes da fila</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{resumo}</span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-saida",
            aberto && "rotate-180",
          )}
        />
      </button>
      <div
        id={id}
        data-testid="ajustes-da-fila"
        data-aberto={aberto}
        className={cn(
          "grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-saida md:grid-rows-[1fr] md:opacity-100",
          aberto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 max-md:invisible",
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3">{children}</div>
        </div>
      </div>
    </div>
  )
}
