"use client"

import { useState } from "react"
import { toast } from "sonner"
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
import { FieldError } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { useJuntarMesas, useMesas } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { autorDaAcao } from "@/lib/admin/regras/historico"
import { numerosEmTexto } from "@/lib/admin/regras/movimentacoes"
import { useAvisoComDesfazer } from "./aviso-desfazer"
import { devolverFocoA } from "./devolver-foco"

function Campos({
  mesa,
  comanda,
  aoFechar,
}: {
  mesa: Mesa
  comanda: Pedido
  aoFechar: () => void
}) {
  const { data: mesas } = useMesas()
  const juntar = useJuntarMesas()
  const avisar = useAvisoComDesfazer()
  const por = useGarcom((estado) => estado.nome)
  const [marcadas, setMarcadas] = useState<string[]>([])
  const [tentou, setTentou] = useState(false)
  // A que já está junto de alguma não entra; a bloqueada também não.
  const candidatas = (mesas ?? []).filter(
    (outra) => outra.id !== mesa.id && !outra.bloqueio && !outra.juntadaCom,
  )
  const erro = tentou && marcadas.length === 0 ? "Escolha as mesas para juntar." : null
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        setTentou(true)
        if (marcadas.length === 0) return
        const numeros = candidatas
          .filter((outra) => marcadas.includes(outra.id))
          .map((outra) => outra.numero)
        juntar.mutate(
          { pedidoId: comanda.id, mesaIds: marcadas, ...autorDaAcao(por, comanda.mesa?.garcom) },
          {
            onSuccess: ({ desfazer }) => {
              avisar(
                `${numeros.length === 1 ? "Mesa" : "Mesas"} ${numerosEmTexto(numeros)} junto com a mesa ${mesa.numero}.`,
                desfazer,
              )
              aoFechar()
            },
            onError: (falha) => toast.error(falha.message),
          },
        )
      }}
    >
      <DialogHeader>
        <DialogTitle>Juntar à mesa {mesa.numero}</DialogTitle>
        <DialogDescription>
          A mesa {mesa.numero} fica com a comanda: as contas das mesas abertas entram nela, com as
          pessoas somadas.
        </DialogDescription>
      </DialogHeader>
      <fieldset aria-describedby={erro ? "juntar-erro" : undefined}>
        <legend className="sr-only">Mesas para juntar</legend>
        <ul className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
          {candidatas.map((outra) => (
            <li key={outra.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`juntar-${outra.id}`}
                checked={marcadas.includes(outra.id)}
                onCheckedChange={(marcado) =>
                  setMarcadas((atuais) =>
                    marcado ? [...atuais, outra.id] : atuais.filter((id) => id !== outra.id),
                  )
                }
              />
              <Label htmlFor={`juntar-${outra.id}`} className="font-normal">
                Mesa {outra.numero}{" "}
                <span className="text-muted-foreground">
                  · {outra.status === "ocupada" ? "aberta" : "livre"}
                </span>
              </Label>
            </li>
          ))}
        </ul>
        {erro && (
          <FieldError id="juntar-erro" className="mt-2">
            {erro}
          </FieldError>
        )}
      </fieldset>
      <DialogFooter>
        <Button type="submit" disabled={juntar.isPending}>
          Juntar
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Juntar mesas (Q7): a mesa da comanda fica com a conta única, e as outras "Com a mesa X". */
export function JuntarMesas({
  mesa,
  comanda,
  aberta,
  aoMudar,
  focoAoFechar,
}: {
  mesa: Mesa
  comanda: Pedido
  aberta: boolean
  aoMudar: (aberta: boolean) => void
  /** Para onde o foco volta quando a janela fecha (o botão ⋯ da mesa). */
  focoAoFechar?: HTMLElement | null
}) {
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent onCloseAutoFocus={devolverFocoA(focoAoFechar)} className="sm:max-w-md">
        <Campos mesa={mesa} comanda={comanda} aoFechar={() => aoMudar(false)} />
      </DialogContent>
    </Dialog>
  )
}
