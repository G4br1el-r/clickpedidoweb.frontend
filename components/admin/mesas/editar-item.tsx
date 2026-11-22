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
import { Textarea } from "@/components/ui/textarea"
import { useEditarItem } from "@/lib/admin/dados/consultas-mesas"
import type { ItemPedido } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"

/** Troca a observação do item enquanto a cozinha não preparou (Q29). */
export function EditarItem({
  pedidoId,
  item,
  aoFechar,
}: {
  pedidoId: number
  item: ItemPedido | null
  aoFechar: () => void
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        {item && <Campos key={item.id} pedidoId={pedidoId} item={item} aoFechar={aoFechar} />}
      </DialogContent>
    </Dialog>
  )
}

function Campos({
  pedidoId,
  item,
  aoFechar,
}: {
  pedidoId: number
  item: ItemPedido
  aoFechar: () => void
}) {
  const [observacao, setObservacao] = useState(item.observacao ?? "")
  const editar = useEditarItem()
  const por = useGarcom((estado) => estado.nome)
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault()
        editar.mutate(
          { pedidoId, itemId: item.id, observacao, ...(por.trim() ? { por } : {}) },
          { onSuccess: aoFechar, onError: (erro) => toast.error(erro.message) },
        )
      }}
    >
      <DialogHeader>
        <DialogTitle>Editar {item.nome}</DialogTitle>
        <DialogDescription>
          {item.opcoes.length > 0 ? item.opcoes.join(" · ") : "A cozinha ainda não preparou."}
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="editar-item-observacao">Observação</FieldLabel>
        <Textarea
          id="editar-item-observacao"
          rows={2}
          maxLength={140}
          placeholder="Ex.: sem cebola"
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
        />
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={editar.isPending}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}
