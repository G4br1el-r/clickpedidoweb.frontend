"use client"

import { Checkbox } from "@/components/ui/checkbox"

/**
 * Marcador de seleção das listas em lote. O espaço em volta é o alvo de toque: 44 px no
 * celular, 24 px com mouse; o marcador fica no meio dele.
 */
export function MarcadorDaLinha({
  rotulo,
  checked,
  disabled,
  aoMudar,
}: {
  rotulo: string
  checked: boolean | "indeterminate"
  disabled?: boolean
  aoMudar: (marcar: boolean) => void
}) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center max-md:-my-2.5 max-md:-ml-2.5 md:size-6">
      <Checkbox
        aria-label={rotulo}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(marcar) => aoMudar(marcar === true)}
      />
    </span>
  )
}
