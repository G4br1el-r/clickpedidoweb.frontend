"use client"

import { format, startOfDay, subDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarRangeIcon } from "lucide-react"
import { parseAsString, useQueryStates } from "nuqs"
import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
// O locale do calendário traz também os rótulos de navegação em português.
import { ptBR as calendarioPtBR } from "react-day-picker/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAgora } from "@/hooks/use-agora"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import {
  ATALHOS,
  type Atalho,
  diasNoPeriodo,
  MAXIMO_DE_DIAS,
  normalizarPeriodo,
  type Periodo,
  periodoDoAtalho,
} from "@/lib/admin/regras/periodo"

/**
 * O período fica no endereço: `?de=2026-11-01&ate=2026-11-13`. `?data=` (um dia só) é o
 * que o gráfico da visão geral manda ao tocar num dia.
 */
export const PARAMETROS_PERIODO = { de: parseAsString, ate: parseAsString, data: parseAsString }

const naUrl = (data: Date) => format(data, "yyyy-MM-dd")
const curta = (data: Date) => format(data, "dd/MM", { locale: ptBR })

/** Período escolhido, lido do endereço. `null` até saber a hora local. */
export function usePeriodo() {
  const agora = useAgora()
  const [datas, setDatas] = useQueryStates(PARAMETROS_PERIODO)
  // Mesmo objeto enquanto as datas e a hora não mudam: as contas da tela não se repetem à toa.
  const periodo = useMemo(
    () =>
      agora
        ? normalizarPeriodo({ de: datas.data ?? datas.de, ate: datas.data ?? datas.ate }, agora)
        : null,
    [datas.de, datas.ate, datas.data, agora],
  )
  const escolher = ({ de, ate }: Periodo) =>
    setDatas({ de: naUrl(de), ate: naUrl(ate), data: null })
  return { agora, periodo, escolher }
}

export function textoDoPeriodo(periodo: Periodo) {
  const dias = diasNoPeriodo(periodo)
  const intervalo = dias === 1 ? curta(periodo.de) : `${curta(periodo.de)} a ${curta(periodo.ate)}`
  return `${intervalo} · ${dias === 1 ? "1 dia" : `${dias} dias`}`
}

/** Atalhos de período e um calendário para escolher as datas. */
export function FiltroPeriodo() {
  const { agora, periodo, escolher } = usePeriodo()
  const telaGrande = useTelaGrande()
  const [aberto, setAberto] = useState(false)
  const [rascunho, setRascunho] = useState<DateRange | undefined>()

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Período"
        value={periodo?.atalho ?? ""}
        onValueChange={(valor) => {
          if (agora && valor) escolher(periodoDoAtalho(valor as Atalho, agora))
        }}
        className="flex-wrap"
      >
        {ATALHOS.map(({ id, rotulo }) => (
          <ToggleGroupItem key={id} value={id} className="cursor-pointer">
            {rotulo}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Popover
        open={aberto}
        onOpenChange={(abrir) => {
          setAberto(abrir)
          if (abrir && periodo) setRascunho({ from: periodo.de, to: periodo.ate })
        }}
      >
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="justify-start tabular-nums">
            <CalendarRangeIcon data-icon="inline-start" />
            {periodo ? textoDoPeriodo(periodo) : "Escolher datas"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          {agora && (
            <Calendar
              mode="range"
              locale={calendarioPtBR}
              numberOfMonths={telaGrande ? 2 : 1}
              defaultMonth={rascunho?.from}
              selected={rascunho}
              disabled={{
                before: subDays(startOfDay(agora), MAXIMO_DE_DIAS - 1),
                after: agora,
              }}
              onSelect={(intervalo) => {
                setRascunho(intervalo)
                if (intervalo?.from && intervalo.to && intervalo.from !== intervalo.to) {
                  escolher({ de: intervalo.from, ate: intervalo.to })
                  setAberto(false)
                }
              }}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
