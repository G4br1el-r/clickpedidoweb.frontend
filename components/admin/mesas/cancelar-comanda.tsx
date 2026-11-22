"use client"

import { useRef, useState } from "react"
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
} from "@/components/ui/alert-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useCancelarComanda } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { autorDaAcao } from "@/lib/admin/regras/historico"

/** Cancela a comanda com itens (Q36): o motivo é obrigatório e vai para Pedidos. */
export function CancelarComanda({
  mesa,
  comanda,
  aberta,
  aoMudar,
  aoCancelar,
}: {
  mesa: Mesa
  comanda: Pedido
  aberta: boolean
  aoMudar: (aberta: boolean) => void
  aoCancelar: () => void
}) {
  const [motivo, setMotivo] = useState("")
  const cancelar = useCancelarComanda()
  const por = useGarcom((estado) => estado.nome)
  const campo = useRef<HTMLTextAreaElement>(null)
  return (
    <AlertDialog
      open={aberta}
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
          <AlertDialogTitle>Cancelar a comanda da mesa {mesa.numero}?</AlertDialogTitle>
          <AlertDialogDescription>
            A comanda vai para Pedidos como cancelada e a mesa fica livre. O que a cozinha já
            preparou fica como perda no estoque.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor="cancelar-comanda-motivo">Motivo</FieldLabel>
          <Textarea
            ref={campo}
            id="cancelar-comanda-motivo"
            rows={2}
            maxLength={140}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!motivo.trim() || cancelar.isPending}
            onClick={(evento) => {
              // Fecha só quando o servidor aceitar.
              evento.preventDefault()
              cancelar.mutate(
                { pedidoId: comanda.id, motivo, ...autorDaAcao(por, comanda.mesa?.garcom) },
                {
                  onSuccess: () => {
                    toast.success(`Comanda da mesa ${mesa.numero} cancelada.`)
                    setMotivo("")
                    aoMudar(false)
                    aoCancelar()
                  },
                  onError: (erro) => toast.error(erro.message),
                },
              )
            }}
          >
            Cancelar comanda
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
