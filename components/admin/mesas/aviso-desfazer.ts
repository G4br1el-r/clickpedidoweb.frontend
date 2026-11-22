"use client"

import { toast } from "sonner"
import { useDesfazer } from "@/lib/admin/dados/consultas-mesas"

/** O aviso fica 6 s na tela; o servidor guarda a foto por 10 s (Q46). */
const DURACAO_MS = 6_000

/**
 * O aviso de uma movimentação com "Desfazer". O desfazer segue mesmo se a tela que o pediu já
 * saiu (a gaveta fechou, a limpeza virou mesa livre): o aviso do resultado vem do próprio toast.
 */
export function useAvisoComDesfazer() {
  const desfazer = useDesfazer()
  return (texto: string, id: string) =>
    toast.success(texto, {
      duration: DURACAO_MS,
      action: {
        label: "Desfazer",
        onClick: () => {
          desfazer.mutateAsync(id).then(
            () => toast.success("Desfeito."),
            (erro: Error) => toast.error(erro.message),
          )
        },
      },
    })
}
