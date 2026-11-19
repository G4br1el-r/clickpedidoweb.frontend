"use client"

import { SearchIcon } from "lucide-react"
import { parseAsArrayOf, parseAsBoolean, parseAsString, parseAsStringLiteral } from "nuqs"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { TipoPedido } from "@/lib/admin/dados/tipos"

const TIPOS: readonly TipoPedido[] = ["entrega", "retirada", "mesa", "atendimento"]

/** Busca e filtros rápidos da fila, no endereço da página: valem para todas as colunas. */
export const PARAMETROS_FILA = {
  busca: parseAsString.withDefault(""),
  canal: parseAsArrayOf(parseAsStringLiteral(TIPOS)).withDefault([]),
  naoPagos: parseAsBoolean.withDefault(false),
}

const ROTULO_CANAL: Record<TipoPedido, string> = {
  entrega: "Entrega",
  retirada: "Retirada",
  mesa: "Mesa",
  atendimento: "Salão",
}

/**
 * A busca (número, nome, telefone ou bairro) e os filtros rápidos por canal e "não pagos".
 * Os canais vêm do segmento: sem motoboys, não há Entrega para filtrar.
 */
export function FerramentasFila({
  busca,
  canais,
  canaisDoSegmento,
  naoPagos,
  aoMudar,
}: {
  busca: string
  canais: TipoPedido[]
  canaisDoSegmento: TipoPedido[]
  naoPagos: boolean
  aoMudar: (mudanca: { busca?: string; canal?: TipoPedido[]; naoPagos?: boolean }) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputGroup className="w-full sm:w-64">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label="Buscar pedido"
          placeholder="Número, nome, telefone ou bairro"
          value={busca}
          onChange={(evento) => aoMudar({ busca: evento.target.value })}
        />
      </InputGroup>
      {canaisDoSegmento.length > 1 && (
        <ToggleGroup
          type="multiple"
          variant="segmento"
          size="sm"
          aria-label="Canal"
          value={canais}
          onValueChange={(valor) => aoMudar({ canal: valor as TipoPedido[] })}
        >
          {canaisDoSegmento.map((tipo) => (
            <ToggleGroupItem key={tipo} value={tipo} className="cursor-pointer px-2.5 max-md:h-10">
              {ROTULO_CANAL[tipo]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <Toggle
        variant="outline"
        size="sm"
        pressed={naoPagos}
        onPressedChange={(ligado) => aoMudar({ naoPagos: ligado })}
        className="cursor-pointer max-md:h-10"
      >
        Não pagos
      </Toggle>
    </div>
  )
}
