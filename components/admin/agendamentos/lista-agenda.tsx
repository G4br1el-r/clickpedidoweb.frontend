"use client"

import { format, startOfDay, subDays } from "date-fns"
import { SearchIcon } from "lucide-react"
import { useDeferredValue, useState } from "react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Pedido, StatusPedido } from "@/lib/admin/dados/tipos"
import { type FiltroAgenda, listaDaAgenda } from "@/lib/admin/regras/agenda"
import { emReais } from "@/lib/formato"
import { SeloStatus } from "../pedidos/selos"

const STATUS: { valor: string; rotulo: string; status?: StatusPedido[] }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "marcados", rotulo: "Marcados", status: ["recebido"] },
  { valor: "atendimento", rotulo: "Em atendimento", status: ["em-preparo"] },
  { valor: "concluidos", rotulo: "Concluídos", status: ["concluido"] },
  { valor: "cancelados", rotulo: "Cancelados", status: ["cancelado"] },
]

const PERIODOS = [
  { valor: "proximos", rotulo: "De hoje em diante" },
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "30d", rotulo: "Últimos 30 dias" },
  { valor: "todos", rotulo: "Todo o período" },
] as const

function periodo(valor: (typeof PERIODOS)[number]["valor"], agora: Date): FiltroAgenda {
  const hoje = startOfDay(agora)
  if (valor === "proximos") return { de: hoje }
  if (valor === "hoje") return { de: hoje, ate: hoje }
  if (valor === "30d") return { de: subDays(hoje, 30), ate: hoje }
  return {}
}

function Filtro<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string
  valor: T
  opcoes: readonly { valor: T; rotulo: string }[]
  aoMudar: (valor: T) => void
}) {
  return (
    <Select value={valor} onValueChange={(novo) => aoMudar(novo as T)}>
      <SelectTrigger size="sm" aria-label={rotulo} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {opcoes.map((opcao) => (
            <SelectItem key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

/** Lista da agenda: pela hora do atendimento, com busca, status e período. */
export function ListaAgenda({
  pedidos,
  agora,
  aoAbrir,
}: {
  pedidos: Pedido[]
  agora: Date
  aoAbrir: (pedido: Pedido) => void
}) {
  const [busca, setBusca] = useState("")
  const [status, setStatus] = useState("todos")
  const [quando, setQuando] = useState<(typeof PERIODOS)[number]["valor"]>("proximos")
  const buscaAdiada = useDeferredValue(busca)
  const escolhido = STATUS.find((item) => item.valor === status)?.status
  const lista = listaDaAgenda(pedidos, {
    busca: buscaAdiada,
    ...(escolhido ? { status: escolhido } : {}),
    ...periodo(quando, agora),
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Buscar na agenda"
            placeholder="Cliente, telefone ou serviço"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </InputGroup>
        <Filtro rotulo="Status" valor={status} opcoes={STATUS} aoMudar={setStatus} />
        <Filtro rotulo="Período" valor={quando} opcoes={PERIODOS} aoMudar={setQuando} />
      </div>

      {lista.length === 0 ? (
        <p className="rounded-xl border py-10 text-center text-sm text-muted-foreground">
          Nenhum atendimento encontrado.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Serviços</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((pedido) => (
                <TableRow
                  key={pedido.id}
                  className="cursor-pointer"
                  onClick={() => aoAbrir(pedido)}
                >
                  <TableCell className="tabular-nums">
                    {format(new Date(pedido.agendamento?.inicio ?? pedido.criadoEm), "dd/MM HH:mm")}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                      onClick={(evento) => {
                        evento.stopPropagation()
                        aoAbrir(pedido)
                      }}
                    >
                      {pedido.cliente.nome}
                    </button>
                  </TableCell>
                  <TableCell className="hidden max-w-64 truncate md:table-cell">
                    {pedido.itens.map((item) => item.nome).join(", ")}
                  </TableCell>
                  <TableCell>
                    <SeloStatus pedido={pedido} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{emReais(pedido.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
