"use client"

import { format } from "date-fns"
import { CalendarPlusIcon, EllipsisIcon, PencilIcon, UserXIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAgora } from "@/hooks/use-agora"
import {
  useCancelarReserva,
  useNaoCompareceu,
  useReservas,
} from "@/lib/admin/dados/consultas-mesas"
import type { ConfigSalao, Mesa, Reserva } from "@/lib/admin/dados/tipos"
import { statusDaReserva } from "@/lib/admin/regras/reservas"
import { plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { FormularioReserva } from "./formulario-reserva"

const ROTULO_STATUS: Record<Exclude<Reserva["status"], "marcada">, string> = {
  sentou: "Sentou",
  "nao-compareceu": "Não compareceu",
  cancelada: "Cancelada",
}

/** Uma reserva do dia: hora, nome, pessoas, mesa e, nas marcadas, as ações. */
function LinhaReserva({
  reserva,
  mesas,
  salao,
  agora,
  aoEditar,
}: {
  reserva: Reserva
  mesas: Mesa[]
  salao: ConfigSalao
  agora: Date | null
  aoEditar: () => void
}) {
  const naoCompareceu = useNaoCompareceu()
  const cancelar = useCancelarReserva()
  const status = agora ? statusDaReserva(reserva, agora, salao.reservas) : reserva.status
  const mesa = mesas.find((item) => item.id === reserva.mesaId)
  const aoErrar = (erro: Error) => toast.error(erro.message)
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="w-11 shrink-0 pt-px text-sm font-semibold tabular-nums">
        {format(new Date(reserva.inicio), "HH:mm")}
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          status !== "marcada" && "text-muted-foreground",
        )}
      >
        <span className="truncate text-sm font-medium">{reserva.nome}</span>
        <span className="text-xs text-muted-foreground">
          {plural(reserva.pessoas, "pessoa", "pessoas")} ·{" "}
          {mesa ? `Mesa ${mesa.numero}` : "Sem mesa"}
          {status !== "marcada" && <> · {ROTULO_STATUS[status]}</>}
        </span>
      </span>
      {reserva.status === "marcada" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Mais ações da reserva de ${reserva.nome}`}
            >
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={aoEditar}>
              <PencilIcon />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                naoCompareceu.mutate(reserva.id, {
                  onSuccess: () => toast.success(`${reserva.nome} não compareceu.`),
                  onError: aoErrar,
                })
              }
            >
              <UserXIcon />
              Não compareceu
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                cancelar.mutate(reserva.id, {
                  onSuccess: () => toast.success(`Reserva de ${reserva.nome} cancelada.`),
                  onError: aoErrar,
                })
              }
            >
              <XIcon />
              Cancelar reserva
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}

/** As reservas de hoje, pelo horário, com "Nova reserva". */
function Reservas({ mesas, salao }: { mesas: Mesa[]; salao: ConfigSalao }) {
  const { data: reservas } = useReservas(4_000)
  const agora = useAgora(30_000)
  const [nova, setNova] = useState(false)
  const [editando, setEditando] = useState<Reserva | null>(null)
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => setNova(true)}
      >
        <CalendarPlusIcon data-icon="inline-start" />
        Nova reserva
      </Button>
      {reservas && reservas.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nenhuma reserva para hoje.</p>
      ) : (
        <ul aria-label="Reservas de hoje" className="flex flex-col divide-y divide-border/70">
          {(reservas ?? []).map((reserva) => (
            <LinhaReserva
              key={reserva.id}
              reserva={reserva}
              mesas={mesas}
              salao={salao}
              agora={agora}
              aoEditar={() => setEditando(reserva)}
            />
          ))}
        </ul>
      )}
      <FormularioReserva aberto={nova} aoMudar={setNova} />
      <FormularioReserva
        key={editando?.id}
        reserva={editando ?? undefined}
        aberto={editando !== null}
        aoMudar={(aberto) => !aberto && setEditando(null)}
      />
    </div>
  )
}

/** Reservas do dia e lista de espera (Q11, Q24, Q25), ao lado da grade. */
export function PainelReservas({ mesas, salao }: { mesas: Mesa[]; salao: ConfigSalao }) {
  return (
    <section
      aria-labelledby="titulo-reservas-espera"
      className="flex min-w-0 flex-col gap-3 rounded-xl bg-foreground/[0.03] p-4"
    >
      <h2 id="titulo-reservas-espera" className="text-[15px] font-semibold tracking-[-0.01em]">
        Reservas e espera
      </h2>
      <Reservas mesas={mesas} salao={salao} />
    </section>
  )
}
