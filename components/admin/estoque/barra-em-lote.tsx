"use client"

import { XIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { BlocoEntrando } from "../movimento/entrada-admin"

/**
 * Casca da barra de ações em lote do Estoque e da Farmácia: aparece quando há itens marcados,
 * diz quantos são, mostra as ações de quem a usa (`children`) e limpa a seleção. Fica colada
 * na parte de baixo da tela, para o dedo achar no celular. Mesmo desenho da barra de pedidos.
 */
export function BarraEmLote({
  aberta,
  texto,
  nota,
  aoLimpar,
  children,
}: {
  aberta: boolean
  /** "3 produtos selecionados". */
  texto: string
  /** O que fica de fora, em uma linha curta. */
  nota?: string
  aoLimpar: () => void
  children: ReactNode
}) {
  return (
    <AnimatePresence>
      {aberta && (
        <BlocoEntrando
          key="barra-em-lote"
          role="region"
          aria-label="Ações em lote"
          className="sticky bottom-4 z-30 mx-auto flex w-full max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-medium tabular-nums">{texto}</p>
            {nota && <span className="text-xs text-muted-foreground">{nota}</span>}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="max-md:h-11"
              onClick={aoLimpar}
            >
              <XIcon data-icon="inline-start" />
              Limpar seleção
            </Button>
            {children}
          </div>
        </BlocoEntrando>
      )}
    </AnimatePresence>
  )
}
