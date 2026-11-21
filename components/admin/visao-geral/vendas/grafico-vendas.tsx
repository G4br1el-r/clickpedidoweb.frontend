"use client"

import { format, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useReducedMotion } from "motion/react"
import { useRouter } from "next/navigation"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { PontoDeVendas } from "@/lib/admin/regras/dashboard/vendas"
import { emReais, emReaisCurto } from "@/lib/formato"
import type { MedidaDoGrafico } from "../grafico-por-dia"

const configuracao = {
  atual: { label: "No período", color: "var(--grafico)" },
  anterior: { label: "Período anterior", color: "var(--grafico-anterior)" },
} satisfies ChartConfig

const formatar = (medida: MedidaDoGrafico, valor: number) =>
  medida === "faturamento" ? emReais(valor) : `${valor} ${valor === 1 ? "pedido" : "pedidos"}`

const dia = (data: Date) => format(data, "yyyy-MM-dd")

/** Endereço da lista de pedidos do trecho: um dia vira `data`, uma semana vira `de` e `ate`. */
const pedidosDo = (ponto: PontoDeVendas) =>
  isSameDay(ponto.inicio, ponto.fim)
    ? `/admin/pedidos?data=${dia(ponto.inicio)}`
    : `/admin/pedidos?de=${dia(ponto.inicio)}&ate=${dia(ponto.fim)}`

const rotulo = (ponto: PontoDeVendas) =>
  isSameDay(ponto.inicio, ponto.fim)
    ? format(ponto.inicio, "dd/MM")
    : `${format(ponto.inicio, "dd/MM")}–${format(ponto.fim, "dd/MM")}`

/**
 * Barras do período, em azul, com o período anterior em cinza atrás, para comparar.
 * Clicar no dia (ou na semana) abre os pedidos dele. Carregado só no navegador.
 */
export default function GraficoDeVendas({
  serie,
  medida,
}: {
  serie: PontoDeVendas[]
  medida: MedidaDoGrafico
}) {
  const roteador = useRouter()
  const semMovimento = useReducedMotion() ?? false
  const dados = serie.map((ponto) => ({
    ponto,
    rotulo: rotulo(ponto),
    titulo: isSameDay(ponto.inicio, ponto.fim)
      ? format(ponto.inicio, "EEEE, dd/MM", { locale: ptBR })
      : `Semana de ${rotulo(ponto)}`,
    atual: ponto[medida],
    anterior: ponto.anterior[medida],
  }))

  return (
    <ChartContainer config={configuracao} className="aspect-auto h-64 w-full">
      <BarChart data={dados} margin={{ top: 8, left: 4, right: 4 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
        {/* Eixo escondido só para o anterior: as duas barras ficam no mesmo lugar, uma atrás da outra. */}
        <XAxis xAxisId="anterior" dataKey="rotulo" hide />
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
              labelFormatter={(_, itens) => itens[0]?.payload.titulo}
              formatter={(valor, nome) =>
                `${configuracao[nome as keyof typeof configuracao].label}: ${formatar(medida, Number(valor))}`
              }
            />
          }
        />
        {/* O anterior vem primeiro para ficar atrás; a barra do período, mais fina, fica na frente. */}
        <Bar
          dataKey="anterior"
          xAxisId="anterior"
          className="barras-anterior"
          fill="var(--color-anterior)"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          isAnimationActive={!semMovimento}
        />
        <Bar
          dataKey="atual"
          className="barras-atual cursor-pointer"
          fill="var(--color-atual)"
          radius={[4, 4, 0, 0]}
          maxBarSize={14}
          isAnimationActive={!semMovimento}
          onClick={(barra: { payload?: { ponto: PontoDeVendas } }) => {
            if (barra.payload) roteador.push(pedidosDo(barra.payload.ponto))
          }}
        />
      </BarChart>
    </ChartContainer>
  )
}
