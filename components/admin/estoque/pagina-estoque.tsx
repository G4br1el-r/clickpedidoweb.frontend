"use client"

import NumberFlow from "@number-flow/react"
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
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  ClipboardCheckIcon,
  HistoryIcon,
  type LucideIcon,
  MinusCircleIcon,
  MoreHorizontalIcon,
  PlusCircleIcon,
  SearchIcon,
  SearchXIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
} from "lucide-react"
import { AnimatePresence } from "motion/react"
import { useDeferredValue, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCategorias, useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import type { Produto } from "@/lib/admin/dados/tipos"
import {
  emQuantidade,
  resumoDoEstoque,
  type SituacaoEstoque,
  situacaoEstoque,
} from "@/lib/admin/regras/estoque"
import { planoDoMinimo, textoDosProdutos } from "@/lib/admin/regras/lote-estoque"
import { alternarMarca, marcarVarios } from "@/lib/admin/regras/selecao"
import type { TomStatus } from "@/lib/admin/regras/status"
import { emReais, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { EsqueletoPagina } from "../esqueletos"
import { FaixaRolavel } from "../faixa-rolavel"
import { BlocoEntrando } from "../movimento/entrada-admin"
import { Indicador, Regua } from "../regua"
import { Traco } from "../traco"
import { BarraEmLote } from "./barra-em-lote"
import { FioDeAtualizacao } from "./fio-de-atualizacao"
import {
  type AcaoEstoque,
  HistoricoEstoque,
  JanelaConfigurar,
  JanelaContagem,
  JanelaEntrada,
  JanelaMinimoEmLote,
  JanelaSaida,
} from "./janelas-estoque"
import { LinhaAnimada } from "./linha-animada"
import { MarcadorDaLinha } from "./marcador-de-linha"

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

/**
 * Situação como etiqueta: traço na cor e o nome ao lado. Zerado e negativo usam o tom de
 * cancelado; no mínimo, o de preparo; o que está em dia fica no cinza, para não gritar.
 */
const SELO: Record<Situacao, { rotulo: string; tom: TomStatus | null }> = {
  ok: { rotulo: "OK", tom: "fim" },
  baixo: { rotulo: "Baixo", tom: "preparo" },
  zerado: { rotulo: "Zerado", tom: "cancelado" },
  negativo: { rotulo: "Negativo", tom: "cancelado" },
  "sem-controle": { rotulo: "Sem controle", tom: null },
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
  const { rotulo, tom } = SELO[situacao]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[13px] leading-none font-medium whitespace-nowrap",
        situacao === "ok" || situacao === "sem-controle"
          ? "text-muted-foreground"
          : "text-foreground",
      )}
    >
      {tom && <Traco tom={tom} />}
      {rotulo}
    </span>
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
          className="max-md:size-11"
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

/** Número da régua com o traço do tom ao lado, só quando há algo a olhar. */
function NumeroComTom({ valor, tom }: { valor: number; tom: TomStatus }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {valor > 0 && <Traco tom={tom} className="h-6" />}
      <NumberFlow value={valor} locales="pt-BR" />
    </span>
  )
}

/**
 * Estoque da loja: a régua do que importa, a lista dos produtos com saldo e situação,
 * e as ações de cada um (entrada, saída, contagem, histórico e configuração).
 */
export function PaginaEstoque() {
  const { data: produtos, isFetching } = useProdutos()
  const { data: categorias = [] } = useCategorias()
  const [busca, setBusca] = useState("")
  const buscaAdiada = useDeferredValue(busca)
  const [filtro, setFiltro] = useState<FiltroSituacao>("controlados")
  const [categoria, setCategoria] = useState("todas")
  const [ordenacao, setOrdenacao] = useState<SortingState>([])
  const [aberto, setAberto] = useState<{ acao: AcaoEstoque; id: string } | null>(null)
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(new Set())
  const [definindoMinimo, setDefinindoMinimo] = useState(false)

  /** Quantos produtos há em cada situação: a contagem que aparece no filtro. */
  const contagem = useMemo(() => {
    const total: Record<FiltroSituacao, number> = {
      controlados: 0,
      ok: 0,
      baixo: 0,
      zerado: 0,
      negativo: 0,
      "sem-controle": 0,
    }
    for (const produto of produtos ?? []) {
      const situacao = situacaoDe(produto)
      total[situacao] += 1
      if (situacao !== "sem-controle") total.controlados += 1
    }
    return total
  }, [produtos])

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
        id: "selecionar",
        header: () => <span className="sr-only">Selecionar</span>,
        enableSorting: false,
        // O marcador é desenhado na tabela, que conhece a seleção; a coluna só reserva o lugar.
        cell: () => null,
        meta: { classe: "w-11 pr-0 md:w-10" } satisfies Meta,
      },
      {
        id: "produto",
        header: "Produto",
        accessorFn: (linha) => normalizar(linha.produto.nome),
        sortFn: "basic",
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium">{row.original.produto.nome}</span>
            <span className="truncate text-xs text-muted-foreground">{row.original.categoria}</span>
            {/* No celular, a situação vem aqui, no lugar da coluna que some. */}
            <span className="sm:hidden">
              <SeloSituacao situacao={row.original.situacao} />
            </span>
          </div>
        ),
        meta: { classe: "max-w-36 sm:max-w-72", rotuloOrdem: "produto" } satisfies Meta,
      },
      {
        id: "situacao",
        header: "Situação",
        enableSorting: false,
        cell: ({ row }) => <SeloSituacao situacao={row.original.situacao} />,
        meta: { classe: "hidden w-36 sm:table-cell" } satisfies Meta,
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
              <span className="font-semibold">
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
        meta: {
          classe: "hidden text-right text-muted-foreground tabular-nums md:table-cell",
        } satisfies Meta,
      },
      {
        id: "custo",
        header: "Custo",
        enableSorting: false,
        cell: ({ row }) => {
          const custo = row.original.produto.custo
          return custo !== undefined ? emReais(custo) : "—"
        },
        meta: {
          classe: "hidden text-right text-muted-foreground tabular-nums lg:table-cell",
        } satisfies Meta,
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
    return <EsqueletoPagina rotulo="Carregando o estoque" className="flex-1 lg:px-8" />
  }

  // Só conta o que está na lista: quem saiu por um filtro não entra na ação em lote.
  const marcados = linhas.filter((linha) => selecionados.has(linha.produto.id))
  const marcadosNaLista = marcados.length
  const produtosMarcados = marcados.map((linha) => linha.produto)
  const semControleMarcados = planoDoMinimo(produtosMarcados, Number.NaN).semControle.length
  const idsDaLista = linhas.map((linha) => linha.produto.id)
  const resumo = resumoDoEstoque(produtos)
  const negativos = produtos.filter((produto) => situacaoDe(produto) === "negativo")
  // O produto aberto vem da lista mais nova: o saldo da janela acompanha o servidor.
  const produtoAberto = aberto && produtos.find((produto) => produto.id === aberto.id)
  const fechar = () => setAberto(null)

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Estoque"
        resumo="As vendas baixam o saldo sozinhas; aqui entram as compras, as perdas e a contagem."
      />

      <AnimatePresence>
        {negativos.length > 0 && (
          <BlocoEntrando key="negativos" role="alert" className="flex gap-3 text-sm">
            <Traco tom="cancelado" className="mt-0.5 h-auto self-stretch" />
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">
                {plural(negativos.length, "produto", "produtos")} com saldo negativo
              </p>
              <p className="text-muted-foreground">
                Pedidos do site entraram sem saldo ({negativos.map((item) => item.nome).join(", ")}
                ). Faça a contagem para acertar.
              </p>
            </div>
          </BlocoEntrando>
        )}
      </AnimatePresence>

      <BlocoEntrando como="section" aria-label="Resumo do estoque">
        <Regua>
          <Indicador rotulo="Controlados" detalhe="Com o saldo acompanhado">
            <NumberFlow value={resumo.controlados} locales="pt-BR" />
          </Indicador>
          <Indicador rotulo="Abaixo do mínimo" detalhe="Hora de repor">
            <NumeroComTom valor={resumo.baixos} tom="preparo" />
          </Indicador>
          <Indicador rotulo="Zerados" detalhe="Esgotados para venda">
            <NumeroComTom valor={resumo.zerados} tom="cancelado" />
          </Indicador>
          <Indicador rotulo="Valor em estoque" detalhe="Saldo × custo">
            {/* Dinheiro é o número mais largo: no celular encolhe para caber na coluna. */}
            <span className="max-lg:text-[clamp(1rem,5.5vw,1.75rem)]">
              <NumberFlow
                value={resumo.valorParado}
                locales="pt-BR"
                format={{ style: "currency", currency: "BRL" }}
              />
            </span>
          </Indicador>
        </Regua>
      </BlocoEntrando>

      <div className="flex flex-col gap-3">
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
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger aria-label="Categoria" className="md:w-52">
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
        {/* No celular o controle rola de lado dentro da própria faixa; a página não. */}
        <FaixaRolavel className="-mx-4 px-4 md:mx-0 md:px-0">
          <ToggleGroup
            type="single"
            variant="segmento"
            size="sm"
            aria-label="Situação"
            value={filtro}
            onValueChange={(valor) => valor && setFiltro(valor as FiltroSituacao)}
          >
            {FILTROS.map(({ valor, rotulo }) => (
              <ToggleGroupItem
                key={valor}
                value={valor}
                className="cursor-pointer gap-1.5 px-2.5 max-md:h-11"
              >
                {rotulo}{" "}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {contagem[valor]}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FaixaRolavel>
      </div>

      <FioDeAtualizacao ativo={isFetching} rotulo="Atualizando o estoque" />

      {linhas.length === 0 ? (
        <Empty className="border-t border-border/70">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum produto aqui</EmptyTitle>
            <EmptyDescription>
              {filtro === "controlados" && resumo.controlados === 0
                ? "Nenhum produto tem o estoque controlado. Escolha “Sem controle” e configure um."
                : "Mude a busca, a categoria ou a situação."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="border-t border-border/70">
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
                    if (cabecalho.column.id === "selecionar") {
                      return (
                        <TableHead key={cabecalho.id} className={meta?.classe}>
                          <MarcadorDaLinha
                            rotulo="Selecionar todos os produtos da lista"
                            checked={
                              marcadosNaLista === 0
                                ? false
                                : marcadosNaLista === linhas.length
                                  ? true
                                  : "indeterminate"
                            }
                            aoMudar={(marcar) =>
                              setSelecionados((atual) => marcarVarios(atual, idsDaLista, marcar))
                            }
                          />
                        </TableHead>
                      )
                    }
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
                              "-mx-2 h-8 max-md:h-11",
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
              <AnimatePresence>
                {tabela.getRowModel().rows.map((linha, indice) => (
                  <LinhaAnimada
                    key={linha.id}
                    indice={indice}
                    aria-label={linha.original.produto.nome}
                    data-state={
                      selecionados.has(linha.original.produto.id) ? "selected" : undefined
                    }
                  >
                    {linha.getAllCells().map((celula) => {
                      const meta = celula.column.columnDef.meta as Meta | undefined
                      return (
                        <TableCell key={celula.id} className={meta?.classe}>
                          {celula.column.id === "selecionar" ? (
                            <MarcadorDaLinha
                              rotulo={`Selecionar o produto ${linha.original.produto.nome}`}
                              checked={selecionados.has(linha.original.produto.id)}
                              aoMudar={() =>
                                setSelecionados((atual) =>
                                  alternarMarca(atual, linha.original.produto.id),
                                )
                              }
                            />
                          ) : (
                            <FlexRender cell={celula} />
                          )}
                        </TableCell>
                      )
                    })}
                  </LinhaAnimada>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
        {plural(linhas.length, "produto", "produtos")}
      </p>

      <BarraEmLote
        aberta={marcadosNaLista > 0}
        texto={textoDosProdutos(marcadosNaLista)}
        nota={
          semControleMarcados > 0
            ? `${semControleMarcados} sem controle: o mínimo não vale para eles`
            : undefined
        }
        aoLimpar={() => setSelecionados(new Set())}
      >
        <Button
          type="button"
          size="sm"
          className="max-md:h-11"
          disabled={semControleMarcados === marcadosNaLista}
          onClick={() => setDefinindoMinimo(true)}
        >
          <SlidersHorizontalIcon data-icon="inline-start" />
          Definir mínimo
        </Button>
      </BarraEmLote>

      {definindoMinimo && (
        <JanelaMinimoEmLote
          produtos={produtosMarcados}
          aoFechar={() => setDefinindoMinimo(false)}
          aoConcluir={() => setSelecionados(new Set())}
        />
      )}

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
