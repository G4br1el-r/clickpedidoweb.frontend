"use client"

import { useReducedMotion } from "motion/react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { plural } from "@/lib/formato"

const configuracao = {
  tickets: { label: "Tickets", color: "var(--grafico)" },
} satisfies ChartConfig

type Hora = { hora: number; tickets: number; tempoMedioMin: number | null }

/**
 * Tickets por hora da chegada, uma série só (sem legenda: o título diz o que é). A dica
 * mostra também o tempo médio até pronto daquela hora. Carregado só no navegador.
 */
export default function GraficoPorHora({ horas }: { horas: Hora[] }) {
  const semMovimento = useReducedMotion() ?? false
  const dados = horas.map((hora) => ({ ...hora, rotulo: `${hora.hora}h` }))
  if (dados.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Sem movimento no período.</p>
  }
  return (
    <ChartContainer config={configuracao} className="aspect-auto h-56 w-full">
      <BarChart data={dados} margin={{ top: 8, left: 4, right: 4 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              formatter={(valor, _nome, item) => {
                const tempo = item.payload.tempoMedioMin
                return `${plural(Number(valor), "ticket", "tickets")}${
                  tempo === null ? "" : ` · ${tempo} min até pronto`
                }`
              }}
            />
          }
        />
        <Bar
          dataKey="tickets"
          fill="var(--color-tickets)"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          isAnimationActive={!semMovimento}
        />
      </BarChart>
    </ChartContainer>
  )
}
