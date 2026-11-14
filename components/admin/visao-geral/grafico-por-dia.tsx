"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useReducedMotion } from "motion/react"
import { useRouter } from "next/navigation"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { DiaDaSerie } from "@/lib/admin/regras/dashboard"
import { emReais, emReaisCurto } from "@/lib/formato"

export type MedidaDoGrafico = "faturamento" | "pedidos"

const configuracao = {
  faturamento: { label: "Faturamento", color: "var(--grafico)" },
  pedidos: { label: "Pedidos", color: "var(--grafico)" },
} satisfies ChartConfig

const formatar = (medida: MedidaDoGrafico, valor: number) =>
  medida === "faturamento" ? emReais(valor) : `${valor} ${valor === 1 ? "pedido" : "pedidos"}`

/**
 * Barras por dia, uma série só (sem legenda: o título diz o que é). O pico ganha o valor
 * escrito no topo; clicar no dia abre os pedidos dele. Carregado só no navegador.
 */
export default function GraficoPorDia({
  serie,
  medida,
}: {
  serie: DiaDaSerie[]
  medida: MedidaDoGrafico
}) {
  const roteador = useRouter()
  const semMovimento = useReducedMotion() ?? false
  const dados = serie.map((dia) => ({
    ...dia,
    rotulo: dia.hoje ? "Hoje" : format(dia.data, "dd/MM"),
    dataCompleta: format(dia.data, "EEEE, dd/MM", { locale: ptBR }),
  }))

  return (
    <ChartContainer config={configuracao} className="aspect-auto h-64 w-full">
      <BarChart data={dados} margin={{ top: 22, left: 4, right: 4 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={medida === "faturamento" ? 56 : 32}
          allowDecimals={false}
          tickFormatter={(valor: number) =>
            medida === "faturamento" ? emReaisCurto(valor) : String(valor)
          }
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, itens) => itens[0]?.payload.dataCompleta}
              formatter={(valor) => formatar(medida, Number(valor))}
            />
          }
        />
        <Bar
          dataKey={medida}
          fill={`var(--color-${medida})`}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          isAnimationActive={!semMovimento}
          className="cursor-pointer"
          onClick={(dia: { payload?: DiaDaSerie }) => {
            if (dia.payload)
              roteador.push(`/admin/pedidos?data=${format(dia.payload.data, "yyyy-MM-dd")}`)
          }}
        >
          <LabelList
            dataKey={medida}
            position="top"
            className="fill-foreground text-xs font-medium"
            content={({ x, y, width, value, index }) => {
              if (typeof index !== "number" || !dados[index]?.pico) return null
              return (
                <text
                  x={Number(x) + Number(width) / 2}
                  y={Number(y) - 8}
                  textAnchor="middle"
                  className="fill-foreground text-xs font-medium"
                >
                  {medida === "faturamento" ? emReaisCurto(Number(value)) : value}
                </text>
              )
            }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
