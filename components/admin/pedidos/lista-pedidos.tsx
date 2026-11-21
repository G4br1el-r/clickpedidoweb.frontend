"use client"

import {
  type ColumnDef,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  type PaginationState,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  sortFn_basic,
  tableFeatures,
  type Updater,
  useTable,
} from "@tanstack/react-table"
import { format } from "date-fns"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  SearchIcon,
  SearchXIcon,
  XIcon,
} from "lucide-react"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { contarPor, filtrarPedidos, totaisDaLista } from "@/lib/admin/regras/filtro-pedidos"
import { formatarTelefone } from "@/lib/admin/regras/mensagens"
import {
  rotuloCanal,
  rotuloMotivo,
  rotuloOrigem,
  rotuloPagamento,
} from "@/lib/admin/regras/rotulos"
import { rotuloStatusComum } from "@/lib/admin/regras/status"
import { emReais, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { type ColunaOrdenavel, useEstadoLista, usePedidoAberto } from "./estado-lista"
import { FiltroFacetado, type OpcaoFacetada } from "./filtro-facetado"
import { rotuloSituacao, SeloStatus } from "./selos"

const POR_PAGINA = 20
const quando = (pedido: Pedido) => format(new Date(pedido.criadoEm), "dd/MM HH:mm")

/** Ordenação e paginação no navegador: só os recursos usados entram no pacote. */
const recursos = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { basic: sortFn_basic },
})

/** Classes de cada coluna: as secundárias somem em telas menores, sem rolagem lateral. */
type Meta = { classe?: string; rotuloOrdem?: string }

const COLUNAS: ColumnDef<typeof recursos, Pedido>[] = [
  {
    id: "numero",
    header: "Nº",
    accessorFn: (pedido) => pedido.numero,
    sortFn: "basic",
    meta: { classe: "w-16", rotuloOrdem: "número" } satisfies Meta,
  },
  {
    id: "criadoEm",
    header: "Data",
    // Número: a primeira ordem é do mais novo para o mais antigo.
    accessorFn: (pedido) => Date.parse(pedido.criadoEm),
    sortFn: "basic",
    cell: ({ row }) => <span className="tabular-nums">{quando(row.original)}</span>,
    meta: { classe: "hidden md:table-cell", rotuloOrdem: "data" } satisfies Meta,
  },
  {
    id: "cliente",
    header: "Cliente",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{row.original.cliente.nome}</span>
        <span className="hidden text-xs text-muted-foreground tabular-nums md:inline">
          {formatarTelefone(row.original.cliente.telefone)}
        </span>
        {/* No celular, data e status vêm aqui, no lugar das colunas que somem. */}
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground md:hidden">
          <span className="tabular-nums">{quando(row.original)}</span>
          <SeloStatus pedido={row.original} />
        </span>
      </div>
    ),
    meta: { classe: "max-w-44" } satisfies Meta,
  },
  {
    id: "canal",
    header: "Canal",
    enableSorting: false,
    cell: ({ row }) => rotuloCanal(row.original.tipo),
    meta: { classe: "hidden lg:table-cell" } satisfies Meta,
  },
  {
    id: "itens",
    header: "Itens",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="line-clamp-1 text-muted-foreground">
        {row.original.itens.map((item) => `${item.quantidade}× ${item.nome}`).join(", ")}
      </span>
    ),
    meta: { classe: "hidden max-w-56 xl:table-cell" } satisfies Meta,
  },
  {
    id: "total",
    header: "Total",
    accessorFn: (pedido) => pedido.total,
    sortFn: "basic",
    cell: ({ row }) => <span className="tabular-nums">{emReais(row.original.total)}</span>,
    meta: { classe: "text-right", rotuloOrdem: "total" } satisfies Meta,
  },
  {
    id: "pagamento",
    header: "Pagamento",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span>{rotuloPagamento(row.original.pagamento)}</span>
        <span className="text-xs text-muted-foreground">
          {rotuloSituacao(row.original.situacaoPagamento)}
        </span>
      </div>
    ),
    meta: { classe: "hidden lg:table-cell" } satisfies Meta,
  },
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => <SeloStatus pedido={row.original} />,
    meta: { classe: "hidden md:table-cell" } satisfies Meta,
  },
]

function opcoesDe<K extends "status" | "tipo" | "pagamento">(
  pedidos: Pedido[],
  campo: K,
  rotulo: (valor: Pedido[K]) => string,
): OpcaoFacetada[] {
  return [...contarPor(pedidos, campo)].map(([valor, quantidade]) => ({
    valor: String(valor),
    rotulo: rotulo(valor),
    quantidade,
  }))
}

/** Tabela de pedidos com busca, filtros com contagem, ordenação e paginação, tudo no endereço. */
export function ListaPedidos({ pedidos }: { pedidos: Pedido[] }) {
  const [estado, setEstado] = useEstadoLista()
  const [, abrirPedido] = usePedidoAberto()

  const filtrados = useMemo(
    () =>
      filtrarPedidos(pedidos, {
        busca: estado.busca,
        status: estado.status,
        tipos: estado.canal,
        pagamentos: estado.pagamento,
        origens: estado.origem,
        clientes: estado.cliente,
        motivos: estado.motivo,
      }),
    [
      pedidos,
      estado.busca,
      estado.status,
      estado.canal,
      estado.pagamento,
      estado.origem,
      estado.cliente,
      estado.motivo,
    ],
  )
  const totais = totaisDaLista(filtrados)
  const temFiltro =
    estado.busca !== "" ||
    estado.status.length +
      estado.canal.length +
      estado.pagamento.length +
      estado.origem.length +
      estado.cliente.length +
      estado.motivo.length >
      0
  // Filtros que só chegam pelo endereço (das abas da visão geral): uma etiqueta para tirar cada um.
  const etiquetas = [
    ...estado.origem.map((origem) => ({
      chave: `origem:${origem}`,
      texto: `Origem: ${rotuloOrigem(origem)}`,
      tirar: () => ({ origem: estado.origem.filter((outra) => outra !== origem) }),
    })),
    ...estado.cliente.map((telefone) => ({
      chave: `cliente:${telefone}`,
      texto: `Cliente: ${formatarTelefone(telefone)}`,
      tirar: () => ({ cliente: estado.cliente.filter((outro) => outro !== telefone) }),
    })),
    ...estado.motivo.map((motivo) => ({
      chave: `motivo:${motivo}`,
      texto: `Motivo: ${rotuloMotivo(motivo === "nao-informado" ? undefined : motivo)}`,
      tirar: () => ({ motivo: estado.motivo.filter((outro) => outro !== motivo) }),
    })),
  ]

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const ordenacao: SortingState = [{ id: estado.ordem, desc: estado.crescente !== "sim" }]
  const tabela = useTable({
    features: recursos,
    data: filtrados,
    columns: COLUNAS,
    getRowId: (pedido) => String(pedido.id),
    state: {
      sorting: ordenacao,
      pagination: { pageIndex: estado.pagina - 1, pageSize: POR_PAGINA },
    },
    enableSortingRemoval: false,
    // A página volta para a 1 quando os filtros mudam (no endereço), não a cada renderização.
    autoResetPageIndex: false,
    onSortingChange: (atualizar: Updater<SortingState>) => {
      const [nova] = typeof atualizar === "function" ? atualizar(ordenacao) : atualizar
      void setEstado({
        ordem: (nova?.id as ColunaOrdenavel) ?? "criadoEm",
        crescente: nova && !nova.desc ? "sim" : null,
        pagina: 1,
      })
    },
    onPaginationChange: (atualizar: Updater<PaginationState>) => {
      const atual = { pageIndex: estado.pagina - 1, pageSize: POR_PAGINA }
      const nova = typeof atualizar === "function" ? atualizar(atual) : atualizar
      void setEstado({ pagina: nova.pageIndex + 1 })
    },
  })

  const limpar = () =>
    setEstado({
      busca: null,
      status: null,
      canal: null,
      pagamento: null,
      origem: null,
      cliente: null,
      motivo: null,
      pagina: null,
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <InputGroup className="lg:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Buscar pedido"
            placeholder="Nº, cliente, telefone ou item"
            value={estado.busca}
            onChange={(evento) => setEstado({ busca: evento.target.value || null, pagina: null })}
          />
        </InputGroup>
        <div className="flex flex-wrap items-center gap-2">
          <FiltroFacetado
            titulo="Status"
            opcoes={opcoesDe(pedidos, "status", rotuloStatusComum)}
            selecionados={estado.status}
            aoMudar={(valores) =>
              setEstado({ status: valores as typeof estado.status, pagina: null })
            }
          />
          <FiltroFacetado
            titulo="Canal"
            opcoes={opcoesDe(pedidos, "tipo", rotuloCanal)}
            selecionados={estado.canal}
            aoMudar={(valores) =>
              setEstado({ canal: valores as typeof estado.canal, pagina: null })
            }
          />
          <FiltroFacetado
            titulo="Pagamento"
            opcoes={opcoesDe(pedidos, "pagamento", rotuloPagamento)}
            selecionados={estado.pagamento}
            aoMudar={(valores) =>
              setEstado({ pagamento: valores as typeof estado.pagamento, pagina: null })
            }
          />
          {etiquetas.map((etiqueta) => (
            <Button
              key={etiqueta.chave}
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Tirar o filtro ${etiqueta.texto}`}
              onClick={() => setEstado({ ...etiqueta.tirar(), pagina: null })}
            >
              {etiqueta.texto}
              <XIcon data-icon="inline-end" />
            </Button>
          ))}
          {temFiltro && (
            <Button type="button" variant="ghost" size="sm" onClick={limpar}>
              <XIcon data-icon="inline-start" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {plural(totais.pedidos, "pedido", "pedidos")} · {emReais(totais.faturamento)} em vendas
        válidas
      </p>

      {filtrados.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum pedido com esses filtros</EmptyTitle>
            <EmptyDescription>Mude a busca, os filtros ou o período.</EmptyDescription>
          </EmptyHeader>
          {temFiltro && (
            <EmptyContent>
              <Button type="button" size="sm" onClick={limpar}>
                Limpar filtros
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="border-t border-border/70">
          <Table>
            <TableHeader>
              {tabela.getHeaderGroups().map((grupo) => (
                <TableRow key={grupo.id}>
                  {grupo.headers.map((cabecalho) => {
                    const meta = cabecalho.column.columnDef.meta as Meta | undefined
                    const ordem = cabecalho.column.getIsSorted()
                    const Seta =
                      ordem === "asc"
                        ? ArrowUpIcon
                        : ordem === "desc"
                          ? ArrowDownIcon
                          : ChevronsUpDownIcon
                    return (
                      <TableHead
                        key={cabecalho.id}
                        className={meta?.classe}
                        aria-sort={
                          ordem === "asc"
                            ? "ascending"
                            : ordem === "desc"
                              ? "descending"
                              : undefined
                        }
                      >
                        {cabecalho.column.getCanSort() ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "-mx-2 h-8",
                              meta?.classe?.includes("text-right") && "ml-auto flex",
                            )}
                            aria-label={`Ordenar por ${meta?.rotuloOrdem}`}
                            onClick={cabecalho.column.getToggleSortingHandler()}
                          >
                            <FlexRender header={cabecalho} />
                            <Seta
                              data-icon="inline-end"
                              className={ordem ? undefined : "opacity-40"}
                            />
                          </Button>
                        ) : (
                          <FlexRender header={cabecalho} />
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {tabela.getRowModel().rows.map((linha) => (
                <TableRow
                  key={linha.id}
                  className="cursor-pointer"
                  onClick={() => abrirPedido(linha.original.id)}
                >
                  {linha.getAllCells().map((celula) => {
                    const meta = celula.column.columnDef.meta as Meta | undefined
                    return (
                      <TableCell key={celula.id} className={meta?.classe}>
                        {celula.column.id === "numero" ? (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 font-semibold text-foreground tabular-nums"
                            aria-label={`Abrir o pedido #${linha.original.numero}`}
                            onClick={(evento) => {
                              evento.stopPropagation()
                              abrirPedido(linha.original.id)
                            }}
                          >
                            #{linha.original.numero}
                          </Button>
                        ) : (
                          <FlexRender cell={celula} />
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {paginas > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            Página {estado.pagina} de {paginas}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Página anterior"
            disabled={estado.pagina <= 1}
            onClick={() => setEstado({ pagina: estado.pagina - 1 })}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Próxima página"
            disabled={estado.pagina >= paginas}
            onClick={() => setEstado({ pagina: estado.pagina + 1 })}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  )
}
