"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { nomesDo } from "@/lib/admin/regras/dashboard/nomes"
import {
  podeAgruparPorSemana,
  porSemana,
  reguaDeVendas,
  serieComAnterior,
} from "@/lib/admin/regras/dashboard/vendas"
import { diasNoPeriodo, type Periodo } from "@/lib/admin/regras/periodo"
import type { SegmentoPainelId } from "@/lib/admin/segmentos-painel"
import { BlocoSecao } from "../../bloco-secao"
import { Indicador, Regua } from "../../regua"
import type { MedidaDoGrafico } from "../grafico-por-dia"
import { Numero } from "../numero"
import { Secao, Variacao } from "../partes"

// Recharts pesa: o gráfico chega depois, só no navegador, com o esqueleto no lugar.
const GraficoDeVendas = dynamic(() => import("./grafico-vendas"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
})

type Agrupamento = "dia" | "semana"

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })

/** Variação sobre o período anterior; `null` quando antes não houve nada. */
const variacao = (atual: number, anterior: number) =>
  anterior > 0 ? ((atual - anterior) / anterior) * 100 : null

/** Vendas: quanto, quando e por onde a loja vende no período escolhido. */
export function AbaVendas({
  pedidos,
  periodo,
  segmento,
}: {
  /** Pedidos do período e do anterior, de mesmo tamanho. */
  pedidos: Pedido[]
  periodo: Periodo
  segmento: SegmentoPainelId
}) {
  const n = nomesDo(segmento)
  const regua = useMemo(() => reguaDeVendas(pedidos, periodo), [pedidos, periodo])
  const serie = useMemo(() => serieComAnterior(pedidos, periodo), [pedidos, periodo])
  const [medida, setMedida] = useState<MedidaDoGrafico>("faturamento")
  const [escolhido, setAgrupamento] = useState<Agrupamento>("dia")
  const semanal = podeAgruparPorSemana(periodo)
  // Um período curto volta a agrupar por dia, mesmo que a semana estivesse escolhida.
  const agrupamento = semanal ? escolhido : "dia"
  const dias = diasNoPeriodo(periodo)
  const anteriores = dias === 1 ? "o dia anterior" : `os ${dias} dias anteriores`
  const comparar = (escolher: (numeros: typeof regua.atual) => number) => {
    const valor = variacao(escolher(regua.atual), escolher(regua.anterior))
    return valor === null ? (
      "Sem vendas no período anterior"
    ) : (
      <Variacao valor={valor} texto={`sobre ${anteriores}`} />
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <Secao titulo="Vendas do período" descricao={dias === 1 ? "1 dia" : `${dias} dias`}>
        <Regua>
          <Indicador rotulo="Faturamento" detalhe={comparar((numeros) => numeros.faturamento)}>
            <Numero valor={regua.atual.faturamento} moeda />
          </Indicador>
          <Indicador rotulo={n.Pedidos} detalhe={comparar((numeros) => numeros.pedidos)}>
            <Numero valor={regua.atual.pedidos} />
          </Indicador>
          <Indicador rotulo="Ticket médio" detalhe={comparar((numeros) => numeros.ticket)}>
            <Numero valor={regua.atual.ticket} moeda />
          </Indicador>
          <Indicador
            rotulo={`Itens por ${n.pedido}`}
            detalhe={comparar((numeros) => numeros.itensPorPedido)}
          >
            {decimal.format(regua.atual.itensPorPedido)}
          </Indicador>
        </Regua>

        <BlocoSecao
          titulo={`${medida === "faturamento" ? "Faturamento" : n.Pedidos} por ${agrupamento}`}
          descricao="Em cinza, o período anterior. Toque numa barra para ver os pedidos"
          acao={
            <div className="flex flex-wrap gap-2">
              {semanal && (
                <ToggleGroup
                  type="single"
                  variant="segmento"
                  size="sm"
                  aria-label="Agrupar o gráfico"
                  value={agrupamento}
                  onValueChange={(valor) => valor && setAgrupamento(valor as Agrupamento)}
                >
                  <ToggleGroupItem value="dia" className="cursor-pointer">
                    Dia
                  </ToggleGroupItem>
                  <ToggleGroupItem value="semana" className="cursor-pointer">
                    Semana
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
              <ToggleGroup
                type="single"
                variant="segmento"
                size="sm"
                aria-label="O que mostrar no gráfico"
                value={medida}
                onValueChange={(valor) => valor && setMedida(valor as MedidaDoGrafico)}
              >
                <ToggleGroupItem value="faturamento" className="cursor-pointer">
                  R$
                </ToggleGroupItem>
                <ToggleGroupItem value="pedidos" className="cursor-pointer">
                  Qtd.
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          }
        >
          <GraficoDeVendas
            serie={agrupamento === "semana" ? porSemana(serie) : serie}
            medida={medida}
          />
        </BlocoSecao>
      </Secao>
    </div>
  )
}
