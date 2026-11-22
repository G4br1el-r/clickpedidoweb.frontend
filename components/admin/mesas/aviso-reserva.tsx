"use client"

import { format } from "date-fns"
import { CalendarClockIcon } from "lucide-react"
import { useAgora } from "@/hooks/use-agora"
import { useConfigSalao, useReservas } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa, Reserva } from "@/lib/admin/dados/tipos"
import { reservaDaMesa } from "@/lib/admin/regras/reservas"
import { plural } from "@/lib/formato"

/**
 * A reserva que segura a mesa agora, para a tela pedir a confirmação antes de abrir, transferir
 * ou juntar. Só vale na mesa sem comanda: a aberta (ou junta a outra) já está ocupada.
 * `ignorar`: a reserva que está sentando, que não pede confirmação para ela mesma (como o
 * servidor, que procura outra reserva da vez sem ela).
 */
export function useReservaDaVez(): (
  mesa: Mesa | undefined,
  ignorar?: string,
) => Reserva | undefined {
  const { data: reservas } = useReservas()
  const { data: salao } = useConfigSalao()
  const agora = useAgora(30_000)
  return (mesa, ignorar) =>
    mesa && salao && agora && mesa.status === "livre" && !mesa.juntadaCom
      ? reservaDaMesa(
          mesa,
          (reservas ?? []).filter((reserva) => reserva.id !== ignorar),
          agora,
          salao.reservas,
        )
      : undefined
}

/** "Reservada 20:50", para a mesa na lista de escolha. */
export const rotuloDaReserva = (reserva: Reserva) =>
  `reservada ${format(new Date(reserva.inicio), "HH:mm")}`

/** A mesa na lista de escolha: "Mesa 13", ou "Mesa 13 · reservada 20:50". */
export const nomeNaLista = (mesa: Pick<Mesa, "numero">, reserva: Reserva | undefined) =>
  reserva ? `Mesa ${mesa.numero} · ${rotuloDaReserva(reserva)}` : `Mesa ${mesa.numero}`

/** O aviso de que a mesa está reservada: quem confirma é o botão "… mesmo assim". */
export function AvisoReserva({ reserva, id }: { reserva: Reserva; id?: string }) {
  return (
    <p id={id} className="flex items-start gap-2 rounded-lg bg-(--tom-espera)/10 px-3 py-2 text-sm">
      <CalendarClockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        Reservada às {format(new Date(reserva.inicio), "HH:mm")} para {reserva.nome},{" "}
        {plural(reserva.pessoas, "pessoa", "pessoas")}.
      </span>
    </p>
  )
}
