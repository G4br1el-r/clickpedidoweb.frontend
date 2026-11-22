"use client"

import { useState } from "react"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { ItemPedido } from "@/lib/admin/dados/tipos"

/** Pergunta antes de tirar o que a cozinha já preparou: o motivo é obrigatório (Q10, Q38). */
export function TirarItem({
  item,
  aoMudar,
  aoTirar,
}: {
  item: ItemPedido | null
  aoMudar: (aberto: boolean) => void
  aoTirar: (motivo: string) => void
}) {
  const [motivo, setMotivo] = useState("")
  return (
    <AlertDialog
      open={item !== null}
      onOpenChange={(aberto) => {
        if (!aberto) setMotivo("")
        aoMudar(aberto)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tirar {item?.nome} da comanda?</AlertDialogTitle>
          <AlertDialogDescription>
            A cozinha já preparou: o que sair não volta ao estoque e fica como perda.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor="tirar-motivo">Motivo</FieldLabel>
          <Textarea
            id="tirar-motivo"
            rows={2}
            maxLength={140}
            placeholder="Ex.: caiu no chão"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!motivo.trim()}
            onClick={() => {
              aoTirar(motivo.trim())
              setMotivo("")
            }}
          >
            Tirar da comanda
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
