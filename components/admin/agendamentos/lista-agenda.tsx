"use client"

import { format, startOfDay, subDays } from "date-fns"
import { SearchIcon, SearchXIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { useDeferredValue, useState } from "react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
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
import { useAvancarPedido, useCancelarPedido } from "@/lib/admin/dados/consultas"
import type { Pedido, StatusPedido } from "@/lib/admin/dados/tipos"
import { type FiltroAgenda, listaDaAgenda } from "@/lib/admin/regras/agenda"
import { alternarSelecao } from "@/lib/admin/regras/lote-pedidos"
import { emReais, plural } from "@/lib/formato"
import { ALVO_DA_CAIXA, LinhaAnimada } from "../entrega/linha-animada"
import { BlocoEntrando } from "../movimento/entrada-admin"
import { SeloStatus } from "../pedidos/selos"
import { BarraDeLoteAgenda } from "./barra-de-lote-agenda"

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
      <SelectTrigger
        aria-label={rotulo}
        className="w-[calc(50%-0.25rem)] data-[size=default]:max-md:h-11 sm:w-44"
      >
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

type TextosDoLote = { ok: [string, string]; falha: [string, string] }

/** Lista da agenda: pela hora do atendimento, com busca, status, período e ações em lote. */
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
  const [marcados, setMarcados] = useState<ReadonlySet<number>>(new Set())
  const buscaAdiada = useDeferredValue(busca)
  const avancar = useAvancarPedido()
  const cancelar = useCancelarPedido()
  const escolhido = STATUS.find((item) => item.valor === status)?.status
  const lista = listaDaAgenda(pedidos, {
    busca: buscaAdiada,
    ...(escolhido ? { status: escolhido } : {}),
    ...periodo(quando, agora),
  })
  // Só vale o que está na lista visível: o filtro esconde, e o lote não mexe no escondido.
  const selecionados = lista.filter((pedido) => marcados.has(pedido.id))
  const todosMarcados = lista.length > 0 && selecionados.length === lista.length

  /** Um de cada vez, na ordem da lista: se um falhar, os outros seguem e o aviso conta quantos. */
  async function emLote(
    lote: Pedido[],
    acao: (pedido: Pedido) => Promise<unknown>,
    textos: TextosDoLote,
  ) {
    let feitos = 0
    let falhas = 0
    for (const pedido of lote) {
      try {
        await acao(pedido)
        feitos += 1
      } catch {
        falhas += 1
      }
    }
    if (feitos > 0) toast.success(`${plural(feitos, ...textos.ok)}.`)
    if (falhas > 0) toast.error(`${plural(falhas, ...textos.falha)}. Confira e tente de novo.`)
    setMarcados(new Set())
  }
  const avancarLote = (lote: Pedido[]) =>
    emLote(lote, (pedido) => avancar.mutateAsync({ id: pedido.id, de: pedido.status }), {
      ok: ["atendimento avançou", "atendimentos avançaram"],
      falha: ["atendimento não avançou", "atendimentos não avançaram"],
    })
  const cancelarLote = (lote: Pedido[]) =>
    emLote(lote, (pedido) => cancelar.mutateAsync({ id: pedido.id, de: pedido.status }), {
      ok: ["atendimento cancelado", "atendimentos cancelados"],
      falha: ["atendimento não cancelou", "atendimentos não cancelaram"],
    })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full max-md:h-11 sm:max-w-xs">
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
        <Empty className="border border-border/70 py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum atendimento encontrado.</EmptyTitle>
            <EmptyDescription>
              Confira o nome ou o telefone, ou troque o status e o período.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <BlocoEntrando className="flex flex-col">
          <Table aria-label="Atendimentos">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-0">
                  <Checkbox
                    aria-label="Selecionar todos"
                    className={ALVO_DA_CAIXA}
                    checked={
                      todosMarcados ? true : selecionados.length > 0 ? "indeterminate" : false
                    }
                    onCheckedChange={(marcar) =>
                      setMarcados(
                        marcar === true ? new Set(lista.map((item) => item.id)) : new Set(),
                      )
                    }
                  />
                </TableHead>
                <TableHead>Quando</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Serviços</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-0 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            {/* Trocar o filtro troca a lista de uma vez; só o que muda de status sai com fade. */}
            <TableBody key={`${status}|${quando}|${buscaAdiada}`}>
              <AnimatePresence initial={false}>
                {lista.map((pedido) => (
                  <LinhaAnimada
                    key={pedido.id}
                    className="cursor-pointer"
                    data-state={marcados.has(pedido.id) ? "selected" : undefined}
                    onClick={() => aoAbrir(pedido)}
                  >
                    <TableCell className="w-10 pl-0" onClick={(evento) => evento.stopPropagation()}>
                      <Checkbox
                        aria-label={`Selecionar ${pedido.cliente.nome}`}
                        className={ALVO_DA_CAIXA}
                        checked={marcados.has(pedido.id)}
                        onCheckedChange={() =>
                          setMarcados((atual) => alternarSelecao(atual, pedido.id))
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {format(
                        new Date(pedido.agendamento?.inicio ?? pedido.criadoEm),
                        "dd/MM HH:mm",
                      )}
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
                    <TableCell className="pr-0 text-right">{emReais(pedido.total)}</TableCell>
                  </LinhaAnimada>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </BlocoEntrando>
      )}

      <BarraDeLoteAgenda
        selecionados={selecionados}
        aoAvancar={avancarLote}
        aoCancelar={cancelarLote}
        aoLimpar={() => setMarcados(new Set())}
        ocupada={avancar.isPending ? "avancar" : cancelar.isPending ? "cancelar" : null}
      />
    </div>
  )
}
