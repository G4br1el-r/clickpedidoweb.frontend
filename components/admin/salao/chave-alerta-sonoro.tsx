"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  usePreferenciasCarregadas,
  usePreferenciasFila,
  useSomDoAparelho,
} from "@/lib/admin/preferencias-fila"
import { tocarAlerta } from "@/lib/admin/som"

/** O alerta sonoro deste aparelho: a mesma chave da Fila e da Cozinha. */
export function ChaveAlertaSonoro() {
  usePreferenciasCarregadas()
  const ligado = usePreferenciasFila((estado) => estado.somLigado)
  const ligarSom = usePreferenciasFila((estado) => estado.ligarSom)
  const tipoSom = useSomDoAparelho()
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="alerta-sonoro-salao"
        checked={ligado}
        onCheckedChange={(marcada) => {
          ligarSom(marcada)
          // O toque na chave libera o som no navegador.
          if (marcada) tocarAlerta(tipoSom)
        }}
      />
      <Label htmlFor="alerta-sonoro-salao" className="cursor-pointer">
        Alerta sonoro
      </Label>
    </div>
  )
}
