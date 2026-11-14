"use client"

import { addDays, differenceInMinutes, format, isSameDay, startOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, MoonIcon } from "lucide-react"
import { useState } from "react"
// O locale do calendário traz também os rótulos de navegação em português.
import { ptBR as calendarioPtBR } from "react-day-picker/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { HorarioFuncionamento, Pedido } from "@/lib/admin/dados/tipos"
import { expediente, faixasDoDia } from "@/lib/admin/regras/agenda"
import { cn } from "@/lib/utils"

/** Altura de uma hora na linha do tempo. */
const PX_POR_HORA = 64
const px = (minutos: number) => `${Math.round((minutos * PX_POR_HORA) / 60)}px`

const ESTILO_STATUS: Partial<Record<Pedido["status"], string>> = {
  recebido: "border-l-[var(--grafico)] bg-[color-mix(in_oklab,var(--grafico)_12%,var(--card))]",
  "em-preparo":
    "border-l-amber-500 bg-[color-mix(in_oklab,var(--color-amber-500)_14%,var(--card))]",
  concluido: "border-l-muted-foreground/40 bg-muted text-muted-foreground",
}

export const tituloDoDia = (dia: Date) => format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })

function Bloco({
  pedido,
  abre,
  posicao,
  aoAbrir,
}: {
  pedido: Pedido
  abre: Date
  posicao: { faixa: number; faixas: number }
  aoAbrir: () => void
}) {
  const inicio = new Date(pedido.agendamento?.inicio ?? pedido.criadoEm)
  const duracao = pedido.agendamento?.duracaoMin ?? 60
  const servicos = pedido.itens.map((item) => item.nome).join(", ")
  return (
    <button
      type="button"
      onClick={aoAbrir}
      style={{
        top: px(differenceInMinutes(inicio, abre)),
        height: px(duracao),
        left: `${(posicao.faixa / posicao.faixas) * 100}%`,
        width: `${100 / posicao.faixas}%`,
      }}
      className={cn(
        // O texto começa no topo (a hora de início); o anel da cor do fundo separa blocos vizinhos.
        "absolute flex flex-col justify-start overflow-hidden rounded-md border border-l-4 px-2 text-left text-xs shadow-[0_0_0_2px_var(--card)] outline-none transition-[filter] hover:brightness-95 focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50",
        // Serviço curto (20 ou 30 min): uma linha só, sem folga em cima e embaixo.
        duracao < 45 ? "py-0.5 leading-none" : "py-1",
        ESTILO_STATUS[pedido.status] ?? "bg-card",
      )}
    >
      <span className="block truncate font-medium">
        {format(inicio, "HH:mm")} · {pedido.cliente.nome}
      </span>
      {duracao > 30 && <span className="block truncate text-muted-foreground">{servicos}</span>}
      {pedido.status === "em-preparo" && <span className="sr-only">, em atendimento</span>}
      {pedido.status === "concluido" && <span className="sr-only">, concluído</span>}
    </button>
  )
}

/** Linha do tempo do dia: blocos do tamanho da duração, lado a lado quando se cruzam. */
export function AgendaDoDia({
  dia,
  agora,
  pedidos,
  horarios,
  mudarDia,
  aoAbrir,
}: {
  dia: Date
  agora: Date
  pedidos: Pedido[]
  horarios: HorarioFuncionamento[]
  mudarDia: (dia: Date) => void
  aoAbrir: (pedido: Pedido) => void
}) {
  const [calendarioAberto, setCalendarioAberto] = useState(false)
  const dele = expediente(dia, horarios)
  const doDia = pedidos.filter(
    (pedido) =>
      pedido.agendamento &&
      pedido.status !== "cancelado" &&
      isSameDay(new Date(pedido.agendamento.inicio), dia),
  )
  const faixas = faixasDoDia(doDia)
  const horas = dele ? Math.ceil(differenceInMinutes(dele.fecha, dele.abre) / 60) : 0
  const rotulosDasHoras = dele
    ? Array.from({ length: horas }, (_, hora) =>
        format(new Date(dele.abre.getTime() + hora * 3_600_000), "HH:mm"),
      )
    : []
  const minutoAgora = dele && isSameDay(agora, dia) ? differenceInMinutes(agora, dele.abre) : -1
  const fechado = (data: Date) => expediente(data, horarios) === null

  return (
    <section aria-label="Agenda do dia" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* No celular, o título fica sozinho e os botões seguem juntos na linha de baixo. */}
        <h2 className="w-full text-lg font-semibold first-letter:uppercase sm:mr-auto sm:w-auto">
          {tituloDoDia(dia)}
        </h2>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Dia anterior"
          onClick={() => mudarDia(addDays(dia, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => mudarDia(startOfDay(agora))}
        >
          Hoje
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Próximo dia"
          onClick={() => mudarDia(addDays(dia, 1))}
        >
          <ChevronRightIcon />
        </Button>
        <Popover open={calendarioAberto} onOpenChange={setCalendarioAberto}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <CalendarIcon data-icon="inline-start" />
              Escolher dia
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              locale={calendarioPtBR}
              selected={dia}
              defaultMonth={dia}
              modifiers={{ fechado }}
              modifiersClassNames={{ fechado: "opacity-40" }}
              onSelect={(escolhido) => {
                if (!escolhido) return
                mudarDia(escolhido)
                setCalendarioAberto(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {!dele ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MoonIcon />
            </EmptyMedia>
            <EmptyTitle>O salão não abre neste dia.</EmptyTitle>
            <EmptyDescription>Escolha outro dia para ver ou marcar atendimentos.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex rounded-xl border bg-card p-2">
          <ol
            aria-hidden="true"
            className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground"
          >
            {rotulosDasHoras.map((rotulo) => (
              <li key={rotulo} style={{ height: px(60) }} className="-translate-y-1.5">
                {rotulo}
              </li>
            ))}
          </ol>
          <div className="relative flex-1" style={{ height: px(horas * 60) }}>
            {rotulosDasHoras.map((rotulo, hora) => (
              <div
                key={rotulo}
                aria-hidden="true"
                className="absolute inset-x-0 border-t border-dashed"
                style={{ top: px(hora * 60) }}
              />
            ))}
            {doDia.map((pedido) => (
              <Bloco
                key={pedido.id}
                pedido={pedido}
                abre={dele.abre}
                posicao={faixas.get(pedido.id) ?? { faixa: 0, faixas: 1 }}
                aoAbrir={() => aoAbrir(pedido)}
              />
            ))}
            {minutoAgora >= 0 && minutoAgora <= horas * 60 && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-destructive"
                style={{ top: px(minutoAgora) }}
              />
            )}
            {doDia.length === 0 && (
              <p className="absolute inset-x-0 top-6 text-center text-sm text-muted-foreground">
                Nenhum atendimento marcado.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
