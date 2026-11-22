"use client"

import { useState } from "react"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useBloquearMesa } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa } from "@/lib/admin/dados/tipos"
import { devolverFocoA } from "./devolver-foco"

function Campos({ mesa, aoFechar }: { mesa: Pick<Mesa, "id" | "numero">; aoFechar: () => void }) {
  const bloquear = useBloquearMesa()
  const [motivo, setMotivo] = useState("")
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        bloquear.mutate(
          { id: mesa.id, ...(motivo.trim() ? { motivo } : {}) },
          {
            onSuccess: () => {
              toast.success(`Mesa ${mesa.numero} bloqueada.`)
              aoFechar()
            },
            onError: (erro) => toast.error(erro.message),
          },
        )
      }}
    >
      <DialogHeader>
        <DialogTitle>Bloquear mesa {mesa.numero}</DialogTitle>
        <DialogDescription>
          A mesa bloqueada sai de uso e não recebe comanda até ser desbloqueada.
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="mesa-motivo">Motivo (opcional)</FieldLabel>
        <Input
          id="mesa-motivo"
          maxLength={80}
          placeholder="Em manutenção, reservada para evento…"
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
        />
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={bloquear.isPending}>
          Bloquear
        </Button>
      </DialogFooter>
    </form>
  )
}

/** A janela do menu ⋯ para tirar a mesa de uso, com o motivo se a pessoa quiser dar. */
export function BloquearMesa({
  mesa,
  aberta,
  aoMudar,
  focoAoFechar,
}: {
  mesa: Pick<Mesa, "id" | "numero">
  aberta: boolean
  aoMudar: (aberta: boolean) => void
  /** Para onde o foco volta quando a janela fecha. */
  focoAoFechar?: HTMLElement | null
}) {
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-sm" onCloseAutoFocus={devolverFocoA(focoAoFechar)}>
        <Campos mesa={mesa} aoFechar={() => aoMudar(false)} />
      </DialogContent>
    </Dialog>
  )
}
