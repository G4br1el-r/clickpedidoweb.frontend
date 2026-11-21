"use client"

import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormularioMesa } from "./formulario-mesa"

/** Botão de mesa nova: abre o formulário da mesa. A página controla a janela (o atalho N abre). */
export function NovaMesa({
  aberta,
  aoMudar,
}: {
  aberta: boolean
  aoMudar: (aberta: boolean) => void
}) {
  return (
    <>
      <Button type="button" size="sm" onClick={() => aoMudar(true)}>
        <PlusIcon data-icon="inline-start" />
        Nova mesa
      </Button>
      <FormularioMesa aberta={aberta} aoMudar={aoMudar} />
    </>
  )
}
