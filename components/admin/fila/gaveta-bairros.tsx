"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { entregasPorBairro } from "@/lib/admin/regras/despacho"
import { plural } from "@/lib/formato"
import { SeloStatus } from "../pedidos/selos"

/**
 * As entregas em andamento por bairro: onde a demanda está agora e o que dá para juntar numa
 * rota. O mapa de verdade fica para o back-end, com geocodificação.
 */
export function GavetaBairros({
  fila,
  aberta,
  aoMudar,
  aoAbrirPedido,
}: {
  fila: Pedido[]
  aberta: boolean
  aoMudar: (aberta: boolean) => void
  aoAbrirPedido: (pedido: Pedido) => void
}) {
  const telaGrande = useTelaGrande()
  const grupos = entregasPorBairro(fila)
  return (
    <Sheet open={aberta} onOpenChange={aoMudar}>
      <SheetContent
        side={telaGrande ? "right" : "bottom"}
        className="gap-0 data-[side=bottom]:max-h-[92dvh] data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="gap-1.5 border-b border-border/70">
          <SheetTitle className="text-lg">Entregas por bairro</SheetTitle>
          <SheetDescription>
            {grupos.length === 0
              ? "Nenhuma entrega em andamento."
              : `${plural(grupos.length, "bairro", "bairros")} com entrega em andamento.`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          {grupos.map(({ bairro, pedidos }) => (
            <section
              key={bairro}
              aria-label={`${bairro}, ${pedidos.length}`}
              className="border-b border-border/70 py-3 last:border-b-0"
            >
              <h3 className="flex items-baseline justify-between text-sm font-semibold">
                {bairro}
                <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
                  {pedidos.length}
                </span>
              </h3>
              <ul className="mt-1 flex flex-col">
                {pedidos.map((pedido) => (
                  <li key={pedido.id}>
                    <button
                      type="button"
                      onClick={() => aoAbrirPedido(pedido)}
                      className="flex w-full items-center gap-2 rounded-md py-1.5 text-left text-sm hover:bg-foreground/[0.025] focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className="font-semibold tabular-nums">#{pedido.numero}</span>
                      <span className="min-w-0 flex-1 truncate">{pedido.cliente.nome}</span>
                      <SeloStatus pedido={pedido} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
