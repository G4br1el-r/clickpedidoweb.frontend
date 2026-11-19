"use client"

import { toast } from "sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useDefinirAcrescimo } from "@/lib/admin/dados/consultas"
import type { ConfigLoja } from "@/lib/admin/dados/tipos"
import { prazoNaChegada } from "@/lib/admin/regras/prazo"

const ACRESCIMOS = [10, 15, 30]

/**
 * O prazo que o cliente recebe agora, por canal, e o acréscimo da hora: cozinha cheia,
 * +15 min para os pedidos que chegarem. Tocar de novo no mesmo volta ao normal.
 */
export function AjustePrazo({ loja, comEntrega }: { loja: ConfigLoja; comEntrega: boolean }) {
  const definir = useDefinirAcrescimo()
  const acrescimo = loja.acrescimoPrazoMin ?? 0
  const prazos = [
    comEntrega ? `Entrega ${prazoNaChegada(loja, "entrega")} min` : null,
    `Retirada ${prazoNaChegada(loja, "retirada")} min`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm">
        <span className="text-muted-foreground">Prazo </span>
        <span className="tabular-nums">{prazos}</span>
      </span>
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        spacing={0}
        aria-label="Acréscimo no prazo"
        value={acrescimo ? String(acrescimo) : ""}
        onValueChange={(valor) => {
          const minutos = Number(valor || 0)
          definir.mutate(minutos, {
            onSuccess: () =>
              toast(
                minutos
                  ? `Pedidos novos com +${minutos} min no prazo.`
                  : "Prazo de volta ao normal.",
              ),
            onError: (erro) => toast.error(erro.message),
          })
        }}
      >
        {ACRESCIMOS.map((minutos) => (
          <ToggleGroupItem
            key={minutos}
            value={String(minutos)}
            aria-label={`+${minutos} min`}
            className="tabular-nums"
          >
            +{minutos}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
