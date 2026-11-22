"use client"

import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import {
  type SituacaoDaImpressora,
  situacaoDaImpressora,
  textoDaImpressora,
} from "@/lib/admin/regras/impressora"
import type { TomStatus } from "@/lib/admin/regras/status"
import { Traco } from "../traco"

const TOM: Record<SituacaoDaImpressora, TomStatus> = {
  online: "pronto",
  offline: "cancelado",
  "sem-impressora": "fim",
}

/** A impressora deste aparelho na faixa de estado: online, offline ou sem impressora. */
export function IndicadorImpressora() {
  const impressora = usePreferenciasFila((estado) => estado.impressora)
  const agenteLigado = usePreferenciasFila((estado) => estado.agenteLigado)
  const situacao = situacaoDaImpressora({ impressora, agenteLigado })
  return (
    <span role="status" className="flex items-center gap-2 text-sm">
      <Traco tom={TOM[situacao]} />
      {textoDaImpressora(situacao)}
    </span>
  )
}
