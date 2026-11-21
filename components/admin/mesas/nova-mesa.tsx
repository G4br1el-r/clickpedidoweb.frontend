"use client"

import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FormularioMesa } from "./formulario-mesa"

/** Botão de mesa nova: abre o formulário da mesa. */
export function NovaMesa() {
  const [aberta, setAberta] = useState(false)
  return (
    <>
      <Button type="button" size="sm" onClick={() => setAberta(true)}>
        <PlusIcon data-icon="inline-start" />
        Nova mesa
      </Button>
      <FormularioMesa aberta={aberta} aoMudar={setAberta} />
    </>
  )
}
