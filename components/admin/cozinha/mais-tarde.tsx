"use client"

import { format } from "date-fns"
import { CalendarClockIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type ConfigCozinha, comecaEm, type TicketCozinha } from "@/lib/admin/regras/cozinha"
import { nomeDoTicket } from "./ticket-cozinha"

const hora = (quando: string | number) => format(new Date(quando), "HH:mm")

/**
 * Faixa Mais tarde: os agendados que ainda não chegaram à hora de começar. Cada um diz
 * para quando é e quando começa; "Iniciar agora" adianta o preparo.
 */
export function MaisTarde({
  tickets,
  tempos,
  emAndamento,
  aoIniciar,
}: {
  tickets: TicketCozinha[]
  tempos: ConfigCozinha
  emAndamento: string | undefined
  aoIniciar: (ticket: TicketCozinha) => void
}) {
  if (tickets.length === 0) return null
  return (
    <section aria-label={`Mais tarde, ${tickets.length}`} className="flex flex-col gap-2.5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <CalendarClockIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        Mais tarde
        <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
          {tickets.length}
        </span>
      </h2>
      {/* Cartões compactos em grade: a hora, o pedido e o botão ficam perto na tela larga. */}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {tickets.map((ticket) => (
          <li
            key={ticket.id}
            aria-label={nomeDoTicket(ticket)}
            className="flex min-w-0 items-center gap-3 rounded-lg border border-dashed border-border py-2 pr-2 pl-3"
          >
            <span className="text-base font-semibold tabular-nums">
              {hora(ticket.agendadoPara ?? "")}
            </span>
            <span className="flex min-w-0 flex-1 flex-col text-sm">
              <span className="font-medium">{nomeDoTicket(ticket)}</span>
              <span className="truncate text-[13px] text-muted-foreground">
                {ticket.itens.map((item) => `${item.quantidade}× ${item.nome}`).join(", ")}
              </span>
              <span className="text-[13px] text-muted-foreground tabular-nums">
                começa {hora(comecaEm(ticket, tempos))}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={emAndamento === ticket.id}
              onClick={() => aoIniciar(ticket)}
            >
              Iniciar agora
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
