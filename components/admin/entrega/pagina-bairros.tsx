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
import { MapPinIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
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
  AlertDialogTrigger,
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
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
import { Skeleton } from "@/components/ui/skeleton"
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
import { plural } from "@/lib/formato"
import { AvisoSemEntrega } from "./aviso-sem-entrega"

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

/** Taxa editada na linha: salva ao apertar Enter ou sair do campo, se mudou. */
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
      className="h-8 w-[5.5rem] text-right tabular-nums sm:w-24"
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
  return (
    <div className="flex justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Editar ${bairro.nome}`}
        onClick={aoEditar}
      >
        <PencilIcon />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir ${bairro.nome}`}
          >
            <Trash2Icon />
          </Button>
        </AlertDialogTrigger>
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
                  onSuccess: () => toast.success(`${bairro.nome} excluído.`),
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
          className="flex flex-col gap-4"
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
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="bairro-cidade">Cidade</FieldLabel>
              <Input
                id="bairro-cidade"
                maxLength={60}
                value={cidade}
                onChange={(evento) => setCidade(evento.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="bairro-nome">Bairro</FieldLabel>
              <Input
                id="bairro-nome"
                maxLength={60}
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
                value={taxa ?? ""}
                onValueChange={({ floatValue }) => setTaxa(floatValue)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={salvar.isPending}>
              Salvar
            </Button>
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
          className="flex flex-col gap-4"
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
              value={taxa ?? ""}
              onValueChange={({ floatValue }) => setTaxa(floatValue)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={mudar.isPending}>
              Aplicar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Bairros e taxas: busca, cidade, taxa na linha e mudanças em lote. */
export function PaginaBairros() {
  const { data: bairros } = useBairros()
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
            checked={row.getIsSelected()}
            onCheckedChange={(marcado) => row.toggleSelected(marcado === true)}
          />
        ),
      },
      {
        id: "nome",
        header: "Bairro",
        cell: ({ row }) => (
          <span className="block max-w-[7.5rem] truncate font-medium sm:max-w-none">
            {row.original.nome}
          </span>
        ),
      },
      {
        id: "cidade",
        header: "Cidade",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.cidade}</span>,
      },
      {
        id: "taxa",
        header: "Taxa",
        cell: ({ row }) => <TaxaNaLinha key={row.original.taxa} bairro={row.original} />,
      },
      {
        id: "ativo",
        header: "Ativo",
        cell: ({ row }) => (
          <Switch
            aria-label={`${row.original.nome} ativo`}
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
  const selecionados = Object.keys(selecao).filter((id) => selecao[id])

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Bairros e taxas</h1>
          <p className="text-sm text-muted-foreground">
            Sem bairro cadastrado, vale a taxa padrão das configurações da loja.
          </p>
        </div>
        <Button type="button" size="sm" className="ml-auto" onClick={() => setEditando("novo")}>
          <PlusIcon data-icon="inline-start" />
          Novo bairro
        </Button>
      </div>

      <AvisoSemEntrega />

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="max-w-xs">
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
          <SelectTrigger size="sm" aria-label="Cidade" className="w-56">
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
      </div>

      {selecionados.length > 0 && (
        <div
          role="toolbar"
          aria-label={`${plural(selecionados.length, "bairro selecionado", "bairros selecionados")}`}
          className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/50 px-3 py-2 text-sm"
        >
          <span className="mr-auto font-medium">
            {plural(selecionados.length, "bairro selecionado", "bairros selecionados")}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => setMudandoTaxa(true)}>
            Mudar taxa
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              mudar.mutate(
                { ids: selecionados, mudanca: { ativo: true } },
                { onSuccess: () => setSelecao({}), onError: aoErrar },
              )
            }
          >
            Ativar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              mudar.mutate(
                { ids: selecionados, mudanca: { ativo: false } },
                { onSuccess: () => setSelecao({}), onError: aoErrar },
              )
            }
          >
            Desativar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelecao({})}>
            Limpar seleção
          </Button>
        </div>
      )}

      {!bairros ? (
        <Skeleton role="status" aria-label="Carregando os bairros" className="h-64 rounded-xl" />
      ) : bairros.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPinIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum bairro cadastrado</EmptyTitle>
            <EmptyDescription>Sem bairros, todo pedido usa a taxa padrão da loja.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table aria-label="Bairros">
            <TableHeader>
              {tabela.getHeaderGroups().map((grupo) => (
                <TableRow key={grupo.id}>
                  {grupo.headers.map((cabecalho) => (
                    <TableHead
                      key={cabecalho.id}
                      className={
                        cabecalho.column.id === "cidade"
                          ? "hidden md:table-cell"
                          : cabecalho.column.id === "selecionar"
                            ? "w-10"
                            : undefined
                      }
                    >
                      <FlexRender header={cabecalho} />
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {tabela.getRowModel().rows.map((linha) => (
                <TableRow
                  key={linha.id}
                  data-state={linha.getIsSelected() ? "selected" : undefined}
                >
                  {linha.getAllCells().map((celula) => (
                    <TableCell
                      key={celula.id}
                      className={celula.column.id === "cidade" ? "hidden md:table-cell" : undefined}
                    >
                      <FlexRender cell={celula} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visiveis.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum bairro encontrado.
            </p>
          )}
        </div>
      )}

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
