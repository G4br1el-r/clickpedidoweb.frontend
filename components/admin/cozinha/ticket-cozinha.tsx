"use client"

import { AlertTriangleIcon, ClockIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import type { ItemPedido, Pedido } from "@/lib/admin/dados/tipos"
import { itensDaCozinha, minutosNaCozinha, urgenciaNaCozinha } from "@/lib/admin/regras/cozinha"
import type { Urgencia } from "@/lib/admin/regras/fila"
import { cn } from "@/lib/utils"
import { BotaoCarregando } from "../movimento/botao-carregando"
import { Traco } from "../traco"

/** O atraso aparece no tempo (pílula colorida) e num anel fino no ticket, nunca numa borda grossa. */
const ANEL_URGENCIA: Record<Urgencia, string> = {
  normal: "ring-border/80",
  atencao: "ring-(--tom-preparo)/45",
  atrasado: "ring-(--tom-cancelado)/45",
}

const ESTILO_TEMPO: Record<Urgencia, string> = {
  normal: "text-muted-foreground",
  atencao: "-my-0.5 px-1.5 py-0.5 font-semibold bg-(--tom-preparo)/12 text-(--tom-preparo-texto)",
  atrasado:
    "-my-0.5 px-1.5 py-0.5 font-semibold bg-(--tom-cancelado)/10 text-destructive dark:text-(--tom-cancelado)",
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
    <ul
      aria-label={rotulo}
      className={cn("flex flex-col", apagado ? "gap-0.5 opacity-60" : "gap-2")}
    >
      {itens.map((item) => (
        <li
          key={item.id}
          className={cn(apagado ? "text-sm line-through" : "text-[17px] leading-snug")}
        >
          <span className="font-semibold tabular-nums">{item.quantidade}×</span> {item.nome}
          {!apagado && item.opcoes.length > 0 && (
            <span className="block text-sm leading-normal text-muted-foreground">
              {item.opcoes.join(" · ")}
            </span>
          )}
          {!apagado && item.observacao && (
            // Observação do item é o que a cozinha não pode perder: o tom de atenção.
            <span className="mt-1 block w-fit rounded-md bg-(--tom-preparo)/12 px-1.5 py-0.5 text-sm font-medium text-(--tom-preparo-texto)">
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
  const pronto = pedido.status === "pronto"
  // Pronto não corre mais contra o relógio: o ticket fica quieto.
  const nivel = pronto ? "normal" : urgenciaNaCozinha(pedido, agora)
  const minutos = Math.max(0, minutosNaCozinha(pedido, agora))
  const IconeTempo = nivel === "normal" ? ClockIcon : AlertTriangleIcon

  return (
    <motion.article
      // O mesmo id em todas as colunas: ao avançar, o ticket anda até a coluna seguinte.
      layoutId={semMovimento ? undefined : `ticket-cozinha-${pedido.id}`}
      initial={semMovimento ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        default: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
        layout: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
      }}
      aria-label={`${origem(pedido)} · #${pedido.numero}`}
      data-urgencia={nivel}
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-card p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 transition-[box-shadow] duration-200",
        ANEL_URGENCIA[nivel],
      )}
    >
      <header className="flex items-center gap-2">
        <span className="text-base font-semibold">{origem(pedido)}</span>
        <span className="text-sm text-muted-foreground tabular-nums">#{pedido.numero}</span>
        {!pronto && (
          <span
            className={cn(
              "ml-auto flex items-center gap-1 rounded-md text-sm whitespace-nowrap tabular-nums",
              ESTILO_TEMPO[nivel],
            )}
          >
            <IconeTempo className="size-3.5" aria-hidden="true" />
            {minutos} min
            {nivel === "atrasado" && <span className="sr-only">, atrasado</span>}
          </span>
        )}
      </header>

      <div className="-mt-1.5 flex flex-col text-[13px] text-muted-foreground">
        <span className="font-medium text-foreground">{pedido.cliente.nome}</span>
        {pedido.mesa?.garcom && <span>Garçom: {pedido.mesa.garcom}</span>}
      </div>

      <Itens itens={atuais} rotulo="Para preparar" />
      {pedido.observacao && (
        <p className="rounded-md bg-foreground/[0.05] px-2 py-1.5 text-sm">
          Obs.: {pedido.observacao}
        </p>
      )}
      {anteriores.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border/70 pt-2">
          <span className="text-xs font-medium text-muted-foreground">Já servido</span>
          <Itens itens={anteriores} rotulo="Já servido" apagado />
        </div>
      )}

      <footer className="border-t border-border/70 pt-3">
        {pronto ? (
          <span className="flex items-center gap-2 text-sm font-medium">
            <Traco tom="pronto" />
            {DEPOIS_DE_PRONTO[pedido.tipo]}
          </span>
        ) : (
          <BotaoCarregando
            type="button"
            size="lg"
            className="h-11 w-full text-[15px]"
            carregando={ocupado}
            rotuloCarregando="Avançando o pedido"
            onClick={aoAvancar}
          >
            {pedido.status === "recebido" ? "Iniciar preparo" : "Marcar pronto"}
          </BotaoCarregando>
        )}
      </footer>
    </motion.article>
  )
}
