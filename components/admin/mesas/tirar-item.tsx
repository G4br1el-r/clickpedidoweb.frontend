"use client"

import { useRef, useState } from "react"
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

/**
 * Pergunta antes de tirar o que a cozinha já preparou: o motivo é obrigatório (Q10, Q38).
 * Com `quantidade` ("Menos um"), pergunta "Tirar 1 Pizza?". Fecha só quando o servidor aceita:
 * se ele recusar, o motivo digitado continua ali.
 */
export function TirarItem({
  item,
  quantidade,
  aoMudar,
  aoTirar,
}: {
  item: ItemPedido | null
  quantidade?: number
  aoMudar: (aberto: boolean) => void
  /** Rejeita se o servidor recusar (o aviso de erro fica com quem chama). */
  aoTirar: (motivo: string) => Promise<unknown>
}) {
  const [motivo, setMotivo] = useState("")
  const [enviando, setEnviando] = useState(false)
  const campo = useRef<HTMLTextAreaElement>(null)
  return (
    <AlertDialog
      open={item !== null}
      onOpenChange={(aberto) => {
        if (!aberto) setMotivo("")
        aoMudar(aberto)
      }}
    >
      <AlertDialogContent
        onOpenAutoFocus={(evento) => {
          // Quem abriu veio dizer o motivo: o foco vai direto para o campo.
          evento.preventDefault()
          campo.current?.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {quantidade ? `Tirar ${quantidade} ${item?.nome}?` : `Tirar ${item?.nome} da comanda?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            A cozinha já preparou: o que sair não volta ao estoque e fica como perda.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor="tirar-motivo">Motivo</FieldLabel>
          <Textarea
            ref={campo}
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
            disabled={!motivo.trim() || enviando}
            onClick={(evento) => {
              evento.preventDefault()
              setEnviando(true)
              aoTirar(motivo.trim())
                .then(() => setMotivo(""))
                .catch(() => {})
                .finally(() => setEnviando(false))
            }}
          >
            Tirar da comanda
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
