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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
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

function LinhaCategoria({
  categoria,
  produtos,
  anterior,
  proxima,
}: {
  categoria: Categoria
  produtos: number
  anterior?: Categoria
  proxima?: Categoria
}) {
  const ordenavel = useSortable({ id: categoria.id })
  const salvar = useSalvarCategoria()
  const reordenar = useReordenarCategorias()
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
    <li
      ref={ordenavel.setNodeRef}
      style={{
        transform: CSS.Transform.toString(ordenavel.transform),
        transition: ordenavel.transition,
      }}
      aria-label={categoria.nome}
      className={cn(
        "flex flex-wrap items-center gap-2 bg-card px-3 py-2 sm:flex-nowrap",
        ordenavel.isDragging && "relative z-10 shadow-lg",
      )}
    >
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
        className="h-8 min-w-40 flex-1"
      />
      <Badge variant="secondary" className="tabular-nums">
        {plural(produtos, "produto", "produtos")}
      </Badge>
      <div className="flex items-center gap-1.5">
        <Switch
          id={`${categoria.id}-visivel`}
          checked={categoria.ativa}
          onCheckedChange={(ativa) => salvar.mutate({ ...categoria, ativa })}
        />
        <Label htmlFor={`${categoria.id}-visivel`} className="cursor-pointer text-xs font-normal">
          Visível
        </Label>
      </div>
      <div className="flex">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Subir"
          disabled={!anterior}
          onClick={() => anterior && reordenar.mutate({ de: categoria.id, para: anterior.id })}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Descer"
          disabled={!proxima}
          onClick={() => proxima && reordenar.mutate({ de: categoria.id, para: proxima.id })}
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
    </li>
  )
}

/** Categorias do cardápio: a ordem aqui é a ordem das abas que o cliente vê. */
export function PaginaCategorias() {
  const { data: categorias } = useCategorias()
  const { data: produtos = [] } = useProdutos()
  const criar = useCriarCategoria()
  const reordenar = useReordenarCategorias()
  const [nova, setNova] = useState("")
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

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <Button asChild variant="link" size="sm" className="self-start px-0">
          <Link href="/admin/cardapio">
            <ArrowLeftIcon data-icon="inline-start" />
            Cardápio
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
        <p className="text-sm text-muted-foreground">
          A ordem daqui é a ordem das abas no cardápio. Arraste ou use as setas.
        </p>
      </div>

      <form
        className="flex max-w-md items-end gap-2"
        onSubmit={(evento) => {
          evento.preventDefault()
          adicionar()
        }}
      >
        <Field className="flex-1">
          <FieldLabel htmlFor="nova-categoria">Nova categoria</FieldLabel>
          <Input
            id="nova-categoria"
            value={nova}
            maxLength={60}
            placeholder="Ex.: Pastéis doces"
            onChange={(evento) => setNova(evento.target.value)}
          />
        </Field>
        <Button type="submit" disabled={criar.isPending}>
          <PlusIcon data-icon="inline-start" />
          Adicionar
        </Button>
      </form>

      {!categorias ? (
        <Skeleton role="status" aria-label="Carregando as categorias" className="h-72 rounded-xl" />
      ) : (
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoArrastar}>
          <SortableContext
            items={categorias.map((categoria) => categoria.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="divide-y overflow-hidden rounded-xl border">
              {categorias.map((categoria, indice) => (
                <LinhaCategoria
                  key={categoria.id}
                  categoria={categoria}
                  produtos={
                    produtos.filter((produto) => produto.categoriaId === categoria.id).length
                  }
                  anterior={categorias[indice - 1]}
                  proxima={categorias[indice + 1]}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
