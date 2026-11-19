"use client"

import { addMinutes, format, isSameDay, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarClockIcon } from "lucide-react"
import { useState } from "react"
import { Controller, useFormContext } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  diaInicialParaAgendar,
  diasParaAgendar,
  duracaoDaSacola,
  horariosParaAgendar,
} from "@/lib/agendar"
import type { DadosCheckout } from "@/lib/checkout"
import { useLoja } from "@/lib/loja-atual"
import { useSacola } from "@/lib/sacola"
import { cn } from "@/lib/utils"
import { CabecalhoPasso } from "./cabecalho-passo"

const PILULA =
  "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-border text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 ease-saida active:scale-[0.97] has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary has-data-[state=checked]:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"

/** 120 vira "2h"; 90, "1h30"; 45, "45 min". */
function duracaoEmTexto(minutos: number) {
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas === 0) return `${resto} min`
  return `${horas}h${resto ? String(resto).padStart(2, "0") : ""}`
}

/**
 * Salão: no lugar da entrega, o dia e o horário do atendimento. Só aparecem horários em
 * que todos os serviços da sacola cabem antes de fechar (a mesma regra da agenda do painel).
 */
export function PassoHorario() {
  const {
    control,
    formState: { errors },
  } = useFormContext<DadosCheckout>()
  const loja = useLoja()
  const itens = useSacola((estado) => estado.itens)
  const duracao = duracaoDaSacola(itens)
  const agora = new Date()
  const expediente = loja.expediente ?? []
  const capacidade = loja.capacidade ?? 1
  const dias = diasParaAgendar(expediente, agora, 7)
  const [diaEscolhido, setDiaEscolhido] = useState(
    () =>
      diaInicialParaAgendar({
        dias,
        duracaoMin: duracao,
        horarios: expediente,
        capacidade,
        agora,
      })?.toISOString() ?? "",
  )
  const dia = dias.find((item) => item.toISOString() === diaEscolhido) ?? dias[0]
  const horas = dia
    ? horariosParaAgendar({ dia, duracaoMin: duracao, horarios: expediente, capacidade, agora })
    : []

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPasso
        titulo="Quando você quer vir?"
        descricao={`Seu atendimento dura ${duracaoEmTexto(duracao)}.`}
      />

      <div className="flex flex-col gap-2">
        <p id="titulo-dia" className="text-sm font-medium">
          Dia
        </p>
        <RadioGroup
          aria-labelledby="titulo-dia"
          value={dia?.toISOString() ?? ""}
          onValueChange={setDiaEscolhido}
          className="grid grid-cols-4 gap-2 sm:grid-cols-7"
        >
          {dias.map((opcao) => (
            <Label key={opcao.toISOString()} className={cn(PILULA, "h-16")}>
              <RadioGroupItem value={opcao.toISOString()} className="sr-only" />
              <span className="text-xs font-medium opacity-80">
                {format(opcao, "EEEE", { locale: ptBR }).slice(0, 3)}
              </span>{" "}
              <span className="tabular-nums">{format(opcao, "dd/MM")}</span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <Controller
        control={control}
        name="agendamento"
        render={({ field }) => {
          const escolhido = field.value ? parseISO(field.value) : null
          const doDia = escolhido && dia && isSameDay(escolhido, dia)
          return (
            <div className="flex flex-col gap-2">
              <p id="titulo-horario" className="text-sm font-medium">
                Horário
              </p>
              {horas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum horário livre neste dia para tudo o que está na sacola. Tente outro dia.
                </p>
              ) : (
                <RadioGroup
                  aria-labelledby="titulo-horario"
                  aria-invalid={Boolean(errors.agendamento)}
                  value={doDia ? field.value : ""}
                  onValueChange={field.onChange}
                  className="grid grid-cols-4 gap-2 sm:grid-cols-6"
                >
                  {horas.map((hora) => (
                    <Label key={hora.toISOString()} className={cn(PILULA, "h-11 tabular-nums")}>
                      <RadioGroupItem value={hora.toISOString()} className="sr-only" />
                      {format(hora, "HH:mm")}
                    </Label>
                  ))}
                </RadioGroup>
              )}
              {escolhido && doDia && (
                <p className="flex items-center gap-2 pt-1 text-sm text-muted-foreground tabular-nums">
                  <CalendarClockIcon className="size-4 shrink-0" aria-hidden="true" />
                  {format(escolhido, "EEEE, dd/MM", { locale: ptBR })}, das{" "}
                  {format(escolhido, "HH:mm")} às {format(addMinutes(escolhido, duracao), "HH:mm")}
                </p>
              )}
              {errors.agendamento && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {errors.agendamento.message}
                </p>
              )}
            </div>
          )
        }}
      />
    </div>
  )
}
