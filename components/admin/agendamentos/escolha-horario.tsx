"use client"

import { format, startOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState } from "react"
// O locale do calendário traz também os rótulos de navegação em português.
import { ptBR as calendarioPtBR } from "react-day-picker/locale"
import { Calendar } from "@/components/ui/calendar"
import { FieldLegend, FieldSet } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useHorariosLivres } from "@/lib/admin/dados/consultas-agenda"
import type { HorarioFuncionamento } from "@/lib/admin/dados/tipos"
import { expediente } from "@/lib/admin/regras/agenda"
import { EsqueletoHorarios } from "./esqueletos-agenda"

/** "1 h", "1 h 30" ou "30 min". */
export function textoDuracao(minutos: number) {
  if (minutos < 60) return `${minutos} min`
  const resto = minutos % 60
  return `${Math.floor(minutos / 60)} h${resto ? ` ${String(resto).padStart(2, "0")}` : ""}`
}

/** "terça-feira, 01/12, às 11:00": o mesmo texto do lembrete no WhatsApp. */
export const textoDoHorario = (inicio: Date) =>
  format(inicio, "EEEE, dd/MM, 'às' HH:mm", { locale: ptBR })

/**
 * Dia no calendário (só dias abertos, de hoje em diante) e os horários livres dele,
 * conforme os serviços escolhidos e a capacidade do salão.
 */
export function EscolhaHorario({
  servicos,
  ignorarId,
  diaInicial,
  agora,
  horarios,
  valor,
  aoMudar,
}: {
  servicos: string[]
  ignorarId?: number
  diaInicial: Date
  agora: Date
  horarios: HorarioFuncionamento[]
  valor: string | null
  aoMudar: (inicio: string | null) => void
}) {
  const hoje = startOfDay(agora)
  const indisponivel = (data: Date) => data < hoje || expediente(data, horarios) === null
  const [dia, setDia] = useState<Date | null>(indisponivel(diaInicial) ? null : diaInicial)
  const { data: livres, isFetching } = useHorariosLivres(dia, servicos, ignorarId)

  let horariosDoDia: React.ReactNode
  if (servicos.length === 0) {
    horariosDoDia = (
      <p className="text-sm text-muted-foreground">Escolha os serviços para ver os horários.</p>
    )
  } else if (!dia) {
    horariosDoDia = <p className="text-sm text-muted-foreground">Escolha o dia.</p>
  } else if (!livres) {
    horariosDoDia = <EsqueletoHorarios />
  } else if (livres.length === 0) {
    horariosDoDia = <p className="text-sm text-muted-foreground">Nenhum horário livre neste dia.</p>
  } else {
    horariosDoDia = (
      <RadioGroup
        aria-label="Horário"
        value={valor ?? ""}
        onValueChange={aoMudar}
        aria-busy={isFetching}
        className="grid grid-cols-4 gap-1.5 sm:grid-cols-5"
      >
        {livres.map((livre) => {
          const hora = format(new Date(livre), "HH:mm")
          const id = `horario-${livre}`
          return (
            <Label
              key={livre}
              htmlFor={id}
              className="flex min-h-9 cursor-pointer max-sm:min-h-11 items-center justify-center rounded-md bg-background text-sm font-medium tabular-nums ring-1 ring-border/80 transition-[background-color,color,box-shadow] duration-150 hover:ring-foreground/30 active:scale-[0.97] has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-[[data-state=checked]]:bg-primary has-[[data-state=checked]]:text-primary-foreground has-[[data-state=checked]]:ring-primary"
            >
              <RadioGroupItem id={id} value={livre} className="sr-only" />
              {hora}
            </Label>
          )
        })}
      </RadioGroup>
    )
  }

  return (
    <FieldSet>
      <FieldLegend variant="label">Dia e horário</FieldLegend>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Calendar
          mode="single"
          // Tocar de novo no dia escolhido não desmarca.
          required
          locale={calendarioPtBR}
          selected={dia ?? undefined}
          defaultMonth={dia ?? diaInicial}
          disabled={indisponivel}
          onSelect={(escolhido: Date) => {
            setDia(escolhido)
            aoMudar(null)
          }}
          className="rounded-xl ring-1 ring-border/80"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">{horariosDoDia}</div>
      </div>
    </FieldSet>
  )
}
