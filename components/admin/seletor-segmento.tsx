"use client"

import { ChevronsUpDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { buscarSegmento, ehSegmentoPainel, SEGMENTOS_PAINEL } from "@/lib/admin/segmentos-painel"

/** Troca o segmento que o painel mostra: o catálogo de demonstração. */
export function SeletorSegmento() {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const escolher = useSegmentoAtual((estado) => estado.escolher)
  const atual = buscarSegmento(segmento)
  const Icone = atual.icone

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Segmento: ${atual.nome}`}
          className="gap-1.5"
        >
          <Icone data-icon="inline-start" />
          <span className="hidden sm:inline">{atual.nome}</span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Ver o painel como
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={segmento}
          onValueChange={(valor) => {
            if (ehSegmentoPainel(valor)) escolher(valor)
          }}
        >
          {SEGMENTOS_PAINEL.map(({ id, nome, loja, icone: IconeItem }) => (
            <DropdownMenuRadioItem key={id} value={id} className="cursor-pointer gap-2.5 py-2">
              <IconeItem className="text-muted-foreground" />
              <span className="grid leading-tight">
                <span className="font-medium">{nome}</span>
                <span className="text-xs text-muted-foreground">{loja}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
