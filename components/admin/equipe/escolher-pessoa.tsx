"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { MembroEquipe } from "@/lib/admin/dados/tipos"
import { TITULO_PERFIL } from "@/lib/admin/regras/equipe"

/** Escolha de uma pessoa da equipe, com o perfil ao lado do nome. */
export function EscolherPessoa({
  id,
  rotulo,
  pessoas,
  valor,
  aoMudar,
}: {
  id: string
  rotulo: string
  pessoas: MembroEquipe[]
  valor: string
  aoMudar: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-rotulo`} className="text-sm font-medium">
        {rotulo}
      </span>
      <RadioGroup
        aria-labelledby={`${id}-rotulo`}
        value={valor}
        onValueChange={aoMudar}
        className="grid grid-cols-2 gap-2"
      >
        {pessoas.map((pessoa) => {
          const perfil = TITULO_PERFIL[pessoa.perfil]
          return (
            <Label
              key={pessoa.id}
              htmlFor={`${id}-${pessoa.id}`}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 shadow-[0_0_0_1px_var(--border)] has-data-checked:shadow-[0_0_0_2px_var(--foreground)]"
            >
              <RadioGroupItem
                value={pessoa.id}
                id={`${id}-${pessoa.id}`}
                aria-label={`${pessoa.nome} ${perfil}`}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{pessoa.nome}</span>
                <span className="text-xs font-normal text-muted-foreground">{perfil}</span>
              </span>
            </Label>
          )
        })}
      </RadioGroup>
    </div>
  )
}
