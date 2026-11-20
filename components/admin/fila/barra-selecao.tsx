"use client"

import { ArrowRightIcon, BikeIcon, PrinterIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { plural } from "@/lib/formato"
import { Traco } from "../traco"

/**
 * Barra dos pedidos selecionados, presa ao pé da folha: avançar e imprimir todos de uma vez,
 * ou limpar a seleção. Mesma barra flutuante das configurações.
 */
export function BarraSelecao({
  quantos,
  ocupado,
  aoAvancar,
  aoImprimir,
  aoLimpar,
  aoDespachar,
}: {
  quantos: number
  ocupado: boolean
  aoAvancar: () => void
  aoImprimir: () => void
  aoLimpar: () => void
  /** Há entrega pronta na seleção: despacha todas numa rota. */
  aoDespachar?: () => void
}) {
  return (
    <section
      aria-label="Pedidos selecionados"
      className="sticky bottom-0 z-20 -mx-4 mt-auto px-4 pt-8 pb-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-background/95 p-2 pl-3.5 shadow-[0_12px_32px_-18px_rgb(0_0_0/0.35)] ring-1 ring-border/80 backdrop-blur-sm">
        <p className="flex items-center gap-2 text-sm font-medium tabular-nums">
          <Traco tom="novo" />
          {plural(quantos, "selecionado", "selecionados")}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={aoLimpar}>
            <XIcon data-icon="inline-start" />
            Limpar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={aoImprimir}>
            <PrinterIcon data-icon="inline-start" />
            Imprimir
          </Button>
          {aoDespachar && (
            <Button type="button" variant="outline" size="sm" onClick={aoDespachar}>
              <BikeIcon data-icon="inline-start" />
              Despachar
            </Button>
          )}
          <Button type="button" size="sm" disabled={ocupado} onClick={aoAvancar}>
            Avançar
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </section>
  )
}
