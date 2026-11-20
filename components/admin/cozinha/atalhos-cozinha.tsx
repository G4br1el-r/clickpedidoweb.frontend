"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const ATALHOS: [string, string][] = [
  ["← →", "Muda de coluna"],
  ["↑ ↓", "Anda na coluna"],
  ["Enter", "Avança o ticket"],
  ["P", "Liga ou desliga a prioridade"],
  ["1 a 9", "Risca o item da linha"],
  ["Z", "Desfaz a última ação"],
  ["?", "Abre esta lista"],
]

/** A lista dos atalhos do quadro, aberta com "?". */
export function AtalhosCozinha({
  aberta,
  aoMudar,
}: {
  aberta: boolean
  aoMudar: (aberta: boolean) => void
}) {
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Atalhos do teclado</DialogTitle>
          <DialogDescription>
            Valem no quadro, com o foco num ticket. As setas trazem o foco.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
          {ATALHOS.map(([tecla, acao]) => (
            <div key={tecla} className="contents">
              <dt>
                <kbd className="inline-flex min-w-7 justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-xs font-medium">
                  {tecla}
                </kbd>
              </dt>
              <dd className="text-muted-foreground">{acao}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
