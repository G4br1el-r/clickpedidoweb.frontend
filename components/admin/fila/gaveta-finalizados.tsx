"use client"

import { format } from "date-fns"
import { PrinterIcon, RotateCcwIcon } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { emReais, plural } from "@/lib/formato"
import { SeloStatus } from "../pedidos/selos"

/**
 * O que saiu da fila hoje: concluídos e cancelados, do mais recente ao mais antigo. Dá para
 * reimprimir o cupom e reabrir o concluído por engano (volta para Prontos). A mesa reabre em
 * Mesas e o cancelado não volta: só reimprime.
 */
export function GavetaFinalizados({
  pedidos,
  aberta,
  aoMudar,
  aoReabrir,
  aoReimprimir,
}: {
  pedidos: Pedido[]
  aberta: boolean
  aoMudar: (aberta: boolean) => void
  aoReabrir: (pedido: Pedido) => void
  aoReimprimir: (pedido: Pedido) => void
}) {
  const telaGrande = useTelaGrande()
  return (
    <Sheet open={aberta} onOpenChange={aoMudar}>
      <SheetContent
        side={telaGrande ? "right" : "bottom"}
        className="gap-0 data-[side=bottom]:max-h-[92dvh] data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="gap-1.5 border-b border-border/70">
          <SheetTitle className="text-lg">Finalizados hoje</SheetTitle>
          <SheetDescription>
            {pedidos.length === 0
              ? "Nada concluído nem cancelado hoje ainda."
              : `${plural(pedidos.length, "pedido", "pedidos")} fora da fila.`}
          </SheetDescription>
        </SheetHeader>
        <ul className="flex-1 overflow-y-auto px-4">
          {pedidos.map((pedido) => {
            const reabre = pedido.status === "concluido" && pedido.tipo !== "mesa"
            return (
              <li
                key={pedido.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="flex items-baseline gap-2">
                    <span className="font-semibold tabular-nums">#{pedido.numero}</span>
                    <span className="truncate text-sm">{pedido.cliente.nome}</span>
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
                    <SeloStatus pedido={pedido} />
                    <span>{format(new Date(pedido.atualizadoEm), "HH:mm")}</span>
                    <span>{emReais(pedido.total)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={`Reimprimir cupom de #${pedido.numero}`}
                    onClick={() => aoReimprimir(pedido)}
                  >
                    <PrinterIcon />
                  </Button>
                  {reabre && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Reabrir #${pedido.numero}`}
                      onClick={() => aoReabrir(pedido)}
                    >
                      <RotateCcwIcon data-icon="inline-start" />
                      Reabrir
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <SheetFooter className="border-t border-border/70">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/pedidos">Ver todos em Pedidos</Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
