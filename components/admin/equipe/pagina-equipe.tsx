"use client"

import { EyeIcon, EyeOffIcon, PencilIcon, PlusIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useEquipe, useSalvarMembro } from "@/lib/admin/dados/consultas-equipe"
import type { MembroEquipe, PerfilAcesso } from "@/lib/admin/dados/tipos"
import { TITULO_PERFIL } from "@/lib/admin/regras/equipe"
import { plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { ALVO_DE_TOQUE, EsqueletoLinhas, LinhaAnimada } from "../entrega/linha-animada"
import { Traco } from "../traco"

const PERFIS: PerfilAcesso[] = ["dono", "gerente", "caixa"]

/** "4 pessoas · 1 dono, 1 gerente, 2 no caixa" */
function resumoDaEquipe(equipe: MembroEquipe[]) {
  const quantos = (perfil: PerfilAcesso) =>
    equipe.filter((membro) => membro.perfil === perfil).length
  return `${plural(equipe.length, "pessoa", "pessoas")} · ${plural(quantos("dono"), "dono", "donos")}, ${plural(quantos("gerente"), "gerente", "gerentes")}, ${quantos("caixa")} no caixa`
}

function JanelaMembro({
  membro,
  aoFechar,
}: {
  /** `null` para uma pessoa nova. */
  membro: MembroEquipe | null
  aoFechar: () => void
}) {
  const id = useId()
  const [nome, setNome] = useState(membro?.nome ?? "")
  const [perfil, setPerfil] = useState<PerfilAcesso>(membro?.perfil ?? "caixa")
  const [pin, setPin] = useState(membro?.pin ?? "")
  const [ativo, setAtivo] = useState(membro?.ativo ?? true)
  const salvar = useSalvarMembro()
  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <form
          className="flex flex-col gap-5"
          onSubmit={(evento) => {
            evento.preventDefault()
            salvar.mutate(
              { ...(membro ? { id: membro.id } : {}), nome, perfil, pin, ativo },
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
            <DialogTitle>{membro ? `Editar ${membro.nome}` : "Nova pessoa"}</DialogTitle>
            <DialogDescription>
              O PIN serve para entrar no painel e, para gerente e dono, autorizar ações no caixa.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor={`${id}-nome`}>Nome</FieldLabel>
              <Input
                id={`${id}-nome`}
                maxLength={40}
                autoComplete="off"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel id={`${id}-perfil`}>Perfil</FieldLabel>
              <ToggleGroup
                type="single"
                variant="segmento"
                aria-labelledby={`${id}-perfil`}
                value={perfil}
                onValueChange={(valor) => valor && setPerfil(valor as PerfilAcesso)}
              >
                {PERFIS.map((item) => (
                  <ToggleGroupItem key={item} value={item}>
                    {TITULO_PERFIL[item]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-pin`}>PIN</FieldLabel>
              <Input
                id={`${id}-pin`}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                className="tabular-nums"
                value={pin}
                onChange={(evento) => setPin(evento.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </Field>
            <Field orientation="horizontal">
              <Switch id={`${id}-ativo`} checked={ativo} onCheckedChange={setAtivo} />
              <FieldLabel htmlFor={`${id}-ativo`} className="font-normal">
                Pode entrar no painel
              </FieldLabel>
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

/** Quem usa o painel: perfil, PIN e quem está ativo. Só o dono vê esta página. */
export function PaginaEquipe() {
  const { data: equipe } = useEquipe()
  const salvar = useSalvarMembro()
  const [editando, setEditando] = useState<MembroEquipe | null | "novo">(null)
  const [pinVisivel, setPinVisivel] = useState<string>()

  return (
    <div className="flex w-full max-w-4xl flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Equipe"
        resumo={equipe ? resumoDaEquipe(equipe) : "Quem usa o painel e o caixa."}
        acoes={
          <Button type="button" onClick={() => setEditando("novo")}>
            <PlusIcon data-icon="inline-start" />
            Adicionar pessoa
          </Button>
        }
      />

      {!equipe ? (
        <EsqueletoLinhas rotulo="Carregando a equipe" linhas={4} />
      ) : (
        <Table aria-label="Equipe">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-0">Pessoa</TableHead>
              <TableHead>PIN</TableHead>
              <TableHead className="w-16">Ativa</TableHead>
              <TableHead className="w-14 text-right">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence initial={false}>
              {equipe.map((membro) => {
                const visivel = pinVisivel === membro.id
                return (
                  <LinhaAnimada key={membro.id}>
                    <TableCell className="py-2.5 pl-0">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span
                          className={cn(
                            "flex min-w-0 items-center gap-2 font-medium",
                            !membro.ativo && "text-muted-foreground",
                          )}
                        >
                          <span className="truncate">{membro.nome}</span>
                          {!membro.ativo && (
                            <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-normal">
                              <Traco tom="fim" className="h-3" />
                              Inativa
                            </span>
                          )}
                        </span>
                        <span className="text-[13px] text-muted-foreground">
                          {TITULO_PERFIL[membro.perfil]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-14 font-medium tabular-nums">
                          {visivel ? membro.pin : "••••"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className={ALVO_DE_TOQUE}
                          aria-label={`${visivel ? "Esconder" : "Mostrar"} PIN de ${membro.nome}`}
                          onClick={() => setPinVisivel(visivel ? undefined : membro.id)}
                        >
                          {visivel ? <EyeOffIcon /> : <EyeIcon />}
                        </Button>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={membro.ativo}
                        aria-label={`${membro.nome} ativa`}
                        onCheckedChange={(ativo) =>
                          salvar.mutate(
                            { ...membro, ativo },
                            { onError: (erro) => toast.error(erro.message) },
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="pr-0 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className={ALVO_DE_TOQUE}
                        aria-label={`Editar ${membro.nome}`}
                        onClick={() => setEditando(membro)}
                      >
                        <PencilIcon />
                      </Button>
                    </TableCell>
                  </LinhaAnimada>
                )
              })}
            </AnimatePresence>
          </TableBody>
        </Table>
      )}

      {editando && (
        <JanelaMembro
          membro={editando === "novo" ? null : editando}
          aoFechar={() => setEditando(null)}
        />
      )}
    </div>
  )
}
