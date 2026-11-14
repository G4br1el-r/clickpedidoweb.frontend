"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { usePedidos } from "@/lib/admin/dados/consultas"
import { FiltroPeriodo, usePeriodo } from "../visao-geral/filtro-periodo"
import { DetalhesPedido } from "./detalhes-pedido"
import { ListaPedidos } from "./lista-pedidos"

function EsqueletoLista() {
  return (
    <div role="status" aria-label="Carregando pedidos" className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-[28rem] w-full rounded-xl" />
    </div>
  )
}

/** Pedidos do período, com busca, filtros e os detalhes abrindo por cima da lista. */
export function PaginaPedidos() {
  const { periodo } = usePeriodo()
  const { data: pedidos } = usePedidos(periodo ? { de: periodo.de, ate: periodo.ate } : undefined, {
    ativo: Boolean(periodo),
  })

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          Toque num pedido para ver os detalhes, avançar ou chamar o motoboy.
        </p>
      </div>
      <FiltroPeriodo />
      {pedidos ? <ListaPedidos pedidos={pedidos} /> : <EsqueletoLista />}
      <DetalhesPedido />
    </div>
  )
}
