"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const ATALHOS: [string, string][] = [
  ["↑ ↓ ← →", "Andar pelos pedidos"],
  ["Enter", "Avançar o pedido em foco"],
  ["A", "Aceitar o pedido em foco"],
  ["R", "Recusar o pedido em foco"],
  ["P", "Imprimir o cupom do pedido em foco"],
  ["/", "Buscar pedido"],
  ["Shift + clique", "Marcar para as ações em lote"],
  ["?", "Abrir esta ajuda"],
]

/** A folha de atalhos da fila, no "?": os atalhos valem no computador. */
export function AjudaAtalhos({
  aberta,
  aoMudar,
}: {
  aberta: boolean
  aoMudar: (aberta: boolean) => void
}) {
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos da fila</DialogTitle>
          <DialogDescription>No computador, fora dos campos de texto.</DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col">
          {ATALHOS.map(([teclas, oque]) => (
            <div
              key={teclas}
              className="flex items-center justify-between gap-4 border-b border-border/70 py-2 last:border-b-0"
            >
              <dt className="text-sm">{oque}</dt>
              <dd>
                <kbd className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-sans text-xs font-medium tabular-nums">
                  {teclas}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
