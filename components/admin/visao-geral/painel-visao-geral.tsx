"use client"

import NumberFlow from "@number-flow/react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ActivityIcon,
  ChevronDownIcon,
  ReceiptTextIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TrophyIcon,
  WalletIcon,
} from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { type ReactNode, useId, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import type { Resumo } from "@/lib/admin/regras/dashboard"
import { diasNoPeriodo, type Periodo } from "@/lib/admin/regras/periodo"
import { rotuloCanal, rotuloPagamento } from "@/lib/admin/regras/rotulos"
import { rotuloStatus } from "@/lib/admin/regras/status"
import type { SegmentoPainelId } from "@/lib/admin/segmentos-painel"
import { emReais, formatoMoeda, plural } from "@/lib/formato"
import type { MedidaDoGrafico } from "./grafico-por-dia"

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
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 })

/** No salão, o pedido é um atendimento. */
function nomes(segmento: SegmentoPainelId) {
  return segmento === "salao"
    ? { Pedidos: "Atendimentos", pedido: "atendimento", pedidos: "atendimentos" }
    : { Pedidos: "Pedidos", pedido: "pedido", pedidos: "pedidos" }
}

/** Número animado para quem vê; o valor formatado para leitores de tela e buscas. */
function Numero({ valor, moeda = false }: { valor: number; moeda?: boolean }) {
  return (
    <>
      <NumberFlow
        value={valor}
        locales="pt-BR"
        format={moeda ? formatoMoeda : { maximumFractionDigits: 1 }}
        aria-hidden="true"
        className="tabular-nums"
      />
      <span className="sr-only">{moeda ? emReais(valor) : inteiro.format(valor)}</span>
    </>
  )
}

function Indicador({
  rotulo,
  icone: Icone,
  children,
  detalhe,
}: {
  rotulo: string
  icone?: typeof WalletIcon
  children: ReactNode
  detalhe?: ReactNode
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription className="flex items-center gap-1.5">
          {Icone && <Icone className="size-3.5" aria-hidden="true" />}
          {rotulo}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-4">
        <span className="text-2xl font-semibold tracking-tight">{children}</span>
        {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
      </CardContent>
    </Card>
  )
}

/** Seção com título que vira região para leitores de tela. */
function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id={id} className="text-base font-semibold tracking-tight">
          {titulo}
        </h2>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </section>
  )
}

/** Cartão com título que também é uma região nomeada. */
function CartaoSecao({
  titulo,
  descricao,
  acao,
  children,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <Card aria-labelledby={id} role="region" className="min-w-0 gap-4">
      <CardHeader>
        <CardTitle id={id}>{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
        {acao && <CardAction>{acao}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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

export function PainelVisaoGeral({
  resumo,
  periodo,
  segmento,
}: {
  resumo: Resumo
  periodo: Periodo
  segmento: SegmentoPainelId
}) {
  const [medida, setMedida] = useState<MedidaDoGrafico>("faturamento")
  const [tabelaAberta, setTabelaAberta] = useState(false)
  const n = nomes(segmento)
  const dias = diasNoPeriodo(periodo)
  const { hoje, periodo: kpi } = resumo
  const anteriores = dias === 1 ? "o dia anterior" : `os ${dias} dias anteriores`
  const Tendencia = (kpi.variacao ?? 0) >= 0 ? TrendingUpIcon : TrendingDownIcon

  return (
    <div className="flex flex-col gap-8">
      <Secao titulo="Hoje" descricao="Ao vivo, desde a abertura">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador rotulo={`${n.Pedidos} hoje`} icone={ReceiptTextIcon}>
            <Numero valor={hoje.pedidos} />
          </Indicador>
          <Indicador
            rotulo="Faturamento hoje"
            icone={WalletIcon}
            detalhe="Sem cancelados e pagamentos pendentes"
          >
            <Numero valor={hoje.faturamento} moeda />
          </Indicador>
          <Indicador rotulo="Ticket médio hoje">
            <Numero valor={hoje.ticket} moeda />
          </Indicador>
          <Indicador
            rotulo="Em andamento"
            icone={ActivityIcon}
            detalhe={
              <Link href="/admin/fila" className="underline-offset-4 hover:underline">
                Ver na fila
              </Link>
            }
          >
            <Numero valor={hoje.emAndamento} />
          </Indicador>
        </div>
        {(hoje.aguardandoPagamento > 0 || hoje.cancelados > 0) && (
          <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
            {hoje.aguardandoPagamento > 0 && (
              <span>{hoje.aguardandoPagamento} aguardando pagamento online</span>
            )}
            {hoje.cancelados > 0 && (
              <span>{plural(hoje.cancelados, "cancelado", "cancelados")} hoje</span>
            )}
          </p>
        )}
      </Secao>

      <Secao titulo="Desempenho do período" descricao={dias === 1 ? "1 dia" : `${dias} dias`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador
            rotulo="Faturamento"
            icone={WalletIcon}
            detalhe={
              kpi.variacao === null ? (
                "Sem vendas no período anterior"
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Tendencia className="size-3.5" aria-hidden="true" />
                  {porcentagem.format(kpi.variacao / 100)} sobre {anteriores}
                </span>
              )
            }
          >
            <Numero valor={kpi.faturamento} moeda />
          </Indicador>
          <Indicador
            rotulo={n.Pedidos}
            icone={ReceiptTextIcon}
            detalhe={`${inteiro.format(kpi.mediaPorDia)} por dia · ${plural(kpi.cancelados, "cancelado", "cancelados")}`}
          >
            <Numero valor={kpi.pedidos} />
          </Indicador>
          <Indicador rotulo="Ticket médio" detalhe={`Por ${n.pedido}`}>
            <Numero valor={kpi.ticket} moeda />
          </Indicador>
          <Indicador
            rotulo="Melhor dia"
            icone={TrophyIcon}
            detalhe={
              kpi.melhorDia
                ? `${emReais(kpi.melhorDia.faturamento)} em ${plural(kpi.melhorDia.pedidos, n.pedido, n.pedidos)}`
                : undefined
            }
          >
            <span className="text-lg">
              {kpi.melhorDia
                ? format(kpi.melhorDia.data, "EEEE, dd/MM", { locale: ptBR })
                : "Sem vendas"}
            </span>
          </Indicador>
        </div>

        <CartaoSecao
          titulo={medida === "faturamento" ? "Faturamento por dia" : `${n.Pedidos} por dia`}
          descricao="Toque num dia para ver os pedidos dele"
          acao={
            <ToggleGroup
              type="single"
              variant="outline"
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
        </CartaoSecao>
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <CartaoSecao titulo="Formas de pagamento" descricao="No período">
          <ListaDeFatias
            vazio="Nenhuma venda no período."
            itens={resumo.pagamentos.map((fatia) => ({
              ...fatia,
              chave: fatia.forma,
              nome: rotuloPagamento(fatia.forma),
            }))}
          />
        </CartaoSecao>
        <CartaoSecao titulo="Canais de venda" descricao="No período">
          <ListaDeFatias
            vazio="Nenhuma venda no período."
            itens={resumo.canais.map((fatia) => ({
              ...fatia,
              chave: fatia.tipo,
              nome: rotuloCanal(fatia.tipo),
            }))}
          />
        </CartaoSecao>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tabs defaultValue="periodo" className="contents">
          <CartaoSecao
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
          </CartaoSecao>
        </Tabs>

        <CartaoSecao
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
                    <Badge variant={pedido.status === "cancelado" ? "outline" : "secondary"}>
                      {rotuloStatus(pedido.tipo, pedido.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CartaoSecao>
      </div>

      <Collapsible open={tabelaAberta} onOpenChange={setTabelaAberta}>
        <Card className="gap-0 py-0">
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between px-6 py-4 text-left text-sm font-medium">
            Dia a dia do período, em tabela
            <ChevronDownIcon
              aria-hidden="true"
              className="size-4 transition-transform duration-300 data-[state=open]:rotate-180"
              data-state={tabelaAberta ? "open" : "closed"}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pb-4">
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
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
