"use client"

import { CalendarClockIcon } from "lucide-react"
import type { Pedido } from "@/lib/admin/dados/tipos"
import type { GrupoDeRetirada } from "@/lib/admin/regras/fila"
import { diaDaRetirada } from "@/lib/admin/regras/numero"
import { plural } from "@/lib/formato"

/**
 * Açougue: as retiradas marcadas para outro dia esperam aqui, por data, e entram em Novos
 * no dia. Cada uma abre os detalhes (dá para começar antes, se a loja quiser).
 */
export function ProximasRetiradas({
  grupos,
  agora,
  aoAbrir,
}: {
  grupos: GrupoDeRetirada[]
  agora: Date
  aoAbrir: (pedido: Pedido) => void
}) {
  if (grupos.length === 0) return null
  const total = grupos.reduce((soma, grupo) => soma + grupo.pedidos.length, 0)

  return (
    <section
      aria-label="Próximas retiradas"
      className="flex flex-col gap-3 border-t border-border/70 py-3"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <CalendarClockIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        Próximas retiradas
        <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
          {plural(total, "pedido", "pedidos")}
        </span>
      </h2>
      <div className="flex flex-wrap gap-x-10 gap-y-3">
        {grupos.map((grupo) => (
          <div key={grupo.dia} className="flex min-w-56 flex-col">
            <h3 className="pb-1 text-[13px] text-muted-foreground">
              {diaDaRetirada(grupo.dia, agora)}
            </h3>
            <ul className="flex flex-col border-t border-border/70">
              {grupo.pedidos.map((pedido) => {
                const itens = plural(
                  pedido.itens.reduce((soma, item) => soma + item.quantidade, 0),
                  "item",
                  "itens",
                )
                return (
                  <li key={pedido.id} className="border-b border-border/70">
                    <button
                      type="button"
                      aria-label={`#${pedido.numero} ${pedido.cliente.nome}, ${itens}`}
                      onClick={() => aoAbrir(pedido)}
                      className="flex min-h-10 w-full items-baseline gap-2 rounded-md px-1 text-left text-sm transition-colors duration-150 hover:bg-foreground/[0.025] focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className="font-semibold tabular-nums">#{pedido.numero}</span>
                      <span className="min-w-0 flex-1 truncate">{pedido.cliente.nome}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{itens}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
