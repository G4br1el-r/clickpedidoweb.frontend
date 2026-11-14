"use client"

import { AlertTriangleIcon, ClockIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import type { ItemPedido, Pedido } from "@/lib/admin/dados/tipos"
import { itensDaCozinha, minutosNaCozinha, urgenciaNaCozinha } from "@/lib/admin/regras/cozinha"
import type { Urgencia } from "@/lib/admin/regras/fila"
import { cn } from "@/lib/utils"

const ESTILO_URGENCIA: Record<Urgencia, string> = {
  normal: "",
  atencao: "border-l-4 border-l-amber-500",
  atrasado: "border-l-4 border-l-destructive",
}

const ESTILO_TEMPO: Record<Urgencia, string> = {
  normal: "text-muted-foreground",
  atencao: "font-semibold text-amber-700 dark:text-amber-400",
  atrasado: "font-semibold text-destructive",
}

/** Depois de pronto, quem segue com o pedido. */
const DEPOIS_DE_PRONTO: Partial<Record<Pedido["tipo"], string>> = {
  mesa: "Servir na mesa",
  entrega: "Aguardando o motoboy",
  retirada: "Aguardando o cliente",
}

const origem = (pedido: Pedido) =>
  pedido.mesa ? `Mesa ${pedido.mesa.numero}` : pedido.tipo === "entrega" ? "Entrega" : "Retirada"

function Itens({
  itens,
  rotulo,
  apagado,
}: {
  itens: ItemPedido[]
  rotulo: string
  apagado?: boolean
}) {
  return (
    <ul aria-label={rotulo} className={cn("flex flex-col gap-1.5", apagado && "opacity-60")}>
      {itens.map((item) => (
        <li key={item.id} className={cn(apagado ? "text-sm line-through" : "text-base")}>
          <span className="font-semibold tabular-nums">{item.quantidade}×</span> {item.nome}
          {!apagado && item.opcoes.length > 0 && (
            <span className="block text-sm text-muted-foreground">{item.opcoes.join(" · ")}</span>
          )}
          {!apagado && item.observacao && (
            <span className="block rounded bg-amber-500/15 px-1.5 text-sm font-medium">
              {item.observacao}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Ticket da cozinha: origem, cronômetro, o que preparar em letra grande e a próxima etapa. */
export function TicketCozinha({
  pedido,
  agora,
  ocupado,
  aoAvancar,
}: {
  pedido: Pedido
  agora: Date
  ocupado: boolean
  aoAvancar: () => void
}) {
  const semMovimento = useReducedMotion()
  const { atuais, anteriores } = itensDaCozinha(pedido)
  const nivel = urgenciaNaCozinha(pedido, agora)
  const minutos = Math.max(0, minutosNaCozinha(pedido, agora))
  const pronto = pedido.status === "pronto"
  const IconeTempo = nivel === "normal" ? ClockIcon : AlertTriangleIcon

  return (
    <motion.article
      layout={!semMovimento}
      initial={semMovimento ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      aria-label={`${origem(pedido)} · #${pedido.numero}`}
    >
      <Card className={cn("gap-3 py-3", !pronto && ESTILO_URGENCIA[nivel])}>
        <CardHeader className="flex flex-row items-center gap-2 px-3">
          <Badge variant={pedido.mesa ? "default" : "outline"} className="text-sm">
            {origem(pedido)}
          </Badge>
          <span className="text-sm font-semibold tabular-nums">#{pedido.numero}</span>
          {!pronto && (
            <span
              className={cn(
                "ml-auto flex items-center gap-1 text-sm tabular-nums",
                ESTILO_TEMPO[nivel],
              )}
            >
              <IconeTempo className="size-4" aria-hidden="true" />
              {minutos} min
              {nivel === "atrasado" && <span className="sr-only">, atrasado</span>}
            </span>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-3 px-3">
          <div className="flex flex-col text-sm">
            <span className="font-medium">{pedido.cliente.nome}</span>
            {pedido.mesa?.garcom && (
              <span className="text-muted-foreground">Garçom: {pedido.mesa.garcom}</span>
            )}
          </div>
          <Itens itens={atuais} rotulo="Para preparar" />
          {pedido.observacao && (
            <p className="rounded-md bg-muted px-2 py-1 text-sm">Obs.: {pedido.observacao}</p>
          )}
          {anteriores.length > 0 && (
            <div className="flex flex-col gap-1 border-t pt-2">
              <span className="text-xs font-medium text-muted-foreground">Já servido</span>
              <Itens itens={anteriores} rotulo="Já servido" apagado />
            </div>
          )}
        </CardContent>

        <CardFooter className="px-3">
          {pronto ? (
            <span className="text-sm text-muted-foreground">{DEPOIS_DE_PRONTO[pedido.tipo]}</span>
          ) : (
            <Button
              type="button"
              size="lg"
              className="flex-1"
              disabled={ocupado}
              onClick={aoAvancar}
            >
              {pedido.status === "recebido" ? "Iniciar preparo" : "Marcar pronto"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </motion.article>
  )
}
