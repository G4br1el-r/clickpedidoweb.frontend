"use client"

import { PauseIcon, PlayIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePausar, useRetomar } from "@/lib/admin/dados/consultas"
import type { ConfigLoja, PausaPedidos as Pausa } from "@/lib/admin/dados/tipos"
import { pausaAtiva, textoDaPausa, textoDaVitrine } from "@/lib/admin/regras/pausa"

const DURACOES = [15, 30, 60]

/**
 * Cozinha cheia: pausa os pedidos (todos ou só os de entrega) por um tempo e volta sozinha.
 * Pausada, mostra até quando, o que o cliente vê e o botão de retomar antes.
 */
export function PausaPedidos({
  loja,
  agora,
  comEntrega,
}: {
  loja: ConfigLoja
  agora: Date
  comEntrega: boolean
}) {
  const pausar = usePausar()
  const retomar = useRetomar()
  const pausa = pausaAtiva(loja, agora)
  const avisoDeErro = { onError: (erro: Error) => toast.error(erro.message) }

  if (pausa) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex flex-col">
          <span className="text-sm font-medium tabular-nums">{textoDaPausa(pausa, agora)}</span>
          <span className="text-xs text-muted-foreground">
            O cliente vê: {textoDaVitrine(loja, agora).texto}
          </span>
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            retomar.mutate(undefined, {
              ...avisoDeErro,
              onSuccess: () => toast("Pedidos de volta."),
            })
          }
        >
          <PlayIcon data-icon="inline-start" />
          Retomar
        </Button>
      </div>
    )
  }

  const opcoes: { so: Pausa["so"]; rotulo: string }[] = [
    { so: "loja", rotulo: "Loja toda" },
    ...(comEntrega ? [{ so: "entrega" as const, rotulo: "Só a entrega" }] : []),
  ]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <PauseIcon data-icon="inline-start" />
          Pausar pedidos
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {opcoes.map(({ so, rotulo }, indice) => (
          <DropdownMenuGroup key={so}>
            {indice > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{rotulo}</DropdownMenuLabel>
            {DURACOES.map((minutos) => (
              <DropdownMenuItem
                key={minutos}
                aria-label={`${rotulo} por ${minutos} min`}
                onSelect={() =>
                  pausar.mutate(
                    { minutos, so },
                    {
                      ...avisoDeErro,
                      onSuccess: () =>
                        toast(
                          so === "loja"
                            ? `Pedidos pausados por ${minutos} min.`
                            : `Entrega pausada por ${minutos} min.`,
                        ),
                    },
                  )
                }
              >
                {minutos} min
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
