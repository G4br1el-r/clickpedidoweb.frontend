"use client"

import { BikeIcon, MessageCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { AnimatePresence } from "motion/react"
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
import { plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { Traco } from "../traco"
import { AvisoSemEntrega } from "./aviso-sem-entrega"
import { ALVO_DE_TOQUE, EsqueletoLinhas, LinhaAnimada } from "./linha-animada"

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
          className="flex flex-col gap-5"
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
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="motoboy-nome">Nome</FieldLabel>
              <Input
                id="motoboy-nome"
                maxLength={60}
                autoComplete="off"
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
                className="tabular-nums"
                value={telefone}
                onValueChange={({ value }) => setTelefone(value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Excluir({ motoboy, aoExcluir }: { motoboy: Motoboy; aoExcluir: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={ALVO_DE_TOQUE}
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
          <AlertDialogAction variant="destructive" onClick={aoExcluir}>
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
  const salvar = useSalvarMotoboy()
  const [editando, setEditando] = useState<Motoboy | null | "novo">(null)
  const entregas = agora ? entregasDoDia(deHoje, agora) : new Map<string, number>()
  const aoErrar = (erro: Error) => toast.error(erro.message)
  const ativos = motoboys?.filter((motoboy) => motoboy.ativo).length ?? 0

  const excluirComDesfazer = (motoboy: Motoboy) =>
    excluir.mutate(motoboy.id, {
      onSuccess: () =>
        toast.success(`${motoboy.nome} excluído.`, {
          // Volta o mesmo cadastro, com o mesmo id: a Fila e os pedidos continuam batendo.
          action: {
            label: "Desfazer",
            onClick: () =>
              salvar.mutate(motoboy, {
                onSuccess: () => toast.success(`${motoboy.nome} voltou para a lista.`),
                onError: aoErrar,
              }),
          },
        }),
      onError: aoErrar,
    })

  return (
    <div className="flex w-full max-w-4xl flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Motoboys"
        resumo={
          motoboys && motoboys.length > 0
            ? `${plural(ativos, "ativo", "ativos")} de ${motoboys.length}. Só os ativos aparecem para escolher na Fila.`
            : "Só os ativos aparecem para escolher na Fila."
        }
        acoes={
          <Button type="button" onClick={() => setEditando("novo")}>
            <PlusIcon data-icon="inline-start" />
            Novo motoboy
          </Button>
        }
      />

      <AvisoSemEntrega />

      {!motoboys ? (
        <EsqueletoLinhas rotulo="Carregando os motoboys" linhas={4} />
      ) : motoboys.length === 0 ? (
        <Empty className="border border-border/70">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BikeIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum motoboy cadastrado</EmptyTitle>
            <EmptyDescription>
              Cadastre quem faz as entregas: na Fila, cada entrega vai para um deles, com o endereço
              pelo WhatsApp.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={() => setEditando("novo")}>
              <PlusIcon data-icon="inline-start" />
              Cadastrar o primeiro motoboy
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Table aria-label="Motoboys">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-0">Motoboy</TableHead>
              <TableHead className="text-right">
                <span className="sm:hidden">Hoje</span>
                <span className="hidden sm:inline">Entregas hoje</span>
              </TableHead>
              <TableHead className="w-16">Ativo</TableHead>
              <TableHead className="w-28 text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence initial={false}>
              {motoboys.map((motoboy) => (
                <LinhaAnimada key={motoboy.id}>
                  <TableCell className="py-2.5 pl-0">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className={cn(
                          "flex min-w-0 items-center gap-2 font-medium transition-colors duration-200",
                          !motoboy.ativo && "text-muted-foreground",
                        )}
                      >
                        <span className="truncate">{motoboy.nome}</span>
                        {/* Inativo: a haste curta da Etiqueta e o estado escrito, alinhados ao nome. */}
                        {!motoboy.ativo && (
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-normal">
                            <Traco tom="fim" className="h-3" />
                            Inativo
                          </span>
                        )}
                      </span>
                      <span className="text-[13px] text-muted-foreground tabular-nums">
                        {formatarTelefone(motoboy.telefone)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {entregas.get(motoboy.id) ?? 0}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={motoboy.ativo}
                      aria-label={`${motoboy.nome} ativo`}
                      onCheckedChange={() => alternar.mutate(motoboy.id, { onError: aoErrar })}
                    />
                  </TableCell>
                  <TableCell className="pr-0">
                    <div className="flex justify-end gap-2 sm:gap-1">
                      <Button asChild variant="ghost" size="icon-sm" className={ALVO_DE_TOQUE}>
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
                        className={ALVO_DE_TOQUE}
                        aria-label={`Editar ${motoboy.nome}`}
                        onClick={() => setEditando(motoboy)}
                      >
                        <PencilIcon />
                      </Button>
                      <Excluir motoboy={motoboy} aoExcluir={() => excluirComDesfazer(motoboy)} />
                    </div>
                  </TableCell>
                </LinhaAnimada>
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
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
