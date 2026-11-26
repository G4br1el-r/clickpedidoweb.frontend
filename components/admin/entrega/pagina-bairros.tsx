"use client"

import {
  type ColumnDef,
  FlexRender,
  type RowSelectionState,
  rowSelectionFeature,
  tableFeatures,
  type Updater,
  useTable,
} from "@tanstack/react-table"
import {
  EllipsisIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
  Trash2Icon,
} from "lucide-react"
import { AnimatePresence } from "motion/react"
import { useDeferredValue, useMemo, useState } from "react"
import { NumericFormat } from "react-number-format"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useBairros,
  useExcluirBairro,
  useMudarBairros,
  useSalvarBairro,
} from "@/lib/admin/dados/consultas-entrega"
import type { Bairro } from "@/lib/admin/dados/tipos"
import { normalizar } from "@/lib/admin/regras/filtro-pedidos"
import { efeitoDoLoteBairros, idsDoLote } from "@/lib/admin/regras/lote-bairros"
import { plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { EsqueletoLista } from "../esqueletos"
import { BotaoCarregando } from "../movimento/botao-carregando"
import { BlocoEntrando } from "../movimento/entrada-admin"
import { Traco } from "../traco"
import { BarraAtualizando } from "./atualizando"
import { AvisoSemEntrega } from "./aviso-sem-entrega"
import { BarraDeLoteBairros } from "./barra-de-lote-bairros"
import { ALVO_DA_CAIXA, ALVO_DA_CHAVE, ALVO_DE_TOQUE, LinhaAnimada } from "./linha-animada"

const recursos = tableFeatures({ rowSelectionFeature })

const dinheiro = {
  customInput: Input,
  inputMode: "decimal" as const,
  prefix: "R$ ",
  decimalSeparator: ",",
  thousandSeparator: ".",
  decimalScale: 2,
  fixedDecimalScale: true,
}

const aoErrar = (erro: Error) => toast.error(erro.message)

/**
 * Taxa editada na linha: parece texto até o ponteiro ou o foco chegar, e salva ao apertar
 * Enter ou sair do campo, se mudou.
 */
function TaxaNaLinha({ bairro }: { bairro: Bairro }) {
  const salvar = useSalvarBairro()
  const [valor, setValor] = useState<number | undefined>(bairro.taxa)
  const confirmar = () => {
    if (valor === undefined || valor === bairro.taxa) return setValor(bairro.taxa)
    salvar.mutate(
      { ...bairro, taxa: valor },
      { onSuccess: (salvo) => toast.success(`Taxa de ${salvo.nome} salva.`), onError: aoErrar },
    )
  }
  return (
    <NumericFormat
      {...dinheiro}
      aria-label={`Taxa de ${bairro.nome}`}
      className={cn(
        "ml-auto h-8 w-[5.5rem] border-transparent max-sm:h-11 bg-transparent text-right font-medium tabular-nums shadow-none sm:w-24 dark:bg-transparent",
        "hover:border-border focus-visible:border-ring",
        !bairro.ativo && "text-muted-foreground",
      )}
      value={valor ?? ""}
      onValueChange={({ floatValue }) => setValor(floatValue)}
      onBlur={confirmar}
      onKeyDown={(evento) => {
        if (evento.key === "Enter") {
          evento.preventDefault()
          confirmar()
        }
      }}
    />
  )
}

function AcoesDaLinha({ bairro, aoEditar }: { bairro: Bairro; aoEditar: () => void }) {
  const excluir = useExcluirBairro()
  const salvar = useSalvarBairro()
  const [confirmando, setConfirmando] = useState(false)
  return (
    <div className="flex justify-end gap-1">
      {/* Do tablet em diante cabem os dois botões; no celular, um menu só. */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="max-sm:hidden"
        aria-label={`Editar ${bairro.nome}`}
        onClick={aoEditar}
      >
        <PencilIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="max-sm:hidden"
        aria-label={`Excluir ${bairro.nome}`}
        onClick={() => setConfirmando(true)}
      >
        <Trash2Icon />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("sm:hidden", ALVO_DE_TOQUE)}
            aria-label={`Ações de ${bairro.nome}`}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={aoEditar}>
            <PencilIcon />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmando(true)}>
            <Trash2Icon />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {bairro.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os pedidos antigos guardam o endereço e a taxa. Se quiser parar de entregar lá por um
              tempo, desative em vez de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                excluir.mutate(bairro.id, {
                  onSuccess: () =>
                    toast.success(`${bairro.nome} excluído.`, {
                      // O mesmo cadastro volta, com o mesmo id e a mesma taxa.
                      action: {
                        label: "Desfazer",
                        onClick: () =>
                          salvar.mutate(bairro, {
                            onSuccess: () => toast.success(`${bairro.nome} voltou para a lista.`),
                            onError: aoErrar,
                          }),
                      },
                    }),
                  onError: aoErrar,
                })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function JanelaBairro({ bairro, aoFechar }: { bairro: Bairro | null; aoFechar: () => void }) {
  const salvar = useSalvarBairro()
  const [cidade, setCidade] = useState(bairro?.cidade ?? "")
  const [nome, setNome] = useState(bairro?.nome ?? "")
  const [taxa, setTaxa] = useState<number | undefined>(bairro?.taxa)
  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <form
          className="flex flex-col gap-5"
          onSubmit={(evento) => {
            evento.preventDefault()
            salvar.mutate(
              { ...(bairro ?? { ativo: true }), cidade, nome, taxa: taxa ?? 0 },
              {
                onSuccess: (salvo) => {
                  toast.success(`${salvo.nome} salvo.`)
                  aoFechar()
                },
                onError: aoErrar,
              },
            )
          }}
        >
          <DialogHeader>
            <DialogTitle>{bairro ? "Editar bairro" : "Novo bairro"}</DialogTitle>
            <DialogDescription>A taxa entra no pedido de quem mora no bairro.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="bairro-cidade">Cidade</FieldLabel>
              <Input
                id="bairro-cidade"
                maxLength={60}
                autoComplete="off"
                value={cidade}
                onChange={(evento) => setCidade(evento.target.value)}
              />
            </Field>
            <div className="grid grid-cols-[1fr_7.5rem] gap-3">
              <Field>
                <FieldLabel htmlFor="bairro-nome">Bairro</FieldLabel>
                <Input
                  id="bairro-nome"
                  maxLength={60}
                  autoComplete="off"
                  value={nome}
                  onChange={(evento) => setNome(evento.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bairro-taxa">Taxa</FieldLabel>
                <NumericFormat
                  {...dinheiro}
                  id="bairro-taxa"
                  placeholder="Grátis"
                  className="text-right tabular-nums"
                  value={taxa ?? ""}
                  onValueChange={({ floatValue }) => setTaxa(floatValue)}
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <BotaoCarregando
              type="submit"
              carregando={salvar.isPending}
              rotuloCarregando="Salvando o bairro"
            >
              Salvar
            </BotaoCarregando>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MudarTaxa({ ids, aoFechar }: { ids: string[]; aoFechar: (aplicou: boolean) => void }) {
  const mudar = useMudarBairros()
  const [taxa, setTaxa] = useState<number | undefined>()
  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar(false)}>
      <DialogContent className="sm:max-w-sm">
        <form
          className="flex flex-col gap-5"
          onSubmit={(evento) => {
            evento.preventDefault()
            if (taxa === undefined) return toast.error("Informe a nova taxa.")
            mudar.mutate(
              { ids, mudanca: { taxa } },
              {
                onSuccess: () => {
                  toast.success(`Taxa de ${plural(ids.length, "bairro", "bairros")} atualizada.`)
                  aoFechar(true)
                },
                onError: aoErrar,
              },
            )
          }}
        >
          <DialogHeader>
            <DialogTitle>Mudar a taxa de {plural(ids.length, "bairro", "bairros")}</DialogTitle>
            <DialogDescription>Todos os selecionados ficam com a mesma taxa.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="bairros-taxa">Nova taxa</FieldLabel>
            <NumericFormat
              {...dinheiro}
              id="bairros-taxa"
              className="tabular-nums"
              value={taxa ?? ""}
              onValueChange={({ floatValue }) => setTaxa(floatValue)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => aoFechar(false)}>
              Cancelar
            </Button>
            <BotaoCarregando
              type="submit"
              carregando={mudar.isPending}
              rotuloCarregando="Aplicando a taxa"
            >
              Aplicar
            </BotaoCarregando>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Bairros e taxas: busca, cidade, taxa na linha e mudanças em lote. */
export function PaginaBairros() {
  const { data: bairros, isFetching } = useBairros()
  const mudar = useMudarBairros()
  const [busca, setBusca] = useState("")
  const [cidade, setCidade] = useState("todas")
  const [selecao, setSelecao] = useState<RowSelectionState>({})
  const [editando, setEditando] = useState<Bairro | null | "novo">(null)
  const [mudandoTaxa, setMudandoTaxa] = useState(false)
  const buscaAdiada = useDeferredValue(busca)

  const cidades = useMemo(
    () => [...new Set((bairros ?? []).map((bairro) => bairro.cidade))],
    [bairros],
  )
  const visiveis = useMemo(() => {
    const termo = normalizar(buscaAdiada).trim()
    return (bairros ?? []).filter(
      (bairro) =>
        (cidade === "todas" || bairro.cidade === cidade) &&
        (!termo || normalizar(bairro.nome).includes(termo)),
    )
  }, [bairros, cidade, buscaAdiada])

  const colunas = useMemo<ColumnDef<typeof recursos, Bairro>[]>(
    () => [
      {
        id: "selecionar",
        header: ({ table }) => (
          <Checkbox
            aria-label="Selecionar todos"
            className={ALVO_DA_CAIXA}
            checked={
              table.getIsAllRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(marcado) => table.toggleAllRowsSelected(marcado === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Selecionar ${row.original.nome}, ${row.original.cidade}`}
            className={ALVO_DA_CAIXA}
            checked={row.getIsSelected()}
            onCheckedChange={(marcado) => row.toggleSelected(marcado === true)}
          />
        ),
      },
      {
        id: "nome",
        header: "Bairro",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <Traco tom="fim" className={cn("h-8 md:h-4", row.original.ativo && "invisible")} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  "block max-w-[7.5rem] truncate font-medium transition-colors duration-200 sm:max-w-none",
                  !row.original.ativo && "text-muted-foreground",
                )}
              >
                {row.original.nome}
              </span>
              {/* No celular a cidade vem embaixo do bairro, no lugar da coluna. */}
              <span className="block max-w-[7.5rem] truncate text-[13px] text-muted-foreground md:hidden">
                {row.original.cidade}
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "cidade",
        header: "Cidade",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.cidade}</span>,
      },
      {
        id: "taxa",
        header: () => <span className="block pr-3 text-right">Taxa</span>,
        cell: ({ row }) => <TaxaNaLinha key={row.original.taxa} bairro={row.original} />,
      },
      {
        id: "ativo",
        header: "Ativo",
        cell: ({ row }) => (
          <Switch
            aria-label={`${row.original.nome} ativo`}
            className={ALVO_DA_CHAVE}
            checked={row.original.ativo}
            onCheckedChange={(ativo) =>
              mudar.mutate({ ids: [row.original.id], mudanca: { ativo } }, { onError: aoErrar })
            }
          />
        ),
      },
      {
        id: "acoes",
        header: () => <span className="sr-only">Ações</span>,
        cell: ({ row }) => (
          <AcoesDaLinha bairro={row.original} aoEditar={() => setEditando(row.original)} />
        ),
      },
    ],
    [mudar.mutate],
  )

  const tabela = useTable({
    features: recursos,
    data: visiveis,
    columns: colunas,
    getRowId: (bairro) => bairro.id,
    state: { rowSelection: selecao },
    onRowSelectionChange: (atualizar: Updater<RowSelectionState>) =>
      setSelecao((atual) => (typeof atualizar === "function" ? atualizar(atual) : atualizar)),
  })
  // Só vale o que está na lista visível: o filtro esconde, e o lote não mexe no escondido.
  const selecionados = idsDoLote(selecao, visiveis)
  const efeito = efeitoDoLoteBairros(bairros ?? [], selecionados)
  const ocupada =
    mudar.isPending && mudar.variables?.mudanca.ativo !== undefined
      ? mudar.variables.mudanca.ativo
        ? ("ativar" as const)
        : ("desativar" as const)
      : null
  const mudarAtivos = (ativo: boolean) => {
    const ids = ativo ? efeito.aAtivar : efeito.aDesativar
    mudar.mutate(
      { ids, mudanca: { ativo } },
      {
        onSuccess: () => {
          toast.success(
            `${plural(ids.length, ativo ? "bairro ativado" : "bairro desativado", ativo ? "bairros ativados" : "bairros desativados")}.`,
          )
          setSelecao({})
        },
        onError: aoErrar,
      },
    )
  }
  const ativos = bairros?.filter((bairro) => bairro.ativo).length ?? 0
  const filtrando = busca.trim() !== "" || cidade !== "todas"
  const classeDaColuna = (id: string) =>
    id === "cidade"
      ? "hidden md:table-cell"
      : id === "selecionar"
        ? "w-10 pl-0"
        : id === "taxa"
          ? "w-28 text-right"
          : id === "ativo"
            ? "w-16"
            : id === "acoes"
              ? "w-20 pr-0"
              : undefined

  return (
    <div className="flex w-full max-w-5xl flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Bairros e taxas"
        resumo={
          bairros && bairros.length > 0
            ? `${plural(ativos, "bairro atendido", "bairros atendidos")} de ${bairros.length}. Sem bairro cadastrado, vale a taxa padrão das configurações da loja.`
            : "Sem bairro cadastrado, vale a taxa padrão das configurações da loja."
        }
        acoes={
          <Button type="button" onClick={() => setEditando("novo")}>
            <PlusIcon data-icon="inline-start" />
            Novo bairro
          </Button>
        }
      />

      <AvisoSemEntrega />

      {!bairros ? (
        <EsqueletoLista rotulo="Carregando os bairros" linhas={8} />
      ) : bairros.length === 0 ? (
        <Empty className="border border-border/70">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPinIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum bairro cadastrado</EmptyTitle>
            <EmptyDescription>
              Sem bairros, todo pedido usa a taxa padrão da loja. Cadastre os bairros que custam
              mais ou menos para entregar.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={() => setEditando("novo")}>
              <PlusIcon data-icon="inline-start" />
              Cadastrar o primeiro bairro
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="w-full sm:max-w-xs">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                aria-label="Buscar bairro"
                placeholder="Buscar bairro"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
              />
            </InputGroup>
            <Select value={cidade} onValueChange={setCidade}>
              <SelectTrigger aria-label="Cidade" className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="todas">Todas as cidades</SelectItem>
                  {cidades.map((nome) => (
                    <SelectItem key={nome} value={nome}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {filtrando && (
              <span className="text-[13px] text-muted-foreground tabular-nums sm:ml-auto">
                {plural(visiveis.length, "bairro", "bairros")} de {bairros.length}
              </span>
            )}
          </div>

          <BlocoEntrando className="flex flex-col">
            <BarraAtualizando
              ativa={isFetching || mudar.isPending}
              rotulo="Atualizando os bairros"
              className="mb-1"
            />
            <Table aria-label="Bairros">
              <TableHeader>
                {tabela.getHeaderGroups().map((grupo) => (
                  <TableRow key={grupo.id} className="hover:bg-transparent">
                    {grupo.headers.map((cabecalho) => (
                      <TableHead key={cabecalho.id} className={classeDaColuna(cabecalho.column.id)}>
                        <FlexRender header={cabecalho} />
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              {/* Trocar o filtro troca a lista de uma vez; só cadastrar e excluir animam. */}
              <TableBody key={`${cidade}|${buscaAdiada}`}>
                <AnimatePresence initial={false}>
                  {tabela.getRowModel().rows.map((linha) => (
                    <LinhaAnimada
                      key={linha.id}
                      data-state={linha.getIsSelected() ? "selected" : undefined}
                    >
                      {linha.getAllCells().map((celula) => (
                        <TableCell
                          key={celula.id}
                          className={cn(
                            classeDaColuna(celula.column.id),
                            celula.column.id === "nome" && "py-2.5",
                          )}
                        >
                          <FlexRender cell={celula} />
                        </TableCell>
                      ))}
                    </LinhaAnimada>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </BlocoEntrando>
          {visiveis.length === 0 && (
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhum bairro encontrado.</EmptyTitle>
                <EmptyDescription>
                  Confira a grafia ou procure em todas as cidades.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setBusca("")
                    setCidade("todas")
                  }}
                >
                  Limpar a busca
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </div>
      )}

      <AnimatePresence>
        {selecionados.length > 0 && (
          <BarraDeLoteBairros
            key="selecao"
            selecionados={selecionados.length}
            aAtivar={efeito.aAtivar.length}
            aDesativar={efeito.aDesativar.length}
            ocupada={ocupada}
            aoMudarTaxa={() => setMudandoTaxa(true)}
            aoAtivar={() => mudarAtivos(true)}
            aoDesativar={() => mudarAtivos(false)}
            aoLimpar={() => setSelecao({})}
          />
        )}
      </AnimatePresence>

      {editando && (
        <JanelaBairro
          bairro={editando === "novo" ? null : editando}
          aoFechar={() => setEditando(null)}
        />
      )}
      {mudandoTaxa && (
        <MudarTaxa
          ids={selecionados}
          aoFechar={(aplicou) => {
            setMudandoTaxa(false)
            if (aplicou) setSelecao({})
          }}
        />
      )}
    </div>
  )
}
