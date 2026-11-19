"use client"

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { type ReactNode, useState } from "react"
import type { Pedido, StatusPedido } from "@/lib/admin/dados/tipos"
import { cn } from "@/lib/utils"

/** O que o leitor de tela ouve ao arrastar (o padrão do dnd-kit é em inglês). */
const ANUNCIOS = {
  onDragStart: () => "Pedido pego. Solte na coluna seguinte ou na anterior.",
  onDragOver: () => "",
  onDragEnd: () => "Pedido solto.",
  onDragCancel: () => "Arraste cancelado.",
}

/**
 * O quadro em que os cartões se arrastam entre colunas. Mouse a partir de 6 px (o clique
 * continua sendo clique); no toque, segurar 200 ms (rolar a coluna continua rolando).
 * Enquanto arrasta, um fantasma do cartão acompanha o ponteiro e o original fica apagado.
 */
export function QuadroArrastavel({
  pedidos,
  aoSoltar,
  children,
}: {
  pedidos: Pedido[]
  aoSoltar: (pedido: Pedido, para: StatusPedido) => void
  children: ReactNode
}) {
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )
  const [pego, setPego] = useState<Pedido | null>(null)

  return (
    <DndContext
      sensors={sensores}
      // Solta na coluna onde está o ponteiro (o fantasma é menor que o cartão).
      collisionDetection={pointerWithin}
      // O destino é a coluna ao lado: rolar a página sozinho só tira o ponteiro do lugar.
      autoScroll={false}
      accessibility={{
        announcements: ANUNCIOS,
        screenReaderInstructions: { draggable: "Use as setas e o Enter para mover o pedido." },
      }}
      onDragStart={({ active }) =>
        setPego(pedidos.find((pedido) => pedido.id === Number(active.id)) ?? null)
      }
      onDragCancel={() => setPego(null)}
      onDragEnd={({ active, over }) => {
        setPego(null)
        const pedido = pedidos.find((item) => item.id === Number(active.id))
        if (pedido && over) aoSoltar(pedido, over.id as StatusPedido)
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {pego && (
          <div className="flex items-baseline gap-2 rounded-xl bg-card px-3 py-2 text-sm shadow-[0_12px_32px_-18px_rgb(0_0_0/0.35)] ring-1 ring-border/80">
            <span className="font-semibold tabular-nums">#{pego.numero}</span>
            <span className="truncate text-muted-foreground">{pego.cliente.nome}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/** O cartão que se arrasta. Fora do quadro arrastável (abas do celular), fica parado. */
export function Arrastavel({
  id,
  ativo,
  children,
}: {
  id: number
  ativo: boolean
  children: ReactNode
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id, disabled: !ativo })
  return (
    <div ref={setNodeRef} {...(ativo ? listeners : {})} className={cn(isDragging && "opacity-40")}>
      {children}
    </div>
  )
}

/** A coluna onde se solta: o id é a etapa. Com um cartão por cima, ganha um tom de fundo. */
export function useColunaSoltavel(status: StatusPedido, ativo: boolean) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !ativo })
  return { ref: setNodeRef, sobre: isOver }
}
