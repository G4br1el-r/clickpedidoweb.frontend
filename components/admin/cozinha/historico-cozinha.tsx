"use client"

import { format, isSameDay, parse, subDays } from "date-fns"
import { CalendarIcon, PrinterIcon, RotateCcwIcon } from "lucide-react"
import { parseAsString, useQueryState } from "nuqs"
import { useState } from "react"
import { ptBR as calendarioPtBR } from "react-day-picker/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import { useAgora } from "@/hooks/use-agora"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import { useLoja, usePedidos } from "@/lib/admin/dados/consultas"
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import {
  type ConfigCozinha,
  type FiltroCozinha,
  TEMPOS_PADRAO,
  type TicketCozinha,
} from "@/lib/admin/regras/cozinha"
import {
  type FimDoTicket,
  historicoDoDia,
  type LinhaDoHistorico,
  linhaDoTempo,
  type SituacaoNoHistorico,
} from "@/lib/admin/regras/historico"
import { NOME_DO_MOTIVO, podeRefazer } from "@/lib/admin/regras/refazer"
import { cn } from "@/lib/utils"
import { nomeDoTicket } from "./ticket-cozinha"

const FILTROS: { valor: FiltroCozinha; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "mesas", rotulo: "Mesas" },
  { valor: "entrega", rotulo: "Entrega" },
  { valor: "retirada", rotulo: "Retirada" },
]

const SITUACOES: { valor: SituacaoNoHistorico; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todas as situações" },
  { valor: "atrasados", rotulo: "Atrasados" },
  { valor: "cancelados", rotulo: "Cancelados" },
  { valor: "refeitos", rotulo: "Refeitos" },
]

export const NOME_DO_FIM: Record<FimDoTicket, string> = {
  "no-quadro": "No quadro",
  pronto: "Pronto",
  servido: "Servido",
  saiu: "Saiu para entrega",
  retirado: "Retirado",
  entregue: "Entregue",
  cancelado: "Cancelado",
}

const FORMATO_DO_DIA = "yyyy-MM-dd"
const hora = (iso: string) => format(new Date(iso), "HH:mm")

/** O resumo dos itens numa linha: "2× Calabresa, 1× Coca". */
const resumoDosItens = (ticket: TicketCozinha) =>
  ticket.itens.map((item) => `${item.quantidade}× ${item.nome}`).join(", ")

function Tempo({ linha }: { linha: LinhaDoHistorico }) {
  if (linha.minutosAtePronto === null) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn("tabular-nums", linha.atrasado && "font-medium text-(--tom-preparo-texto)")}
    >
      {linha.minutosAtePronto} min
      {linha.atrasado && <span className="sr-only">, atrasado</span>}
    </span>
  )
}

function NomeDoTicket({ ticket }: { ticket: TicketCozinha }) {
  return (
    <span className="flex flex-col">
      <span className="font-medium">{nomeDoTicket(ticket)}</span>
      {ticket.refazer && (
        <span className="text-[13px] text-muted-foreground">
          Refazer · {NOME_DO_MOTIVO[ticket.refazer.motivo]}
        </span>
      )}
    </span>
  )
}

function Fim({ linha }: { linha: LinhaDoHistorico }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {NOME_DO_FIM[linha.fim]}
      {linha.refeito && (
        <span className="rounded-md bg-(--atencao)/12 px-1.5 py-0.5 text-xs font-medium">
          Refeito
        </span>
      )}
    </span>
  )
}

/** O detalhe de um ticket: a linha do tempo, os itens, Reimprimir e Refazer. */
function DetalheDoTicket({
  linha,
  agora,
  telaGrande,
  aoFechar,
  aoReimprimir,
  aoRefazer,
}: {
  linha: LinhaDoHistorico
  agora: Date
  telaGrande: boolean
  aoFechar: () => void
  aoReimprimir: (ticket: TicketCozinha) => void
  aoRefazer: (ticket: TicketCozinha) => void
}) {
  const { data: produtos = [] } = useProdutos()
  const { data: loja } = useLoja()
  const { ticket } = linha
  const passos = linhaDoTempo(ticket, { produtos, pracas: loja?.pracas ?? [] })
  const nome = nomeDoTicket(ticket)
  const descricao = `${ticket.pedido.cliente.nome} · ${NOME_DO_FIM[linha.fim]}`

  const corpo = (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <ol aria-label="Linha do tempo" className="flex flex-col gap-2.5">
        {passos.map((passo) => (
          <li key={`${passo.rotulo}-${passo.em}`} className="flex items-baseline gap-3 text-sm">
            <span className="min-w-0 flex-1 font-medium">{passo.rotulo}</span>
            <span className="tabular-nums">{hora(passo.em)}</span>
            {/* A coluna fica mesmo sem minutos (Chegou): as horas ficam alinhadas. */}
            <span className="w-14 text-right text-[13px] text-muted-foreground tabular-nums">
              {passo.minutos !== null ? `${passo.minutos} min` : ""}
            </span>
          </li>
        ))}
      </ol>
      <ul aria-label="Itens" className="flex flex-col gap-1.5 border-t border-border/70 pt-4">
        {ticket.itens.map((item) => (
          <li key={item.id} className="text-sm">
            <span className="font-medium">
              {item.quantidade}× {item.nome}
            </span>
            {item.opcoes.length > 0 && (
              <span className="block text-[13px] text-muted-foreground">
                {item.opcoes.join(" · ")}
              </span>
            )}
            {item.observacao && (
              <span className="block text-[13px] text-muted-foreground">
                Obs.: {item.observacao}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => aoReimprimir(ticket)}>
          <PrinterIcon data-icon="inline-start" />
          Reimprimir via
        </Button>
        {podeRefazer(ticket, agora) && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              aoFechar()
              aoRefazer(ticket)
            }}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Refazer…
          </Button>
        )}
      </div>
    </div>
  )

  return telaGrande ? (
    <Sheet open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{nome}</SheetTitle>
          <SheetDescription>{descricao}</SheetDescription>
        </SheetHeader>
        {corpo}
      </SheetContent>
    </Sheet>
  ) : (
    <Drawer open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{nome}</DrawerTitle>
          <DrawerDescription>{descricao}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto">{corpo}</div>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * Histórico da cozinha: cada rodada do dia escolhido, com busca, filtros e o detalhe com a
 * linha do tempo. Hoje por padrão; o dia fica no endereço.
 */
export function HistoricoCozinha({
  aoReimprimir,
  aoRefazer,
}: {
  aoReimprimir: (ticket: TicketCozinha) => void
  aoRefazer: (ticket: TicketCozinha) => void
}) {
  const agora = useAgora(30_000)
  const telaGrande = useTelaGrande()
  const [diaNoEndereco, setDiaNoEndereco] = useQueryState("dia", parseAsString)
  const [busca, setBusca] = useState("")
  const [filtro, setFiltro] = useState<FiltroCozinha>("todos")
  const [situacao, setSituacao] = useState<SituacaoNoHistorico>("todos")
  const [aberto, setAberto] = useState<string | null>(null)
  const [calendarioAberto, setCalendarioAberto] = useState(false)
  const { data: loja } = useLoja()
  const tempos: ConfigCozinha = { ...(loja?.temposCozinha ?? TEMPOS_PADRAO) }

  const hoje = agora ?? new Date()
  const lido = diaNoEndereco ? parse(diaNoEndereco, FORMATO_DO_DIA, hoje) : hoje
  const dia = Number.isNaN(lido.getTime()) ? hoje : lido
  const mudarDia = (novo: Date) =>
    void setDiaNoEndereco(isSameDay(novo, hoje) ? null : format(novo, FORMATO_DO_DIA))
  // A rodada da mesa aberta na véspera chega no dia: a consulta pega o dia anterior junto.
  // Sem a hora do aparelho (no servidor), não há "hoje": nada de data na tela ainda.
  const { data: pedidos } = usePedidos({ de: subDays(dia, 1), ate: dia }, { ativo: Boolean(agora) })
  const linhas =
    pedidos && agora
      ? historicoDoDia(pedidos, dia, { agora, tempos, filtro, situacao, busca })
      : null
  const linhaAberta = linhas?.find((linha) => linha.ticket.id === aberto)
  const ehHoje = isSameDay(dia, hoje)
  const ehOntem = isSameDay(dia, subDays(hoje, 1))

  if (!agora) {
    return (
      <div role="status" aria-label="Carregando o histórico" className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((indice) => (
          <Skeleton key={indice} className="h-12 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-border/70 py-3">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={ehHoje ? "secondary" : "outline"}
            aria-pressed={ehHoje}
            onClick={() => mudarDia(hoje)}
          >
            Hoje
          </Button>
          <Button
            type="button"
            size="sm"
            variant={ehOntem ? "secondary" : "outline"}
            aria-pressed={ehOntem}
            onClick={() => mudarDia(subDays(hoje, 1))}
          >
            Ontem
          </Button>
          <Popover open={calendarioAberto} onOpenChange={setCalendarioAberto}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Escolher dia, ${format(dia, "dd/MM/yyyy")}`}
              >
                <CalendarIcon data-icon="inline-start" />
                {format(dia, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                locale={calendarioPtBR}
                selected={dia}
                defaultMonth={dia}
                disabled={{ after: hoje, before: subDays(hoje, 89) }}
                onSelect={(escolhido) => {
                  if (!escolhido) return
                  mudarDia(escolhido)
                  setCalendarioAberto(false)
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <Input
          type="search"
          aria-label="Buscar no histórico"
          placeholder="Número, mesa ou cliente"
          className="h-8 w-full sm:w-56"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
        />
        <ToggleGroup
          type="single"
          variant="segmento"
          size="sm"
          aria-label="Tipo"
          value={filtro}
          onValueChange={(valor) => valor && setFiltro(valor as FiltroCozinha)}
        >
          {FILTROS.map(({ valor, rotulo }) => (
            <ToggleGroupItem key={valor} value={valor}>
              {rotulo}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select
          value={situacao}
          onValueChange={(valor) => setSituacao(valor as SituacaoNoHistorico)}
        >
          <SelectTrigger size="sm" aria-label="Situação" className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SITUACOES.map(({ valor, rotulo }) => (
                <SelectItem key={valor} value={valor}>
                  {rotulo}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {!linhas ? (
        <div role="status" aria-label="Carregando o histórico" className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((indice) => (
            <Skeleton key={indice} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Nenhum ticket</EmptyTitle>
            <EmptyDescription>
              {busca || filtro !== "todos" || situacao !== "todos"
                ? "Nada com essa busca e esses filtros neste dia."
                : "Nenhuma rodada passou pela cozinha neste dia."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : telaGrande ? (
        <Table aria-label="Histórico">
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Chegada</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead className="w-24">Até pronto</TableHead>
              <TableHead className="w-44">Como terminou</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => (
              <TableRow key={linha.ticket.id}>
                <TableCell className="tabular-nums">{hora(linha.ticket.chegouEm)}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() => setAberto(linha.ticket.id)}
                  >
                    <NomeDoTicket ticket={linha.ticket} />
                  </button>
                </TableCell>
                <TableCell className="max-w-80 truncate text-muted-foreground">
                  {resumoDosItens(linha.ticket)}
                </TableCell>
                <TableCell>
                  <Tempo linha={linha} />
                </TableCell>
                <TableCell>
                  <Fim linha={linha} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <ul aria-label="Histórico" className="flex flex-col gap-2">
          {linhas.map((linha) => (
            <li key={linha.ticket.id}>
              <button
                type="button"
                className="flex w-full flex-col gap-1 rounded-xl bg-card p-3 text-left text-sm ring-1 ring-border/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => setAberto(linha.ticket.id)}
              >
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-muted-foreground">
                    {hora(linha.ticket.chegouEm)}
                  </span>
                  <NomeDoTicket ticket={linha.ticket} />
                  <span className="ml-auto">
                    <Tempo linha={linha} />
                  </span>
                </span>
                <span className="truncate text-[13px] text-muted-foreground">
                  {resumoDosItens(linha.ticket)}
                </span>
                <Fim linha={linha} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {linhaAberta && agora && (
        <DetalheDoTicket
          linha={linhaAberta}
          agora={agora}
          telaGrande={telaGrande}
          aoFechar={() => setAberto(null)}
          aoReimprimir={aoReimprimir}
          aoRefazer={aoRefazer}
        />
      )}
    </div>
  )
}
