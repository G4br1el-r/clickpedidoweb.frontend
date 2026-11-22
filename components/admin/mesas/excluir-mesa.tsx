"use client"

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
import { useExcluirMesa } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa } from "@/lib/admin/dados/tipos"
import { devolverFocoA } from "./devolver-foco"

/** A pergunta antes de excluir a mesa, do menu ⋯ e da gaveta da mesa livre. */
export function ConfirmarExclusaoMesa({
  mesa,
  aberta,
  aoMudar,
  aoExcluir,
  focoAoFechar,
}: {
  mesa: Pick<Mesa, "id" | "numero">
  aberta: boolean
  aoMudar: (aberta: boolean) => void
  aoExcluir?: () => void
  /** Para onde o foco volta quando a pergunta fecha. */
  focoAoFechar?: HTMLElement | null
}) {
  const excluir = useExcluirMesa()
  return (
    <AlertDialog open={aberta} onOpenChange={aoMudar}>
      <AlertDialogContent onCloseAutoFocus={devolverFocoA(focoAoFechar)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir a mesa {mesa.numero}?</AlertDialogTitle>
          <AlertDialogDescription>
            Ela sai da grade e do Garçom. As contas já fechadas continuam nos pedidos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              excluir.mutate(mesa.id, {
                onSuccess: () => {
                  toast.success(`Mesa ${mesa.numero} excluída.`)
                  aoExcluir?.()
                },
                onError: (erro) => toast.error(erro.message),
              })
            }
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
