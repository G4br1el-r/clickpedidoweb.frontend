"use client"

import {
  type ColumnDef,
  createSortedRowModel,
  FlexRender,
  rowSortingFeature,
  type SortingState,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BoxesIcon,
  ChevronsUpDownIcon,
  ClipboardCheckIcon,
  HistoryIcon,
  type LucideIcon,
  MinusCircleIcon,
  MoreHorizontalIcon,
  PackageXIcon,
  PlusCircleIcon,
  SearchIcon,
  SearchXIcon,
  Settings2Icon,
  TrendingDownIcon,
  WalletIcon,
} from "lucide-react"
import { type ReactNode, useDeferredValue, useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCategorias, useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import type { Produto } from "@/lib/admin/dados/tipos"
import {
  emQuantidade,
  resumoDoEstoque,
  type SituacaoEstoque,
  situacaoEstoque,
} from "@/lib/admin/regras/estoque"
import { emReais, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import {
  type AcaoEstoque,
  HistoricoEstoque,
  JanelaConfigurar,
  JanelaContagem,
  JanelaEntrada,
  JanelaSaida,
} from "./janelas-estoque"

type Situacao = SituacaoEstoque | "sem-controle"
type FiltroSituacao = "controlados" | Situacao

const situacaoDe = (produto: Produto): Situacao =>
  produto.estoque?.controlar ? situacaoEstoque(produto.estoque) : "sem-controle"

/** Ordem da lista quando ninguém escolheu: o que pede atenção primeiro. */
const URGENCIA: Record<Situacao, number> = {
  negativo: 0,
  zerado: 1,
  baixo: 2,
  ok: 3,
  "sem-controle": 4,
}

const SELO: Record<
  Situacao,
  { rotulo: string; variante: "outline" | "secondary" | "destructive" }
> = {
  ok: { rotulo: "OK", variante: "outline" },
  baixo: { rotulo: "Baixo", variante: "secondary" },
  zerado: { rotulo: "Zerado", variante: "destructive" },
  negativo: { rotulo: "Negativo", variante: "destructive" },
  "sem-controle": { rotulo: "Sem controle", variante: "outline" },
}

const FILTROS: { valor: FiltroSituacao; rotulo: string }[] = [
  { valor: "controlados", rotulo: "Controlados" },
  { valor: "ok", rotulo: "OK" },
  { valor: "baixo", rotulo: "Baixo" },
  { valor: "zerado", rotulo: "Zerado" },
  { valor: "negativo", rotulo: "Negativo" },
  { valor: "sem-controle", rotulo: "Sem controle" },
]

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")

/** Linha da tabela: o produto com a categoria e a situação já resolvidas. */
type Linha = { produto: Produto; categoria: string; situacao: Situacao }

const recursos = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic },
})

type Meta = { classe?: string; rotuloOrdem?: string }

function SeloSituacao({ situacao }: { situacao: Situacao }) {
  const selo = SELO[situacao]
  return (
    <Badge
      variant={selo.variante}
      className={cn(situacao === "sem-controle" && "text-muted-foreground")}
    >
      {selo.rotulo}
    </Badge>
  )
}

function Acoes({ linha, aoEscolher }: { linha: Linha; aoEscolher: (acao: AcaoEstoque) => void }) {
  const controlado = linha.situacao !== "sem-controle"
  const item = (acao: AcaoEstoque, Icone: LucideIcon, rotulo: string) => (
    <DropdownMenuItem onSelect={() => aoEscolher(acao)}>
      <Icone />
      {rotulo}
    </DropdownMenuItem>
  )
  return (
    // Sem modal: a janela que abre em seguida recebe o foco e os cliques.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Ações de ${linha.produto.nome}`}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {controlado && (
          <>
            <DropdownMenuGroup>
              {item("entrada", PlusCircleIcon, "Entrada")}
              {item("saida", MinusCircleIcon, "Saída")}
              {item("contagem", ClipboardCheckIcon, "Contagem")}
              {item("historico", HistoryIcon, "Histórico")}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>{item("configurar", Settings2Icon, "Configurar")}</DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Numero({
  rotulo,
  icone: Icone,
  children,
  detalhe,
}: {
  rotulo: string
  icone: LucideIcon
  children: ReactNode
  detalhe?: ReactNode
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription className="flex items-center gap-1.5">
          <Icone className="size-3.5" aria-hidden="true" />
          {rotulo}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-4">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{children}</span>
        {detalhe && <span className="text-xs text-muted-foreground">{detalhe}</span>}
      </CardContent>
    </Card>
  )
}

/**
 * Estoque da loja: o resumo, a lista dos produtos com saldo e situação, e as ações
 * de cada um (entrada, saída, contagem, histórico e configuração).
 */
export function PaginaEstoque() {
  const { data: produtos } = useProdutos()
  const { data: categorias = [] } = useCategorias()
  const [busca, setBusca] = useState("")
  const buscaAdiada = useDeferredValue(busca)
  const [filtro, setFiltro] = useState<FiltroSituacao>("controlados")
  const [categoria, setCategoria] = useState("todas")
  const [ordenacao, setOrdenacao] = useState<SortingState>([])
  const [aberto, setAberto] = useState<{ acao: AcaoEstoque; id: string } | null>(null)

  const linhas = useMemo(() => {
    const nomes = new Map(categorias.map((item) => [item.id, item.nome]))
    const termo = normalizar(buscaAdiada.trim())
    return (produtos ?? [])
      .map((produto) => ({
        produto,
        categoria: nomes.get(produto.categoriaId) ?? "",
        situacao: situacaoDe(produto),
      }))
      .filter(
        (linha) =>
          (filtro === "controlados"
            ? linha.situacao !== "sem-controle"
            : linha.situacao === filtro) &&
          (categoria === "todas" || linha.produto.categoriaId === categoria) &&
          (termo === "" || normalizar(linha.produto.nome).includes(termo)),
      )
      .toSorted(
        (a, b) =>
          URGENCIA[a.situacao] - URGENCIA[b.situacao] ||
          a.produto.nome.localeCompare(b.produto.nome, "pt-BR"),
      )
  }, [produtos, categorias, buscaAdiada, filtro, categoria])

  const colunas = useMemo<ColumnDef<typeof recursos, Linha>[]>(
    () => [
      {
        id: "produto",
        header: "Produto",
        accessorFn: (linha) => normalizar(linha.produto.nome),
        sortFn: "basic",
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium">{row.original.produto.nome}</span>
            <span className="truncate text-xs text-muted-foreground">{row.original.categoria}</span>
            {/* No celular, a situação vem aqui, no lugar da coluna que some. */}
            <span className="sm:hidden">
              <SeloSituacao situacao={row.original.situacao} />
            </span>
          </div>
        ),
        meta: { classe: "max-w-44 sm:max-w-56", rotuloOrdem: "produto" } satisfies Meta,
      },
      {
        id: "saldo",
        header: "Saldo",
        accessorFn: (linha) => linha.produto.estoque?.quantidade ?? 0,
        sortFn: "basic",
        cell: ({ row }) => {
          const { produto, situacao } = row.original
          if (situacao === "sem-controle") return <span className="text-muted-foreground">—</span>
          const estoque = produto.estoque
          return (
            <div className="flex flex-col items-end gap-0.5 tabular-nums">
              <span className="font-medium">
                {emQuantidade(estoque?.quantidade ?? 0, produto.unidade)}
              </span>
              <span className="text-xs text-muted-foreground md:hidden">
                mín. {emQuantidade(estoque?.minimo ?? 0, produto.unidade)}
              </span>
            </div>
          )
        },
        meta: { classe: "text-right", rotuloOrdem: "saldo" } satisfies Meta,
      },
      {
        id: "minimo",
        header: "Mínimo",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.produto.estoque?.controlar
            ? emQuantidade(row.original.produto.estoque.minimo, row.original.produto.unidade)
            : "—",
        meta: { classe: "hidden text-right tabular-nums md:table-cell" } satisfies Meta,
      },
      {
        id: "custo",
        header: "Custo",
        enableSorting: false,
        cell: ({ row }) => {
          const custo = row.original.produto.estoque?.custo
          return custo !== undefined ? emReais(custo) : "—"
        },
        meta: { classe: "hidden text-right tabular-nums lg:table-cell" } satisfies Meta,
      },
      {
        id: "situacao",
        header: "Situação",
        enableSorting: false,
        cell: ({ row }) => <SeloSituacao situacao={row.original.situacao} />,
        meta: { classe: "hidden sm:table-cell" } satisfies Meta,
      },
      {
        id: "acoes",
        header: () => <span className="sr-only">Ações</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <Acoes
            linha={row.original}
            aoEscolher={(acao) => setAberto({ acao, id: row.original.produto.id })}
          />
        ),
        meta: { classe: "w-12 text-right" } satisfies Meta,
      },
    ],
    [],
  )

  const tabela = useTable({
    features: recursos,
    data: linhas,
    columns: colunas,
    getRowId: (linha) => linha.produto.id,
    state: { sorting: ordenacao },
    enableSortingRemoval: true,
    onSortingChange: setOrdenacao,
  })

  if (!produtos) {
    return (
      <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {["a", "b", "c", "d"].map((chave) => (
            <Skeleton key={chave} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const resumo = resumoDoEstoque(produtos)
  const negativos = produtos.filter((produto) => situacaoDe(produto) === "negativo")
  // O produto aberto vem da lista mais nova: o saldo da janela acompanha o servidor.
  const produtoAberto = aberto && produtos.find((produto) => produto.id === aberto.id)
  const fechar = () => setAberto(null)

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Estoque</h1>
        <p className="text-sm text-muted-foreground">
          As vendas baixam o saldo sozinhas; aqui entram as compras, as perdas e a contagem.
        </p>
      </div>

      <section aria-label="Resumo do estoque" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Controlados" icone={BoxesIcon}>
          {resumo.controlados}
        </Numero>
        <Numero rotulo="Abaixo do mínimo" icone={TrendingDownIcon} detalhe="Hora de repor">
          {resumo.baixos}
        </Numero>
        <Numero rotulo="Zerados" icone={PackageXIcon} detalhe="Esgotados para venda">
          {resumo.zerados}
        </Numero>
        <Numero rotulo="Valor em estoque" icone={WalletIcon} detalhe="Saldo × custo">
          {emReais(resumo.valorParado)}
        </Numero>
      </section>

      {negativos.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>
            {plural(negativos.length, "produto", "produtos")} com saldo negativo
          </AlertTitle>
          <AlertDescription>
            Pedidos do site entraram sem saldo ({negativos.map((item) => item.nome).join(", ")}).
            Faça a contagem para acertar.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <InputGroup className="md:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Buscar produto"
            placeholder="Buscar produto"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </InputGroup>
        <div className="flex gap-2">
          <Select value={filtro} onValueChange={(valor) => setFiltro(valor as FiltroSituacao)}>
            <SelectTrigger aria-label="Situação" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {FILTROS.map((item) => (
                  <SelectItem key={item.valor} value={item.valor}>
                    {item.rotulo}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger aria-label="Categoria" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categorias.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {linhas.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum produto aqui</EmptyTitle>
            <EmptyDescription>
              {filtro === "controlados" && resumo.controlados === 0
                ? "Nenhum produto tem o estoque controlado. Escolha “Sem controle” e configure um."
                : "Mude a busca ou os filtros."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table aria-label="Estoque">
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
                <TableRow key={linha.id} aria-label={linha.original.produto.nome}>
                  {linha.getAllCells().map((celula) => {
                    const meta = celula.column.columnDef.meta as Meta | undefined
                    return (
                      <TableCell key={celula.id} className={meta?.classe}>
                        <FlexRender cell={celula} />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {plural(linhas.length, "produto", "produtos")}
      </p>

      {produtoAberto && aberto?.acao === "entrada" && (
        <JanelaEntrada produto={produtoAberto} aoFechar={fechar} />
      )}
      {produtoAberto && aberto?.acao === "saida" && (
        <JanelaSaida produto={produtoAberto} aoFechar={fechar} />
      )}
      {produtoAberto && aberto?.acao === "contagem" && (
        <JanelaContagem produto={produtoAberto} aoFechar={fechar} />
      )}
      {produtoAberto && aberto?.acao === "historico" && (
        <HistoricoEstoque produto={produtoAberto} aoFechar={fechar} />
      )}
      {produtoAberto && aberto?.acao === "configurar" && (
        <JanelaConfigurar produto={produtoAberto} aoFechar={fechar} />
      )}
    </div>
  )
}
