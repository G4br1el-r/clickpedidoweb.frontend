"use client"

import NumberFlow from "@number-flow/react"
import { emReais, formatoMoeda } from "@/lib/formato"

export const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })

/** Número animado para quem vê; o valor formatado para leitores de tela e buscas. */
export function Numero({ valor, moeda = false }: { valor: number; moeda?: boolean }) {
  return (
    <>
      <NumberFlow
        value={valor}
        locales="pt-BR"
        format={moeda ? formatoMoeda : { maximumFractionDigits: 1 }}
        aria-hidden="true"
        className="tabular-nums"
      />
      <span className="sr-only">{moeda ? emReais(valor) : inteiro.format(valor)}</span>
    </>
  )
}
