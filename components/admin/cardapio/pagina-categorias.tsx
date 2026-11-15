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
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  GripVerticalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useEffect, useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  useCategorias,
  useCriarCategoria,
  useExcluirCategoria,
  useProdutos,
  useReordenarCategorias,
  useSalvarCategoria,
} from "@/lib/admin/dados/consultas-cardapio"
import type { Categoria } from "@/lib/admin/dados/tipos"
import { plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { CabecalhoPagina } from "../cabecalho-pagina"

/** Botão de ícone da linha: 32 px no computador, 44 px no celular. */
const BOTAO_ICONE = "max-md:size-11"

function LinhaCategoria({
  categoria,
  posicao,
  produtos,
  anterior,
  proxima,
  animarLugar,
  aoMover,
}: {
  categoria: Categoria
  /** Posição na ordem das abas, a partir de 1. */
  posicao: number
  produtos: number
  anterior?: Categoria
  proxima?: Categoria
  /** Troca de lugar pelos botões desliza; no arrasto quem anima é o próprio arrasto. */
  animarLugar: boolean
  aoMover: (para: Categoria, direcao: "subiu" | "desceu") => void
}) {
  const ordenavel = useSortable({ id: categoria.id })
  const salvar = useSalvarCategoria()
  const excluir = useExcluirCategoria()
  const [nome, setNome] = useState(categoria.nome)
  useEffect(() => setNome(categoria.nome), [categoria.nome])

  const salvarNome = () => {
    if (nome.trim() === categoria.nome) return setNome(categoria.nome)
    salvar.mutate(
      { ...categoria, nome },
      {
        onSuccess: () => toast.success("Categoria salva."),
        onError: (erro) => {
          toast.error(erro.message)
          setNome(categoria.nome)
        },
      },
    )
  }

  return (
    <motion.li
      layout={animarLugar ? "position" : false}
      transition={{ layout: { duration: 0.25, ease: [0.23, 1, 0.32, 1] } }}
      aria-label={categoria.nome}
      className="relative bg-card"
    >
      {/* O arrasto move o conteúdo; a troca pelos botões move a linha inteira (acima). */}
      <div
        ref={ordenavel.setNodeRef}
        style={{
          transform: CSS.Transform.toString(ordenavel.transform),
          transition: ordenavel.transition,
        }}
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 bg-card py-2 sm:flex-nowrap",
          ordenavel.isDragging &&
            "relative z-10 rounded-lg shadow-[0_8px_24px_rgb(0_0_0/0.12)] ring-1 ring-border/80",
        )}
      >
        <div className="flex min-w-0 flex-1 basis-full items-center gap-1 sm:basis-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Arrastar para reordenar"
            className={cn("cursor-grab touch-none text-muted-foreground", BOTAO_ICONE)}
            {...ordenavel.attributes}
            {...ordenavel.listeners}
          >
            <GripVerticalIcon />
          </Button>
          <span
            aria-hidden="true"
            className="w-6 shrink-0 text-right text-[13px] font-medium text-muted-foreground tabular-nums"
          >
            {posicao}
          </span>
          <Input
            aria-label="Nome da categoria"
            value={nome}
            maxLength={60}
            onChange={(evento) => setNome(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault()
                salvarNome()
              } else if (evento.key === "Escape") {
                setNome(categoria.nome)
              }
            }}
            onBlur={salvarNome}
            className={cn(
              // Parece texto até passar o mouse ou focar: a lista continua limpa.
              "h-9 min-w-0 flex-1 border-transparent bg-transparent font-medium shadow-none transition-[border-color,background-color,opacity] duration-150 hover:border-border focus-visible:bg-background md:h-8",
              !categoria.ativa && "text-muted-foreground",
            )}
          />
        </div>

        <span className="text-[13px] whitespace-nowrap text-muted-foreground tabular-nums max-sm:pl-3 sm:w-24 sm:text-right">
          {plural(produtos, "produto", "produtos")}
        </span>
        <div className="flex items-center gap-2">
          <Switch
            id={`${categoria.id}-visivel`}
            checked={categoria.ativa}
            onCheckedChange={(ativa) => salvar.mutate({ ...categoria, ativa })}
          />
          <Label
            htmlFor={`${categoria.id}-visivel`}
            className={cn(
              "min-h-11 cursor-pointer text-[13px] font-normal md:min-h-8",
              !categoria.ativa && "text-muted-foreground",
            )}
          >
            Visível
          </Label>
        </div>
        <div className="ml-auto flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Subir"
            className={BOTAO_ICONE}
            disabled={!anterior}
            onClick={() => anterior && aoMover(anterior, "subiu")}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Descer"
            className={BOTAO_ICONE}
            disabled={!proxima}
            onClick={() => proxima && aoMover(proxima, "desceu")}
          >
            <ArrowDownIcon />
          </Button>
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* O span recebe a dica mesmo com o botão desligado. */}
                <span>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Excluir"
                      className={BOTAO_ICONE}
                      disabled={produtos > 0}
                    >
                      <Trash2Icon />
                    </Button>
                  </AlertDialogTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {produtos > 0 ? "Mova ou exclua os produtos antes" : "Excluir"}
              </TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir a categoria {categoria.nome}?</AlertDialogTitle>
                <AlertDialogDescription>Ela está vazia e sai do cardápio.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() =>
                    excluir
                      .mutateAsync(categoria.id)
                      .then(() => toast.success("Categoria excluída."))
                      .catch((erro: Error) => toast.error(erro.message))
                  }
                >
                  Sim, excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </motion.li>
  )
}

function EsqueletoCategorias() {
  return (
    <div
      role="status"
      aria-label="Carregando as categorias"
      className="flex flex-col divide-y divide-border/70 border-y border-border/70"
    >
      {["a", "b", "c", "d", "e", "f"].map((chave) => (
        <div key={chave} className="flex items-center gap-3 py-3">
          <Skeleton className="size-5" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ml-auto h-4 w-20" />
          <Skeleton className="hidden h-5 w-24 sm:block" />
        </div>
      ))}
    </div>
  )
}

/** Categorias do cardápio: a ordem aqui é a ordem das abas que o cliente vê. */
export function PaginaCategorias() {
  const { data: categorias } = useCategorias()
  const { data: produtos = [] } = useProdutos()
  const criar = useCriarCategoria()
  const reordenar = useReordenarCategorias()
  const semMovimento = useReducedMotion()
  const [nova, setNova] = useState("")
  const [aviso, setAviso] = useState("")
  // Quem mudou a ordem: pelos botões a linha desliza; no arrasto, o dnd-kit já animou.
  const [modo, setModo] = useState<"botao" | "arrasto">("botao")
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const adicionar = () =>
    criar.mutate(nova, {
      onSuccess: () => setNova(""),
      onError: (erro) => toast.error(erro.message),
    })

  const aoArrastar = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id)
      reordenar.mutate({ de: String(active.id), para: String(over.id) })
  }

  const total = categorias?.length ?? 0

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Categorias"
        resumo="A ordem daqui é a ordem das abas no cardápio. Arraste ou use as setas; clique no nome para renomear."
        acoes={
          <Button asChild variant="outline" size="sm" className="max-md:h-11">
            <Link href="/admin/cardapio">
              <ArrowLeftIcon data-icon="inline-start" />
              Cardápio
            </Link>
          </Button>
        }
      />

      <form
        className="flex max-w-md flex-col gap-2"
        onSubmit={(evento) => {
          evento.preventDefault()
          adicionar()
        }}
      >
        <Label htmlFor="nova-categoria" className="text-[13px]">
          Nova categoria
        </Label>
        <div className="flex gap-2">
          <Input
            id="nova-categoria"
            value={nova}
            maxLength={60}
            placeholder="Ex.: Pastéis doces"
            className="max-md:h-11"
            onChange={(evento) => setNova(evento.target.value)}
          />
          <Button
            type="submit"
            disabled={criar.isPending}
            className="active:scale-[0.97] max-md:h-11"
          >
            <PlusIcon data-icon="inline-start" />
            Adicionar
          </Button>
        </div>
      </form>

      {!categorias ? (
        <EsqueletoCategorias />
      ) : (
        <DndContext
          sensors={sensores}
          collisionDetection={closestCenter}
          onDragStart={() => setModo("arrasto")}
          onDragEnd={aoArrastar}
        >
          <SortableContext
            items={categorias.map((categoria) => categoria.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col divide-y divide-border/70 border-y border-border/70">
              {categorias.map((categoria, indice) => (
                <LinhaCategoria
                  key={categoria.id}
                  categoria={categoria}
                  posicao={indice + 1}
                  produtos={
                    produtos.filter((produto) => produto.categoriaId === categoria.id).length
                  }
                  anterior={categorias[indice - 1]}
                  proxima={categorias[indice + 1]}
                  animarLugar={modo === "botao" && !semMovimento}
                  aoMover={(para, direcao) => {
                    setModo("botao")
                    reordenar.mutate({ de: categoria.id, para: para.id })
                    const destino = direcao === "subiu" ? indice : indice + 2
                    setAviso(`${categoria.nome} ${direcao} para a posição ${destino} de ${total}.`)
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <p role="status" className="sr-only">
        {aviso}
      </p>
    </div>
  )
}
