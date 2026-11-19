"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronDownIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { type ReactNode, useId, useState } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Alerta } from "@/lib/admin/regras/dashboard/alertas"
import type { SituacaoMeta } from "@/lib/admin/regras/dashboard/metas"
import { nomesDo } from "@/lib/admin/regras/dashboard/nomes"
import type { Resumo } from "@/lib/admin/regras/dashboard/resumo"
import type { Destaque } from "@/lib/admin/regras/dashboard/segmento"
import {
  type ComparacaoHoje,
  textosDaSemanaPassada,
} from "@/lib/admin/regras/dashboard/semana-passada"
import { diasNoPeriodo, type Periodo } from "@/lib/admin/regras/periodo"
import { rotuloCanal, rotuloPagamento } from "@/lib/admin/regras/rotulos"
import type { SegmentoPainelId } from "@/lib/admin/segmentos-painel"
import { emReais, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { BlocoSecao } from "../bloco-secao"
import { SeloStatus } from "../pedidos/selos"
import { AoVivo, Indicador, Regua } from "../regua"
import { BlocoMeta } from "./bloco-meta"
import { FaixaAtencao } from "./faixa-atencao"
import type { MedidaDoGrafico } from "./grafico-por-dia"
import { inteiro, Numero } from "./numero"

// Recharts pesa: o gráfico chega depois, só no navegador, com o esqueleto no lugar.
const GraficoPorDia = dynamic(() => import("./grafico-por-dia"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
})

const porcentagem = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})

/** Seção com título que vira região para leitores de tela. */
function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em]">
          {titulo}
        </h2>
        {descricao && <p className="text-[13px] text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </section>
  )
}

function ListaDeFatias({
  itens,
  vazio,
}: {
  itens: { chave: string; nome: string; pedidos: number; total: number; percentual: number }[]
  vazio: string
}) {
  if (itens.length === 0) return <p className="text-sm text-muted-foreground">{vazio}</p>
  return (
    <ul className="barras-do-grafico flex flex-col gap-3">
      {itens.map((item) => (
        <li key={item.chave} className="flex flex-col gap-1.5">
          <div className="flex items-start gap-3 text-sm">
            {/* No celular, a contagem desce para baixo do nome. */}
            <span className="flex min-w-0 flex-1 flex-col gap-x-2 sm:flex-row sm:items-baseline">
              <span className="truncate font-medium">{item.nome}</span>
              <span className="text-xs text-muted-foreground sm:text-sm">
                {plural(item.pedidos, "pedido", "pedidos")}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{emReais(item.total)}</span>
            <span className="w-9 shrink-0 text-right text-muted-foreground tabular-nums">
              {Math.round(item.percentual)}%
            </span>
          </div>
          <Progress
            className="h-1.5"
            value={item.percentual}
            aria-label={`${item.nome}: ${Math.round(item.percentual)}%`}
          />
        </li>
      ))}
    </ul>
  )
}

function ListaMaisVendidos({ produtos }: { produtos: Resumo["maisVendidos"]["periodo"] }) {
  if (produtos.length === 0)
    return <p className="text-sm text-muted-foreground">Nenhuma venda ainda.</p>
  const maior = produtos[0].quantidade
  return (
    <ul className="barras-do-grafico flex flex-col gap-3">
      {produtos.map((produto, posicao) => (
        <li key={produto.nome} className="flex items-center gap-3 text-sm">
          <span className="w-4 text-right text-muted-foreground tabular-nums">{posicao + 1}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate font-medium">{produto.nome}</span>
              <span className="shrink-0 text-muted-foreground">
                {plural(produto.quantidade, "vendido", "vendidos")}
              </span>
              <span className="ml-auto shrink-0 tabular-nums">{emReais(produto.total)}</span>
            </div>
            <Progress
              value={(produto.quantidade / maior) * 100}
              aria-hidden="true"
              className="h-1"
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Variação em %, verde para cima e vermelha para baixo, com a seta e o "sobre o quê". */
function Variacao({ valor, texto }: { valor: number; texto: string }) {
  const Seta = valor >= 0 ? TrendingUpIcon : TrendingDownIcon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        valor >= 0 ? "text-(--tom-pronto)" : "text-(--tom-cancelado)",
      )}
    >
      <Seta className="size-3.5" aria-hidden="true" />
      {porcentagem.format(valor / 100)} {texto}
    </span>
  )
}

/** Resumo: o dia de hoje e o essencial do período. */
export function AbaResumo({
  resumo,
  periodo,
  segmento,
  comparacao,
  alertas = [],
  meta = null,
  destaques = [],
}: {
  resumo: Resumo
  periodo: Periodo
  segmento: SegmentoPainelId
  /** Hoje contra o mesmo dia da semana passada, até a mesma hora. */
  comparacao?: ComparacaoHoje
  /** O que precisa de atenção agora; vazio esconde a faixa. */
  alertas?: Alerta[]
  /** Situação da meta do mês; `null` quando a loja ainda não definiu. */
  meta?: SituacaoMeta | null
  /** Os números próprios do segmento: agenda, receitas, pesagem, mesas. */
  destaques?: Destaque[]
}) {
  const [medida, setMedida] = useState<MedidaDoGrafico>("faturamento")
  const n = nomesDo(segmento)
  const textos = comparacao && textosDaSemanaPassada(comparacao.dia)
  const comparar = (escolher: (variacao: NonNullable<ComparacaoHoje["variacao"]>) => number) =>
    comparacao && textos ? (
      comparacao.variacao ? (
        <Variacao valor={escolher(comparacao.variacao)} texto={textos.comparacao} />
      ) : (
        textos.semBase
      )
    ) : undefined
  const dias = diasNoPeriodo(periodo)
  const { hoje, periodo: kpi } = resumo
  const anteriores = dias === 1 ? "o dia anterior" : `os ${dias} dias anteriores`

  return (
    <div className="flex flex-col gap-10">
      <FaixaAtencao alertas={alertas} />
      <Secao titulo="Hoje" descricao={<AoVivo>Ao vivo, desde a abertura</AoVivo>}>
        <Regua>
          <Indicador
            rotulo={`${n.Pedidos} hoje`}
            detalhe={comparar((variacao) => variacao.pedidos)}
          >
            <Numero valor={hoje.pedidos} />
          </Indicador>
          <Indicador
            rotulo="Faturamento hoje"
            detalhe={comparar((variacao) => variacao.faturamento)}
          >
            <Numero valor={hoje.faturamento} moeda />
          </Indicador>
          <Indicador rotulo="Ticket médio hoje" detalhe={comparar((variacao) => variacao.ticket)}>
            <Numero valor={hoje.ticket} moeda />
          </Indicador>
          <Indicador
            rotulo="Em andamento"
            detalhe={
              <Link href="/admin/fila" className="underline-offset-4 hover:underline">
                Ver na fila
              </Link>
            }
          >
            <Numero valor={hoje.emAndamento} />
          </Indicador>
        </Regua>
        <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          <span>Faturamento sem cancelados e pagamentos pendentes</span>
          {hoje.aguardandoPagamento > 0 && (
            <span>{hoje.aguardandoPagamento} aguardando pagamento online</span>
          )}
          {hoje.cancelados > 0 && (
            <span>{plural(hoje.cancelados, "cancelado", "cancelados")} hoje</span>
          )}
        </p>
      </Secao>

      <BlocoMeta segmento={segmento} situacao={meta} />

      {destaques.length > 0 && (
        <Secao titulo="Agora na loja">
          <Regua>
            {destaques.map((destaque) => (
              <Indicador
                key={destaque.id}
                rotulo={destaque.rotulo}
                detalhe={
                  <Link href={destaque.href} className="underline-offset-4 hover:underline">
                    {destaque.detalhe ?? "Ver"}
                  </Link>
                }
              >
                <Numero valor={destaque.valor} />
              </Indicador>
            ))}
          </Regua>
        </Secao>
      )}

      <Secao titulo="Desempenho do período" descricao={dias === 1 ? "1 dia" : `${dias} dias`}>
        <Regua>
          <Indicador
            rotulo="Faturamento"
            detalhe={
              kpi.variacao === null ? (
                "Sem vendas no período anterior"
              ) : (
                <Variacao valor={kpi.variacao} texto={`sobre ${anteriores}`} />
              )
            }
          >
            <Numero valor={kpi.faturamento} moeda />
          </Indicador>
          <Indicador
            rotulo={n.Pedidos}
            detalhe={`${inteiro.format(kpi.mediaPorDia)} por dia · ${plural(kpi.cancelados, "cancelado", "cancelados")}`}
          >
            <Numero valor={kpi.pedidos} />
          </Indicador>
          <Indicador rotulo="Ticket médio" detalhe={`Por ${n.pedido}`}>
            <Numero valor={kpi.ticket} moeda />
          </Indicador>
          <Indicador
            rotulo="Melhor dia"
            detalhe={
              kpi.melhorDia
                ? `${emReais(kpi.melhorDia.faturamento)} em ${plural(kpi.melhorDia.pedidos, n.pedido, n.pedidos)}`
                : undefined
            }
          >
            <span className="text-xl first-letter:uppercase">
              {kpi.melhorDia
                ? format(kpi.melhorDia.data, "EEEE, dd/MM", { locale: ptBR })
                : "Sem vendas"}
            </span>
          </Indicador>
        </Regua>

        <BlocoSecao
          titulo={medida === "faturamento" ? "Faturamento por dia" : `${n.Pedidos} por dia`}
          descricao="Toque num dia para ver os pedidos dele"
          acao={
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
          }
        >
          <GraficoPorDia serie={resumo.serie} medida={medida} />
        </BlocoSecao>
      </Secao>

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <Tabs defaultValue="periodo" className="contents">
          <BlocoSecao
            titulo="Mais vendidos"
            acao={
              <TabsList>
                <TabsTrigger value="periodo">No período</TabsTrigger>
                <TabsTrigger value="hoje">Hoje</TabsTrigger>
              </TabsList>
            }
          >
            <TabsContent value="periodo">
              <ListaMaisVendidos produtos={resumo.maisVendidos.periodo} />
            </TabsContent>
            <TabsContent value="hoje">
              <ListaMaisVendidos produtos={resumo.maisVendidos.hoje} />
            </TabsContent>
          </BlocoSecao>
        </Tabs>

        <BlocoSecao
          titulo={`${n.Pedidos} recentes`}
          acao={
            <Link href="/admin/pedidos" className="text-sm underline-offset-4 hover:underline">
              Ver todos
            </Link>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead className="hidden sm:table-cell">Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="hidden sm:table-cell">Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumo.recentes.map((pedido) => (
                <TableRow key={pedido.id}>
                  <TableCell className="font-medium tabular-nums">#{pedido.numero}</TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {format(new Date(pedido.criadoEm), "dd/MM HH:mm")}
                  </TableCell>
                  <TableCell className="max-w-28 truncate sm:max-w-40">
                    {pedido.cliente.nome}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{emReais(pedido.total)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <SeloStatus pedido={pedido} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </BlocoSecao>
      </div>
    </div>
  )
}

/** Vendas: por onde o dinheiro entra e o dia a dia do período. Cresce na etapa 2. */
export function AbaVendas({ resumo, segmento }: { resumo: Resumo; segmento: SegmentoPainelId }) {
  const [tabelaAberta, setTabelaAberta] = useState(false)
  const n = nomesDo(segmento)
  return (
    <div className="flex flex-col gap-10">
      <BlocoSecao titulo="Canais de venda" descricao="No período">
        <ListaDeFatias
          vazio="Nenhuma venda no período."
          itens={resumo.canais.map((fatia) => ({
            ...fatia,
            chave: fatia.tipo,
            nome: rotuloCanal(fatia.tipo),
          }))}
        />
      </BlocoSecao>

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead className="text-right">{n.Pedidos}</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Ticket médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumo.serie.toReversed().map((dia) => (
                    <TableRow key={dia.data.toISOString()}>
                      <TableCell className="capitalize">
                        {format(dia.data, "EEE, dd/MM", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{dia.pedidos}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {emReais(dia.faturamento)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {emReais(dia.pedidos ? dia.faturamento / dia.pedidos : 0)}
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

/** Financeiro: como a loja recebe. Cresce na etapa 4. */
export function AbaFinanceiro({ resumo }: { resumo: Resumo }) {
  return (
    <div className="flex flex-col gap-10">
      <BlocoSecao titulo="Formas de pagamento" descricao="No período">
        <ListaDeFatias
          vazio="Nenhuma venda no período."
          itens={resumo.pagamentos.map((fatia) => ({
            ...fatia,
            chave: fatia.forma,
            nome: rotuloPagamento(fatia.forma),
          }))}
        />
      </BlocoSecao>
    </div>
  )
}
