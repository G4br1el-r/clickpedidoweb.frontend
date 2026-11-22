"use client"

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyPlusIcon,
  GripVerticalIcon,
  ImageUpIcon,
  LinkIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import Image from "next/image"
import { type ReactNode, useEffect, useId, useMemo, useState } from "react"
import {
  type Control,
  Controller,
  type FieldErrors,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form"
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import { useLoja } from "@/lib/admin/dados/consultas"
import {
  useCategorias,
  useProdutos,
  useReplicarOpcoes,
  useSalvarProduto,
} from "@/lib/admin/dados/consultas-cardapio"
import type { Produto } from "@/lib/admin/dados/tipos"
import { prepararFoto } from "@/lib/admin/imagem"
import { opcaoDoProduto } from "@/lib/admin/regras/cardapio"
import { camposDoProduto, esquemaProduto } from "@/lib/admin/regras/esquema-produto"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { temModulo, temRecurso } from "@/lib/admin/segmentos-painel"
import { RecursoPro } from "../recurso-pro"
import { Traco } from "../traco"
import { useProdutoAberto } from "./pagina-cardapio"

const novoId = (prefixo: string) => `${prefixo}-${crypto.randomUUID().slice(0, 8)}`

/** Quantos campos têm erro: conta cada mensagem, inclusive as de dentro dos grupos. */
function contarErros(erros: unknown): number {
  if (!erros || typeof erros !== "object") return 0
  if ("message" in erros && typeof erros.message === "string") return 1
  return Object.values(erros).reduce<number>((soma, valor) => soma + contarErros(valor), 0)
}

/** Seção plana do formulário: título pequeno, fio em cima e os campos abaixo. */
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
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 border-t border-border/70 pt-5 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-col gap-0.5">
        <h3 id={id} className="text-sm font-semibold tracking-[-0.01em]">
          {titulo}
        </h3>
        {descricao && <p className="text-[13px] text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </section>
  )
}

type ValoresGrupo = {
  id: string
  nome: string
  minimo: number
  maximo: number
  gratisAte: number
  ativo: boolean
  itens: { id: string; nome: string; precoAdicional?: number; ativo: boolean; produtoId?: string }[]
}

/** Valores do formulário; o esquema do segmento decide quais são validados e salvos. */
type Valores = {
  categoriaId: string
  /** "categoria": segue a praça da categoria. */
  pracaId: string
  nome: string
  descricao: string
  preco: number
  precoOriginal?: number
  precoBalcao?: number
  custo?: number
  imagem?: string
  ativo: boolean
  disponivel: boolean
  destaque: boolean
  oferta: boolean
  unidade: "un" | "kg"
  duracaoMin?: number
  preparoMin?: number
  videoUrl: string
  grupos: ValoresGrupo[]
}

const DA_CATEGORIA = "categoria"

function valoresIniciais(produto: Produto | undefined): Valores {
  return {
    categoriaId: produto?.categoriaId ?? "",
    pracaId: produto?.pracaId ?? DA_CATEGORIA,
    nome: produto?.nome ?? "",
    descricao: produto?.descricao ?? "",
    preco: produto?.preco as number,
    precoOriginal: produto?.precoOriginal,
    precoBalcao: produto?.precoBalcao,
    custo: produto?.custo,
    imagem: produto?.imagem,
    ativo: produto?.ativo ?? true,
    disponivel: produto?.disponivel ?? true,
    destaque: produto?.destaque ?? false,
    oferta: produto?.oferta ?? false,
    unidade: produto?.unidade ?? "un",
    duracaoMin: produto?.duracaoMin,
    preparoMin: produto?.preparoMin,
    videoUrl: produto?.videoUrl ?? "",
    grupos: (produto?.grupos ?? []).map(({ ordem, itens, ...grupo }) => ({
      ...grupo,
      itens: itens.map(({ ordem: _ordem, ...item }) => item),
    })),
  }
}

/** Campo de dinheiro com máscara (R$ 1.234,50), ligado ao formulário. */
function CampoDinheiro({
  control,
  nome,
  rotulo,
  id,
  erro,
  placeholder,
  descricao,
}: {
  control: Control<Valores>
  nome:
    | "preco"
    | "precoOriginal"
    | "precoBalcao"
    | "custo"
    | `grupos.${number}.itens.${number}.precoAdicional`
  rotulo: string
  id: string
  erro?: string
  placeholder?: string
  descricao?: string
}) {
  return (
    <Field data-invalid={Boolean(erro)}>
      <FieldLabel htmlFor={id}>{rotulo}</FieldLabel>
      <Controller
        control={control}
        name={nome}
        render={({ field: { value, onChange, ref, ...campo } }) => (
          <NumericFormat
            {...campo}
            id={id}
            getInputRef={ref}
            customInput={Input}
            inputMode="decimal"
            prefix="R$ "
            decimalSeparator=","
            thousandSeparator="."
            decimalScale={2}
            fixedDecimalScale
            placeholder={placeholder}
            value={typeof value === "number" ? value : ""}
            onValueChange={({ floatValue }) => onChange(floatValue)}
            aria-invalid={Boolean(erro)}
          />
        )}
      />
      {descricao && <FieldDescription>{descricao}</FieldDescription>}
      {erro && <FieldError>{erro}</FieldError>}
    </Field>
  )
}

function CampoInteiro({
  control,
  nome,
  rotulo,
  id,
  erro,
}: {
  control: Control<Valores>
  nome: `grupos.${number}.${"minimo" | "maximo" | "gratisAte"}` | "duracaoMin" | "preparoMin"
  rotulo: string
  id: string
  erro?: string
}) {
  return (
    <Field data-invalid={Boolean(erro)}>
      <FieldLabel htmlFor={id}>{rotulo}</FieldLabel>
      <Controller
        control={control}
        name={nome}
        render={({ field: { value, onChange, ...campo } }) => (
          <Input
            {...campo}
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            value={typeof value === "number" && !Number.isNaN(value) ? value : ""}
            onChange={(evento) =>
              onChange(evento.target.value === "" ? undefined : Number(evento.target.value))
            }
            aria-invalid={Boolean(erro)}
          />
        )}
      />
      {erro && <FieldError>{erro}</FieldError>}
    </Field>
  )
}

/** Adega: busca um produto do cardápio e o transforma numa opção ligada a ele. */
function EscolherProduto({
  produtos,
  aoEscolher,
}: {
  produtos: Produto[]
  aoEscolher: (produto: Produto) => void
}) {
  const [aberto, setAberto] = useState(false)
  if (!aberto) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => setAberto(true)}
      >
        <LinkIcon data-icon="inline-start" />
        Adicionar produto como opção
      </Button>
    )
  }
  // A busca abre dentro do próprio grupo: sem janela por cima do painel.
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-background p-2 ring-1 ring-border/80">
      <Command className="bg-transparent" label="Buscar produto">
        <CommandInput placeholder="Buscar produto" autoFocus />
        <CommandList className="max-h-48">
          <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
          <CommandGroup>
            {produtos.map((produto) => (
              <CommandItem
                key={produto.id}
                value={`${produto.nome} ${produto.id}`}
                onSelect={() => {
                  aoEscolher(produto)
                  setAberto(false)
                }}
              >
                {produto.nome}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-end"
        onClick={() => setAberto(false)}
      >
        Fechar busca
      </Button>
    </div>
  )
}

/** Um grupo de opções: arrastar (ou subir e descer pelos botões), regras e itens. */
function GrupoDeOpcoes({
  control,
  indice,
  total,
  idDoGrupo,
  erros,
  aoMover,
  aoRemover,
  combos,
}: {
  control: Control<Valores>
  indice: number
  total: number
  idDoGrupo: string
  erros?: FieldErrors<NonNullable<Valores["grupos"]>[number]>
  aoMover: (destino: number) => void
  aoRemover: () => void
  /** Adega: opções ligadas a produtos do cardápio (os outros produtos, para escolher). */
  combos: Produto[] | null
}) {
  const ordenavel = useSortable({ id: idDoGrupo })
  const itens = useFieldArray({ control, name: `grupos.${indice}.itens` })
  const valoresDosItens = useWatch({ control, name: `grupos.${indice}.itens` })
  const nomeDoProduto = (id: string | undefined) =>
    combos?.find((produto) => produto.id === id)?.nome
  const prefixo = `grupo-${idDoGrupo}`
  const numero = indice + 1

  return (
    <fieldset
      ref={ordenavel.setNodeRef}
      style={{
        transform: CSS.Transform.toString(ordenavel.transform),
        transition: ordenavel.transition,
      }}
      aria-label={`Grupo ${numero}`}
      className="flex flex-col gap-3 rounded-xl bg-foreground/[0.03] p-3"
    >
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Arrastar para reordenar"
          className="cursor-grab touch-none"
          {...ordenavel.attributes}
          {...ordenavel.listeners}
        >
          <GripVerticalIcon />
        </Button>
        <span className="text-sm font-medium">Grupo {numero}</span>
        <div className="ml-auto flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Subir grupo"
            disabled={indice === 0}
            onClick={() => aoMover(indice - 1)}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Descer grupo"
            disabled={indice === total - 1}
            onClick={() => aoMover(indice + 1)}
          >
            <ArrowDownIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remover grupo"
            onClick={aoRemover}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <Controller
        control={control}
        name={`grupos.${indice}.nome`}
        render={({ field }) => (
          <Field data-invalid={Boolean(erros?.nome)}>
            <FieldLabel htmlFor={`${prefixo}-nome`}>Nome do grupo</FieldLabel>
            <Input
              {...field}
              id={`${prefixo}-nome`}
              placeholder="Ex.: Borda, 2º sabor, Adicionais"
            />
            {erros?.nome && <FieldError>{erros.nome.message}</FieldError>}
          </Field>
        )}
      />
      <div className="grid grid-cols-3 gap-2">
        <CampoInteiro
          control={control}
          nome={`grupos.${indice}.minimo`}
          rotulo="Mínimo"
          id={`${prefixo}-minimo`}
          erro={erros?.minimo?.message}
        />
        <CampoInteiro
          control={control}
          nome={`grupos.${indice}.maximo`}
          rotulo="Máximo"
          id={`${prefixo}-maximo`}
          erro={erros?.maximo?.message}
        />
        <CampoInteiro
          control={control}
          nome={`grupos.${indice}.gratisAte`}
          rotulo="Grátis até"
          id={`${prefixo}-gratis`}
          erro={erros?.gratisAte?.message}
        />
      </div>
      <FieldDescription>
        Mínimo 0 deixa o grupo opcional. Os grátis não cobram o adicional.
      </FieldDescription>

      <ul className="flex flex-col gap-2">
        {itens.fields.map((item, posicao) => (
          <li key={item.id} className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <Controller
              control={control}
              name={`grupos.${indice}.itens.${posicao}.nome`}
              render={({ field }) => (
                <Field className="flex-1" data-invalid={Boolean(erros?.itens?.[posicao]?.nome)}>
                  <FieldLabel htmlFor={`${prefixo}-item-${posicao}`} className="sr-only">
                    Nome da opção {posicao + 1}
                  </FieldLabel>
                  <Input
                    {...field}
                    id={`${prefixo}-item-${posicao}`}
                    placeholder={`Opção ${posicao + 1}`}
                  />
                </Field>
              )}
            />
            <div className="w-32">
              <CampoDinheiro
                control={control}
                nome={`grupos.${indice}.itens.${posicao}.precoAdicional`}
                rotulo={`Preço da opção ${posicao + 1}`}
                placeholder="Grátis"
                id={`${prefixo}-preco-${posicao}`}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover opção ${posicao + 1}`}
              onClick={() => itens.remove(posicao)}
            >
              <XIcon />
            </Button>
            {nomeDoProduto(valoresDosItens?.[posicao]?.produtoId) && (
              <span className="flex w-full items-center gap-1 text-xs text-muted-foreground">
                <LinkIcon className="size-3" aria-hidden="true" />
                Ligada a {nomeDoProduto(valoresDosItens?.[posicao]?.produtoId)}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() =>
                    itens.update(posicao, {
                      ...valoresDosItens[posicao],
                      produtoId: undefined,
                    })
                  }
                >
                  Desligar
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {erros?.itens?.message && <FieldError>{erros.itens.message}</FieldError>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          itens.append({ id: novoId("opc"), nome: "", precoAdicional: undefined, ativo: true })
        }
      >
        <PlusIcon data-icon="inline-start" />
        Adicionar opção
      </Button>
      {combos && (
        <EscolherProduto
          produtos={combos}
          aoEscolher={(produto) => {
            const opcao = opcaoDoProduto(produto, itens.fields.length + 1, () => novoId("opc"))
            itens.append({
              id: opcao.id,
              nome: opcao.nome,
              precoAdicional: opcao.precoAdicional,
              ativo: opcao.ativo,
              produtoId: opcao.produtoId,
            })
          }}
        />
      )}
    </fieldset>
  )
}

function Formulario({ produto, aoFechar }: { produto: Produto | undefined; aoFechar: () => void }) {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const campos = camposDoProduto(segmento)
  const { data: categorias = [] } = useCategorias()
  const { data: produtos = [] } = useProdutos()
  const { data: loja } = useLoja()
  const pracas = loja?.pracas ?? []
  const temCozinha = temModulo(segmento, "cozinha")
  const salvar = useSalvarProduto()
  const replicar = useReplicarOpcoes()
  const esquema = useMemo(() => esquemaProduto(segmento), [segmento])
  const [enviandoFoto, setEnviandoFoto] = useState(false)

  const { control, handleSubmit, watch, setValue, formState } = useForm<Valores>({
    resolver: zodResolver(esquema) as never,
    defaultValues: valoresIniciais(produto),
  })
  const grupos = useFieldArray({ control, name: "grupos", keyName: "chave" })
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const erros = formState.errors
  const imagem = watch("imagem")
  const oferta = watch("oferta")
  const categoriaId = watch("categoriaId")
  const pracaDaCategoria =
    pracas.find((praca) => praca.categoriaIds.includes(categoriaId))?.nome ?? "Geral"

  const aoArrastar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const de = grupos.fields.findIndex((grupo) => grupo.id === active.id)
    const para = grupos.fields.findIndex((grupo) => grupo.id === over.id)
    if (de >= 0 && para >= 0) grupos.move(de, para)
  }

  const enviar = handleSubmit((valores) => {
    const categoriaMudou = produto?.categoriaId !== valores.categoriaId
    const ordem =
      produto && !categoriaMudou
        ? produto.ordem
        : Math.max(
            0,
            ...produtos
              .filter((item) => item.categoriaId === valores.categoriaId)
              .map((item) => item.ordem),
          ) + 1
    const salvo: Produto = {
      id: produto?.id ?? novoId("prod"),
      categoriaId: valores.categoriaId,
      ...(valores.pracaId && valores.pracaId !== DA_CATEGORIA ? { pracaId: valores.pracaId } : {}),
      nome: valores.nome.trim(),
      descricao: valores.descricao.trim(),
      preco: valores.preco,
      ...(valores.oferta && valores.precoOriginal ? { precoOriginal: valores.precoOriginal } : {}),
      ...(campos.precoBalcao && valores.precoBalcao ? { precoBalcao: valores.precoBalcao } : {}),
      ...(valores.custo !== undefined ? { custo: valores.custo } : {}),
      ...(valores.imagem ? { imagem: valores.imagem } : {}),
      ativo: valores.ativo,
      disponivel: valores.disponivel,
      destaque: valores.destaque,
      oferta: valores.oferta,
      ordem,
      unidade: campos.unidade ? (valores.unidade ?? "un") : "un",
      ...(campos.duracao && valores.duracaoMin ? { duracaoMin: valores.duracaoMin } : {}),
      ...(temCozinha && valores.preparoMin ? { preparoMin: valores.preparoMin } : {}),
      ...(campos.video && valores.videoUrl ? { videoUrl: valores.videoUrl } : {}),
      // O que este formulário não edita continua como estava.
      ...(produto?.medicamento ? { medicamento: produto.medicamento } : {}),
      ...(produto?.estoque ? { estoque: produto.estoque } : {}),
      grupos: campos.grupos
        ? (valores.grupos ?? []).map((grupo, indiceGrupo) => ({
            ...grupo,
            nome: grupo.nome.trim(),
            ordem: indiceGrupo + 1,
            itens: grupo.itens.map((item, indiceItem) => ({
              ...item,
              nome: item.nome.trim(),
              // O esquema já troca vazio por 0; aqui é só para o tipo.
              precoAdicional: item.precoAdicional ?? 0,
              ordem: indiceItem + 1,
            })),
          }))
        : [],
    }
    salvar.mutate(salvo, {
      onSuccess: () => {
        toast.success("Produto salvo.")
        aoFechar()
      },
      onError: (erro) => toast.error(erro.message),
    })
  })

  const escolherFoto = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setEnviandoFoto(true)
    try {
      setValue("imagem", await prepararFoto(arquivo), { shouldDirty: true })
    } catch (erro) {
      toast.error((erro as Error).message)
    } finally {
      setEnviandoFoto(false)
    }
  }

  const faltando = formState.submitCount > 0 ? contarErros(erros) : 0

  return (
    <form onSubmit={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pt-5 pb-6">
        <Secao titulo="Sobre o produto">
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
              <Controller
                control={control}
                name="nome"
                render={({ field }) => (
                  <Field data-invalid={Boolean(erros.nome)}>
                    <FieldLabel htmlFor="produto-nome">Nome</FieldLabel>
                    <Input
                      {...field}
                      id="produto-nome"
                      maxLength={80}
                      aria-invalid={Boolean(erros.nome)}
                    />
                    {erros.nome && <FieldError>{erros.nome.message}</FieldError>}
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="categoriaId"
                render={({ field }) => (
                  <Field data-invalid={Boolean(erros.categoriaId)}>
                    <FieldLabel htmlFor="produto-categoria">Categoria</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="produto-categoria"
                        aria-label="Categoria"
                        aria-invalid={Boolean(erros.categoriaId)}
                        className="w-full"
                      >
                        <SelectValue placeholder="Escolha a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {categorias.map((categoria) => (
                            <SelectItem key={categoria.id} value={categoria.id}>
                              {categoria.nome}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {erros.categoriaId && <FieldError>{erros.categoriaId.message}</FieldError>}
                  </Field>
                )}
              />
            </div>
            {pracas.length > 0 && (
              <Controller
                control={control}
                name="pracaId"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="produto-praca">Praça</FieldLabel>
                    <Select value={field.value || DA_CATEGORIA} onValueChange={field.onChange}>
                      <SelectTrigger id="produto-praca" aria-label="Praça" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value={DA_CATEGORIA}>
                            Da categoria ({pracaDaCategoria})
                          </SelectItem>
                          {pracas.map((praca) => (
                            <SelectItem key={praca.id} value={praca.id}>
                              {praca.nome}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>Onde a cozinha prepara este produto.</FieldDescription>
                  </Field>
                )}
              />
            )}
            <Controller
              control={control}
              name="descricao"
              render={({ field }) => (
                <Field data-invalid={Boolean(erros.descricao)}>
                  <FieldLabel htmlFor="produto-descricao">Descrição</FieldLabel>
                  <Textarea {...field} id="produto-descricao" maxLength={300} rows={2} />
                  {erros.descricao && <FieldError>{erros.descricao.message}</FieldError>}
                </Field>
              )}
            />
            {campos.unidade && (
              <Controller
                control={control}
                name="unidade"
                render={({ field }) => (
                  <FieldSet>
                    <FieldLegend variant="label">Vendido por</FieldLegend>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-5"
                    >
                      <Field orientation="horizontal" className="w-auto">
                        <RadioGroupItem value="un" id="produto-unidade-un" />
                        <FieldLabel htmlFor="produto-unidade-un" className="font-normal">
                          Por unidade
                        </FieldLabel>
                      </Field>
                      <Field orientation="horizontal" className="w-auto">
                        <RadioGroupItem value="kg" id="produto-unidade-kg" />
                        <FieldLabel htmlFor="produto-unidade-kg" className="font-normal">
                          Por quilo
                        </FieldLabel>
                      </Field>
                    </RadioGroup>
                    <FieldDescription>
                      No quilo, o preço é o do quilo e o cliente escolhe o peso.
                    </FieldDescription>
                  </FieldSet>
                )}
              />
            )}
          </FieldGroup>
        </Secao>

        <Secao titulo="Valores">
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoDinheiro
              control={control}
              nome="preco"
              rotulo="Preço"
              id="produto-preco"
              erro={erros.preco?.message}
            />
            {campos.precoBalcao && (
              <CampoDinheiro
                control={control}
                nome="precoBalcao"
                rotulo="Preço de balcão"
                id="produto-balcao"
                erro={erros.precoBalcao?.message}
              />
            )}
            <CampoDinheiro
              control={control}
              nome="custo"
              rotulo="Custo"
              id="produto-custo"
              descricao="Para a margem. Em branco, o produto fica sem custo."
              erro={erros.custo?.message}
            />
            {campos.duracao && (
              <CampoInteiro
                control={control}
                nome="duracaoMin"
                rotulo="Duração (minutos)"
                id="produto-duracao"
                erro={erros.duracaoMin?.message}
              />
            )}
            {temCozinha && (
              <div className="sm:col-span-2">
                <RecursoPro
                  chave="cozinha.tempoPreparo"
                  compacto
                  descricao="Quanto o produto leva na cozinha: cada item diz quando começar para tudo ficar pronto junto."
                >
                  <CampoInteiro
                    control={control}
                    nome="preparoMin"
                    rotulo="Tempo de preparo (min)"
                    id="produto-preparo"
                    erro={erros.preparoMin?.message}
                  />
                </RecursoPro>
              </div>
            )}
          </div>
        </Secao>

        <Secao titulo={campos.video ? "Foto e vídeo" : "Foto"}>
          <FieldSet>
            <FieldLegend variant="label" className="sr-only">
              Foto
            </FieldLegend>
            <div className="flex flex-wrap items-center gap-3">
              {imagem ? (
                <Image
                  src={imagem}
                  alt="Foto do produto"
                  width={64}
                  height={64}
                  unoptimized={imagem.startsWith("data:")}
                  className="size-16 rounded-lg object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-16 items-center justify-center rounded-lg bg-foreground/[0.04] text-muted-foreground"
                >
                  <ImageUpIcon className="size-5" />
                </span>
              )}
              <Button asChild variant="outline" size="sm" disabled={enviandoFoto}>
                <label className="cursor-pointer">
                  <ImageUpIcon data-icon="inline-start" />
                  {enviandoFoto ? "Preparando…" : imagem ? "Trocar foto" : "Enviar foto"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(evento) => escolherFoto(evento.target.files?.[0])}
                  />
                </label>
              </Button>
              {imagem && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setValue("imagem", undefined)}
                >
                  Remover foto
                </Button>
              )}
            </div>
          </FieldSet>
          {campos.video && (
            <Controller
              control={control}
              name="videoUrl"
              render={({ field }) => (
                <Field data-invalid={Boolean(erros.videoUrl)}>
                  <FieldLabel htmlFor="produto-video">Link do vídeo</FieldLabel>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    id="produto-video"
                    type="url"
                    placeholder="https://"
                  />
                  <FieldDescription>YouTube, Shorts ou Reels.</FieldDescription>
                  {erros.videoUrl && <FieldError>{erros.videoUrl.message}</FieldError>}
                </Field>
              )}
            />
          )}
        </Secao>

        <Secao titulo="No cardápio">
          <FieldSet>
            <FieldLegend variant="label" className="sr-only">
              No cardápio
            </FieldLegend>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {(
                [
                  ["disponivel", "Disponível", "Desligado, aparece como esgotado."],
                  ["ativo", "Visível", "Desligado, some do cardápio."],
                  ["destaque", "Destaque", "Entra na vitrine de destaques."],
                  ["oferta", "Oferta", "Mostra o preço “de” riscado e o desconto."],
                ] as const
              ).map(([nome, rotulo, descricao]) => (
                <Controller
                  key={nome}
                  control={control}
                  name={nome}
                  render={({ field }) => (
                    <Field orientation="horizontal" className="items-start">
                      <Switch
                        id={`produto-${nome}`}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5"
                      />
                      <div className="flex flex-col gap-0.5">
                        <FieldLabel htmlFor={`produto-${nome}`}>{rotulo}</FieldLabel>
                        <FieldDescription>{descricao}</FieldDescription>
                      </div>
                    </Field>
                  )}
                />
              ))}
            </div>
          </FieldSet>
          {/* Ao ligar a oferta, o preço "de" aparece logo abaixo da chave. */}
          {oferta && (
            <div className="sm:max-w-[calc(50%-0.75rem)]">
              <CampoDinheiro
                control={control}
                nome="precoOriginal"
                rotulo="Preço “de”"
                id="produto-original"
                erro={erros.precoOriginal?.message}
              />
            </div>
          )}
        </Secao>

        {campos.grupos && (
          <fieldset
            aria-label="Grupos de opções"
            className="flex flex-col gap-4 border-t border-border/70 pt-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold tracking-[-0.01em]">Grupos de opções</h3>
                <p className="text-[13px] text-muted-foreground">
                  Borda, sabores, adicionais. Arraste ou use as setas para ordenar.
                </p>
              </div>
              {produto && grupos.fields.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="sm">
                      <CopyPlusIcon data-icon="inline-start" />
                      Usar na categoria toda
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Usar estas opções na categoria toda?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Os outros produtos da categoria passam a ter exatamente estes grupos. As
                        opções que eles têm hoje são substituídas. Salve antes, se mudou algo aqui.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          replicar.mutate(produto.id, {
                            onSuccess: (quantos) =>
                              toast.success(`Opções copiadas para ${quantos} produtos.`),
                          })
                        }
                      >
                        Usar na categoria
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <DndContext
              sensors={sensores}
              collisionDetection={closestCenter}
              onDragEnd={aoArrastar}
            >
              <SortableContext
                items={grupos.fields.map((grupo) => grupo.id)}
                strategy={verticalListSortingStrategy}
              >
                {grupos.fields.map((grupo, indice) => (
                  <GrupoDeOpcoes
                    key={grupo.chave}
                    control={control}
                    indice={indice}
                    total={grupos.fields.length}
                    idDoGrupo={grupo.id}
                    erros={erros.grupos?.[indice]}
                    aoMover={(destino) => grupos.move(indice, destino)}
                    aoRemover={() => grupos.remove(indice)}
                    combos={
                      temRecurso(segmento, "combosAutomaticos")
                        ? produtos.filter((item) => item.id !== produto?.id)
                        : null
                    }
                  />
                ))}
              </SortableContext>
            </DndContext>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                grupos.append({
                  id: novoId("grp"),
                  nome: "",
                  minimo: 0,
                  maximo: 1,
                  gratisAte: 0,
                  ativo: true,
                  itens: [{ id: novoId("opc"), nome: "", precoAdicional: undefined, ativo: true }],
                })
              }
            >
              <PlusIcon data-icon="inline-start" />
              Adicionar grupo
            </Button>
          </fieldset>
        )}
      </div>

      <SheetFooter className="gap-2 border-t border-border/70">
        {faltando > 0 && (
          <p role="alert" className="flex items-center gap-2 text-[13px] text-destructive">
            <Traco tom="cancelado" />
            {faltando === 1
              ? "Confira 1 campo antes de salvar."
              : `Confira ${faltando} campos antes de salvar.`}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 max-md:h-11" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            type="submit"
            className="flex-1 active:scale-[0.97] max-md:h-11"
            disabled={salvar.isPending}
          >
            Salvar produto
          </Button>
        </div>
      </SheetFooter>
    </form>
  )
}

/** Formulário do produto num painel: largo no computador, tela cheia no celular. */
export function FormularioProduto() {
  const [aberto, setAberto] = useProdutoAberto()
  const telaGrande = useTelaGrande()
  const { data: produtos, isPending } = useProdutos()
  const produto =
    aberto && aberto !== "novo" ? produtos?.find((item) => item.id === aberto) : undefined
  const pronto = aberto === "novo" || Boolean(produto)
  const fechar = () => setAberto(null)

  // Produto apagado ou de outro segmento: fecha em vez de abrir um formulário vazio.
  useEffect(() => {
    if (aberto && aberto !== "novo" && produtos && !produto) setAberto(null)
  }, [aberto, produtos, produto, setAberto])

  return (
    <Sheet open={aberto !== null} onOpenChange={(abrir) => !abrir && fechar()}>
      <SheetContent
        side={telaGrande ? "right" : "bottom"}
        className="gap-0 data-[side=bottom]:h-[95dvh] data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{produto ? `Editar produto: ${produto.nome}` : "Novo produto"}</SheetTitle>
          <SheetDescription>Os campos mudam conforme o segmento da loja.</SheetDescription>
        </SheetHeader>
        {pronto && !isPending ? (
          <Formulario key={aberto ?? ""} produto={produto} aoFechar={fechar} />
        ) : (
          <div role="status" aria-label="Carregando o produto" className="flex flex-col gap-3 p-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
