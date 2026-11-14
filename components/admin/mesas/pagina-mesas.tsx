"use client"

import { ArmchairIcon, ClockIcon, UserIcon } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgora } from "@/hooks/use-agora"
import { useFila } from "@/lib/admin/dados/consultas"
import { useMesas } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { emReais, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { ComandaMesa } from "./comanda-mesa"
import { NovaMesa } from "./nova-mesa"

/** "25 min" ou "1 h 05". */
function tempoDesde(inicio: string, agora: Date) {
  const minutos = Math.max(0, Math.floor((agora.getTime() - Date.parse(inicio)) / 60_000))
  if (minutos < 60) return `${minutos} min`
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")}`
}

const nomePadrao = (mesa: Mesa) => mesa.nome === `Mesa ${String(mesa.numero).padStart(2, "0")}`

function CartaoMesa({
  mesa,
  comanda,
  agora,
  aoAbrir,
}: {
  mesa: Mesa
  comanda: Pedido | undefined
  agora: Date | null
  aoAbrir: () => void
}) {
  const ocupada = mesa.status === "ocupada"
  const itens = comanda?.itens.reduce((soma, item) => soma + item.quantidade, 0) ?? 0
  return (
    <button
      type="button"
      onClick={aoAbrir}
      aria-labelledby={`mesa-${mesa.id}`}
      aria-describedby={`mesa-${mesa.id}-detalhes`}
      className={cn(
        "flex h-full w-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        ocupada
          ? "bg-card shadow-xs hover:bg-accent/60"
          : "border-dashed bg-muted/30 hover:bg-muted",
      )}
    >
      <span className="flex items-center gap-2">
        <span id={`mesa-${mesa.id}`} className="text-base font-semibold">
          Mesa {mesa.numero}
        </span>
        <Badge variant={ocupada ? "default" : "outline"} className="ml-auto">
          {ocupada ? "Ocupada" : "Livre"}
        </Badge>
      </span>
      <span id={`mesa-${mesa.id}-detalhes`} className="sr-only">
        {[ocupada ? "Ocupada" : "Livre", mesa.clienteNome, comanda ? emReais(comanda.total) : null]
          .filter(Boolean)
          .join(", ")}
      </span>
      {!nomePadrao(mesa) && <span className="text-xs text-muted-foreground">{mesa.nome}</span>}
      {ocupada ? (
        <>
          <span className="flex items-center gap-1 text-sm font-medium">
            <UserIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{mesa.clienteNome}</span>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {mesa.ocupadaEm && agora && (
              <span className="flex items-center gap-1 tabular-nums">
                <ClockIcon className="size-3" aria-hidden="true" />
                {tempoDesde(mesa.ocupadaEm, agora)}
              </span>
            )}
            {comanda?.mesa?.garcom && <span>Garçom {comanda.mesa.garcom}</span>}
          </span>
          {comanda && (
            <span className="mt-auto flex items-baseline justify-between pt-1 text-sm">
              <span className="text-xs text-muted-foreground">
                {plural(itens, "item", "itens")}
              </span>
              <span className="font-semibold tabular-nums">{emReais(comanda.total)}</span>
            </span>
          )}
        </>
      ) : (
        <span className="mt-auto text-xs text-muted-foreground">Toque para ver</span>
      )}
    </button>
  )
}

/** Mesas do salão: grade de livres e ocupadas e a comanda de cada uma. */
export function PaginaMesas() {
  const { data: mesas } = useMesas()
  const { data: fila } = useFila()
  const agora = useAgora(30_000)
  const [abertaId, setAbertaId] = useState<string | null>(null)

  const comandas = new Map(
    (fila ?? []).filter((pedido) => pedido.tipo === "mesa").map((p) => [p.id, p]),
  )
  const ocupadas = mesas?.filter((mesa) => mesa.status === "ocupada").length ?? 0
  const aberta = mesas?.find((mesa) => mesa.id === abertaId) ?? null

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mesas</h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {mesas
              ? `${plural(ocupadas, "ocupada", "ocupadas")} · ${plural(mesas.length - ocupadas, "livre", "livres")}`
              : "Carregando as mesas…"}
          </p>
        </div>
        <div className="ml-auto">
          <NovaMesa />
        </div>
      </div>

      {!mesas ? (
        <div
          role="status"
          aria-label="Carregando as mesas"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        >
          {Array.from({ length: 10 }, (_, indice) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: esqueleto fixo
            <Skeleton key={indice} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : mesas.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ArmchairIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhuma mesa cadastrada</EmptyTitle>
            <EmptyDescription>
              Crie as mesas do salão para o garçom lançar os pedidos.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul aria-label="Mesas" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {mesas.map((mesa) => (
            <li key={mesa.id}>
              <CartaoMesa
                mesa={mesa}
                comanda={mesa.pedidoAtivoId ? comandas.get(mesa.pedidoAtivoId) : undefined}
                agora={agora}
                aoAbrir={() => setAbertaId(mesa.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <ComandaMesa mesa={aberta} aoFechar={() => setAbertaId(null)} />
    </div>
  )
}
