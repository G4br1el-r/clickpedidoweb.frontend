"use client"

import { ALargeSmallIcon, MinusIcon, PlusIcon } from "lucide-react"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"

/** A escala do quadro em cada tamanho: o 1 é o de fábrica. */
export const ESCALA_DO_QUADRO = [0.85, 1, 1.15, 1.3] as const

/** Tamanho do quadro e modo compacto, guardados neste aparelho. */
export function ExibicaoCozinha() {
  const tamanho = usePreferenciasFila((estado) => estado.tamanho)
  const compacto = usePreferenciasFila((estado) => estado.compacto)
  const mudarTamanho = usePreferenciasFila((estado) => estado.mudarTamanho)
  const ligarCompacto = usePreferenciasFila((estado) => estado.ligarCompacto)
  const idCompacto = useId()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ALargeSmallIcon data-icon="inline-start" />
          Exibição
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-60 flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Tamanho</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Diminuir o quadro"
              disabled={tamanho <= 0}
              onClick={() => mudarTamanho(-1)}
            >
              <MinusIcon />
            </Button>
            <span className="w-10 text-center text-sm tabular-nums">
              {Math.round(ESCALA_DO_QUADRO[tamanho] * 100)}%
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Aumentar o quadro"
              disabled={tamanho >= ESCALA_DO_QUADRO.length - 1}
              onClick={() => mudarTamanho(1)}
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={idCompacto} className="flex flex-col items-start gap-0.5">
            Compacto
            <span className="text-xs font-normal text-muted-foreground">
              Sem cliente e garçom, com menos espaço.
            </span>
          </Label>
          <Switch
            id={idCompacto}
            aria-label="Compacto"
            checked={compacto}
            onCheckedChange={ligarCompacto}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
