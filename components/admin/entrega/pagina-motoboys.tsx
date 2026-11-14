"use client"

import { BikeIcon, MessageCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { PatternFormat } from "react-number-format"
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
import { useAgora } from "@/hooks/use-agora"
import { useMotoboys, usePedidos } from "@/lib/admin/dados/consultas"
import {
  useAlternarMotoboy,
  useExcluirMotoboy,
  useSalvarMotoboy,
} from "@/lib/admin/dados/consultas-entrega"
import type { Motoboy } from "@/lib/admin/dados/tipos"
import { entregasDoDia } from "@/lib/admin/regras/loja"
import { formatarTelefone, linkWhatsApp } from "@/lib/admin/regras/mensagens"
import { AvisoSemEntrega } from "./aviso-sem-entrega"

function JanelaMotoboy({
  motoboy,
  aoFechar,
}: {
  /** `null` para um novo. */
  motoboy: Motoboy | null
  aoFechar: () => void
}) {
  const [nome, setNome] = useState(motoboy?.nome ?? "")
  const [telefone, setTelefone] = useState(motoboy?.telefone ?? "")
  const salvar = useSalvarMotoboy()
  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            salvar.mutate(
              { ...(motoboy ?? { ativo: true }), nome, telefone },
              {
                onSuccess: (salvo) => {
                  toast.success(`${salvo.nome} salvo.`)
                  aoFechar()
                },
                onError: (erro) => toast.error(erro.message),
              },
            )
          }}
        >
          <DialogHeader>
            <DialogTitle>{motoboy ? "Editar motoboy" : "Novo motoboy"}</DialogTitle>
            <DialogDescription>
              O WhatsApp recebe o endereço e o valor de cada entrega.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="motoboy-nome">Nome</FieldLabel>
              <Input
                id="motoboy-nome"
                maxLength={60}
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="motoboy-telefone">WhatsApp</FieldLabel>
              <PatternFormat
                id="motoboy-telefone"
                customInput={Input}
                format="(##) #####-####"
                mask="_"
                inputMode="tel"
                value={telefone}
                onValueChange={({ value }) => setTelefone(value)}
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

/** Motoboys da loja: quem está ativo, quantas entregas fez hoje e o atalho do WhatsApp. */
export function PaginaMotoboys() {
  const agora = useAgora(60_000)
  const { data: motoboys } = useMotoboys()
  const { data: deHoje = [] } = usePedidos(agora ? { de: agora, ate: agora } : undefined, {
    ativo: Boolean(agora),
  })
  const alternar = useAlternarMotoboy()
  const excluir = useExcluirMotoboy()
  const [editando, setEditando] = useState<Motoboy | null | "novo">(null)
  const entregas = agora ? entregasDoDia(deHoje, agora) : new Map<string, number>()
  const aoErrar = (erro: Error) => toast.error(erro.message)

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Motoboys</h1>
          <p className="text-sm text-muted-foreground">
            Só os ativos aparecem para escolher na Fila.
          </p>
        </div>
        <Button type="button" size="sm" className="ml-auto" onClick={() => setEditando("novo")}>
          <PlusIcon data-icon="inline-start" />
          Novo motoboy
        </Button>
      </div>

      <AvisoSemEntrega />

      {!motoboys ? (
        <Skeleton role="status" aria-label="Carregando os motoboys" className="h-48 rounded-xl" />
      ) : motoboys.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BikeIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum motoboy cadastrado</EmptyTitle>
            <EmptyDescription>
              Cadastre quem faz as entregas para escolher na Fila.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">WhatsApp</TableHead>
                <TableHead className="text-right">
                  <span className="sm:hidden">Hoje</span>
                  <span className="hidden sm:inline">Entregas hoje</span>
                </TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {motoboys.map((motoboy) => (
                <TableRow key={motoboy.id}>
                  <TableCell className="font-medium">{motoboy.nome}</TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {formatarTelefone(motoboy.telefone)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entregas.get(motoboy.id) ?? 0}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={motoboy.ativo}
                      aria-label={`${motoboy.nome} ativo`}
                      onCheckedChange={() => alternar.mutate(motoboy.id, { onError: aoErrar })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end sm:gap-1">
                      <Button asChild variant="ghost" size="icon-sm">
                        <a
                          href={linkWhatsApp(motoboy.telefone, "")}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Chamar ${motoboy.nome} no WhatsApp`}
                        >
                          <MessageCircleIcon />
                        </a>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${motoboy.nome}`}
                        onClick={() => setEditando(motoboy)}
                      >
                        <PencilIcon />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Excluir ${motoboy.nome}`}
                          >
                            <Trash2Icon />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir {motoboy.nome}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              As entregas que ele já fez continuam nos pedidos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() =>
                                excluir.mutate(motoboy.id, {
                                  onSuccess: () => toast.success(`${motoboy.nome} excluído.`),
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editando && (
        <JanelaMotoboy
          motoboy={editando === "novo" ? null : editando}
          aoFechar={() => setEditando(null)}
        />
      )}
    </div>
  )
}
