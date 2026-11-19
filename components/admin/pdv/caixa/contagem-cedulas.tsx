"use client"

import { useId } from "react"
import { Input } from "@/components/ui/input"
import { CEDULAS, totalDaContagem } from "@/lib/admin/regras/caixa"
import { emReais, emReaisCurto } from "@/lib/formato"

/**
 * Contagem da gaveta por cédula e moeda: uma linha por valor, com a quantidade e o
 * subtotal. `quantidades[i]` é quantas há de `CEDULAS[i]`.
 */
export function ContagemCedulas({
  quantidades,
  aoMudar,
}: {
  quantidades: readonly number[]
  aoMudar: (quantidades: number[]) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col tabular-nums">
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)] gap-3 pb-1.5 text-[13px] text-muted-foreground">
        <span>Valor</span>
        <span className="text-center">Qtd</span>
        <span className="text-right">Subtotal</span>
      </div>
      {CEDULAS.map((valor, indice) => {
        const quantidade = quantidades[indice] ?? 0
        return (
          <div
            key={valor}
            className="grid min-h-11 grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)] items-center gap-3 border-t border-border/60"
          >
            <label htmlFor={`${id}-${indice}`} className="text-sm font-medium">
              {emReaisCurto(valor)}
            </label>
            <Input
              id={`${id}-${indice}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              className="h-9 text-center"
              value={quantidade}
              onFocus={(evento) => evento.currentTarget.select()}
              onChange={(evento) => {
                const nova = Math.max(
                  0,
                  Math.min(9999, Math.trunc(Number(evento.target.value) || 0)),
                )
                aoMudar(CEDULAS.map((_, i) => (i === indice ? nova : (quantidades[i] ?? 0))))
              }}
            />
            <span
              className={
                quantidade ? "text-right text-sm" : "text-right text-sm text-muted-foreground"
              }
            >
              {emReais(totalDaContagem(CEDULAS.map((_, i) => (i === indice ? quantidade : 0))))}
            </span>
          </div>
        )
      })}
    </div>
  )
}
