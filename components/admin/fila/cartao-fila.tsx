"use client"

import { format } from "date-fns"
import {
  AlertTriangleIcon,
  BikeIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  PrinterIcon,
  ScaleIcon,
  SparklesIcon,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import type { Motoboy, Pedido } from "@/lib/admin/dados/tipos"
import { textoCobranca, type Urgencia, urgencia } from "@/lib/admin/regras/fila"
import { textoRetirada } from "@/lib/admin/regras/numero"
import { itensParaPesar } from "@/lib/admin/regras/pesagem"
import { rotuloCanal } from "@/lib/admin/regras/rotulos"
import { rotuloAcao } from "@/lib/admin/regras/status"
import { cn } from "@/lib/utils"

const CANAL_CURTO = { entrega: "Entrega", retirada: "Retirada", atendimento: "Salão" } as const

const ESTILO_URGENCIA: Record<Urgencia, string> = {
  normal: "",
  atencao: "border-l-4 border-l-amber-500",
  atrasado: "border-l-4 border-l-destructive",
}

function Tempo({ pedido, agora }: { pedido: Pedido; agora: Date }) {
  const nivel = urgencia(pedido, agora)
  if (pedido.agendamento) {
    return (
      <span
        className={cn(
          "flex items-center gap-1",
          nivel === "atrasado" && "font-medium text-destructive",
        )}
      >
        <ClockIcon className="size-3.5" aria-hidden="true" />
        {format(new Date(pedido.agendamento.inicio), "HH:mm")} · {pedido.agendamento.duracaoMin} min
        {nivel === "atrasado" && " · passou da hora"}
      </span>
    )
  }
  const minutos = Math.max(0, Math.floor((agora.getTime() - Date.parse(pedido.criadoEm)) / 60_000))
  const Icone = nivel === "normal" ? ClockIcon : AlertTriangleIcon
  return (
    <span
      className={cn(
        "flex items-center gap-1 tabular-nums",
        nivel === "atencao" && "font-medium text-amber-700 dark:text-amber-400",
        nivel === "atrasado" && "font-medium text-destructive",
      )}
    >
      <Icone className="size-3.5" aria-hidden="true" />
      {format(new Date(pedido.criadoEm), "HH:mm")} · {minutos} min
      {nivel === "atrasado" && <span className="sr-only">, atrasado</span>}
    </span>
  )
}

/** Cartão de um pedido na fila: o que preparar, para quem, como cobrar e a próxima etapa. */
export function CartaoFila({
  pedido,
  agora,
  motoboys,
  novo,
  ocupado,
  aoAvancar,
  aoAbrir,
  aoImprimir,
}: {
  pedido: Pedido
  agora: Date
  motoboys: Motoboy[]
  novo: boolean
  ocupado: boolean
  aoAvancar: () => void
  aoAbrir: () => void
  aoImprimir: () => void
}) {
  const semMovimento = useReducedMotion()
  const acao = rotuloAcao(pedido.tipo, pedido.status)
  const motoboy = motoboys.find((item) => item.id === pedido.motoboyId)
  // Açougue: carne no quilo que ainda não passou pela balança.
  const aPesar = !pedido.pesagem && itensParaPesar(pedido).length > 0
  const canal = pedido.mesa
    ? `Mesa ${pedido.mesa.numero}`
    : CANAL_CURTO[pedido.tipo as keyof typeof CANAL_CURTO]

  return (
    <motion.article
      layout={!semMovimento}
      initial={semMovimento ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      aria-labelledby={`pedido-${pedido.id}`}
    >
      <Card
        className={cn(
          "gap-3 py-3",
          ESTILO_URGENCIA[urgencia(pedido, agora)],
          novo && "ring-2 ring-[var(--grafico)]",
        )}
      >
        <CardHeader className="flex flex-row items-center gap-2 px-3">
          <h3 id={`pedido-${pedido.id}`} className="text-base font-semibold tabular-nums">
            #{pedido.numero}
          </h3>
          <Badge variant="outline" data-canal="" title={rotuloCanal(pedido.tipo)}>
            {canal}
          </Badge>
          {aPesar && (
            <Badge variant="secondary" className="gap-1">
              <ScaleIcon aria-hidden="true" />A pesar
            </Badge>
          )}
          {novo && (
            <Badge className="gap-1">
              <SparklesIcon aria-hidden="true" />
              Chegou agora
            </Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            <Tempo pedido={pedido} agora={agora} />
          </span>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 px-3 text-sm">
          <div className="flex flex-col">
            <span className="font-medium">{pedido.cliente.nome}</span>
            {pedido.mesa?.garcom && (
              <span className="text-xs text-muted-foreground">Garçom: {pedido.mesa.garcom}</span>
            )}
            {pedido.endereco && (
              <span className="flex items-start gap-1 text-xs text-muted-foreground">
                <MapPinIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                {pedido.endereco.logradouro}, {pedido.endereco.numero} · {pedido.endereco.bairro}
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-1">
            {pedido.itens.map((item) => (
              <li key={item.id}>
                <span className="font-medium tabular-nums">{item.quantidade}×</span> {item.nome}
                {item.opcoes.length > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    {item.opcoes.join(" · ")}
                  </span>
                )}
                {item.observacao && (
                  <span className="block text-xs italic">“{item.observacao}”</span>
                )}
              </li>
            ))}
          </ul>
          {pedido.observacao && (
            <p className="rounded-md bg-muted px-2 py-1 text-xs">Obs.: {pedido.observacao}</p>
          )}
          {pedido.dataRetirada && (
            <p className="flex items-center gap-1 text-xs font-medium">
              <CalendarIcon className="size-3.5" aria-hidden="true" />
              {textoRetirada(pedido.dataRetirada)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{textoCobranca(pedido)}</p>
          {pedido.impressoEm && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <PrinterIcon className="size-3.5" aria-hidden="true" />
              Impresso às {format(new Date(pedido.impressoEm), "HH:mm")}
            </p>
          )}
          {motoboy && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <BikeIcon className="size-3.5" aria-hidden="true" />
              {motoboy.nome}
            </p>
          )}
        </CardContent>

        <CardFooter className="gap-2 px-3">
          {acao ? (
            <Button
              type="button"
              size="sm"
              className="flex-1"
              disabled={ocupado}
              onClick={aoAvancar}
            >
              {acao}
            </Button>
          ) : (
            <span className="flex-1 text-xs text-muted-foreground">Fecha em Mesas</span>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={`${pedido.impressoEm ? "Reimprimir" : "Imprimir"} cupom de #${pedido.numero}`}
            onClick={aoImprimir}
          >
            <PrinterIcon />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={aoAbrir}>
            Detalhes
          </Button>
        </CardFooter>
      </Card>
    </motion.article>
  )
}
