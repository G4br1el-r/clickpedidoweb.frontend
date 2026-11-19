"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronDownIcon } from "lucide-react"
import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { nomesDo } from "@/lib/admin/regras/dashboard/nomes"
import {
  canaisDasVendas,
  mapaDeCalor,
  mediaPorHora,
  origensDasVendas,
  podeAgruparPorSemana,
  porSemana,
  reguaDeVendas,
  serieComAnterior,
} from "@/lib/admin/regras/dashboard/vendas"
import { diasNoPeriodo, type Periodo } from "@/lib/admin/regras/periodo"
import { rotuloCanal, rotuloOrigem } from "@/lib/admin/regras/rotulos"
import type { SegmentoPainelId } from "@/lib/admin/segmentos-painel"
import { emReais } from "@/lib/formato"
import { BlocoSecao } from "../../bloco-secao"
import { Indicador, Regua } from "../../regua"
import type { MedidaDoGrafico } from "../grafico-por-dia"
import { Numero } from "../numero"
import { ListaDeFatias, Secao, Variacao } from "../partes"
import { MapaDeCalor } from "./mapa-de-calor"

// Recharts pesa: o gráfico chega depois, só no navegador, com o esqueleto no lugar.
const GraficoDeVendas = dynamic(() => import("./grafico-vendas"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
})

type Agrupamento = "dia" | "semana"

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })

const dia = (data: Date) => format(data, "yyyy-MM-dd")

/** Média de cada hora do dia, em barras horizontais do mesmo azul dos gráficos. */
function ListaPorHora({
  horas,
  pedido,
  pedidos,
}: {
  horas: ReturnType<typeof mediaPorHora>
  pedido: string
  pedidos: string
}) {
  if (horas.length === 0)
    return <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
  const maior = Math.max(...horas.map((hora) => hora.faturamento))
  return (
    <ul className="barras-do-grafico flex flex-col gap-2">
      {horas.map((hora) => (
        <li key={hora.hora} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="text-muted-foreground tabular-nums">{hora.hora}h</span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {decimal.format(hora.pedidos)} {hora.pedidos < 2 ? pedido : pedidos} por dia
            </span>
            <Progress
              value={maior ? (hora.faturamento / maior) * 100 : 0}
              aria-hidden="true"
              className="h-1.5"
            />
          </div>
          <span className="tabular-nums">{emReais(hora.faturamento)}</span>
        </li>
      ))}
    </ul>
  )
}

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
  const mapa = useMemo(() => mapaDeCalor(pedidos, periodo), [pedidos, periodo])
  const horas = useMemo(() => mediaPorHora(pedidos, periodo), [pedidos, periodo])
  const canais = useMemo(() => canaisDasVendas(pedidos, periodo), [pedidos, periodo])
  const origens = useMemo(() => origensDasVendas(pedidos, periodo), [pedidos, periodo])
  const noPeriodo = `de=${dia(periodo.de)}&ate=${dia(periodo.ate)}`
  const [tabelaAberta, setTabelaAberta] = useState(false)
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
            <Numero valor={regua.atual.itensPorPedido} />
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

      <Secao titulo="Quando a loja vende" descricao="Toque numa célula para ver o número">
        <MapaDeCalor mapa={mapa} pedido={n.pedido} pedidos={n.pedidos} />
      </Secao>

      <Secao titulo="Média por hora do dia" descricao="Faturamento médio por dia, em cada hora">
        <ListaPorHora horas={horas} pedido={n.pedido} pedidos={n.pedidos} />
      </Secao>

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2">
        <Secao titulo="Canais de venda" descricao="No período">
          <ListaDeFatias
            vazio="Nenhuma venda no período."
            itens={canais.map((fatia) => ({
              ...fatia,
              chave: fatia.tipo,
              nome: rotuloCanal(fatia.tipo),
              href: `/admin/pedidos?canal=${fatia.tipo}&${noPeriodo}`,
            }))}
          />
        </Secao>
        <Secao titulo={`Origem dos ${n.pedidos}`} descricao="Por onde entraram">
          <ListaDeFatias
            vazio="Nenhuma venda no período."
            itens={origens.map((fatia) => ({
              ...fatia,
              chave: fatia.origem,
              nome: rotuloOrigem(fatia.origem),
              href: `/admin/pedidos?origem=${fatia.origem}&${noPeriodo}`,
            }))}
          />
        </Secao>
      </div>

      <Collapsible open={tabelaAberta} onOpenChange={setTabelaAberta}>
        <div className="border-y border-border/70">
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between py-4 text-left text-[15px] font-semibold tracking-[-0.01em] outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Dia a dia do período, em tabela
            <ChevronDownIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform duration-200 ease-saida data-[state=open]:rotate-180"
              data-state={tabelaAberta ? "open" : "closed"}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pb-4">
              <Table aria-label="Dia a dia do período">
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead className="text-right">{n.Pedidos}</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Ticket médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serie.toReversed().map((ponto) => (
                    <TableRow key={ponto.inicio.toISOString()}>
                      <TableCell className="capitalize">
                        {format(ponto.inicio, "EEE, dd/MM", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{ponto.pedidos}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {emReais(ponto.faturamento)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {emReais(ponto.pedidos ? ponto.faturamento / ponto.pedidos : 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  )
}
