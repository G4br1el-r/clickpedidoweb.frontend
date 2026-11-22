"use client"

import { formatDistanceStrict } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import type { SituacaoMotoboy } from "@/lib/admin/regras/despacho"
import type { TomStatus } from "@/lib/admin/regras/status"
import { Traco } from "../traco"

const TOM: Record<SituacaoMotoboy["situacao"], TomStatus> = {
  "em-rota": "caminho",
  disponivel: "pronto",
  ausente: "fim",
}

function texto(situacao: SituacaoMotoboy, agora: Date) {
  if (situacao.situacao === "ausente") return "ausente"
  if (situacao.situacao === "em-rota") {
    const quantas = situacao.emRota.length
    return `em rota com ${quantas} ${quantas === 1 ? "entrega" : "entregas"}`
  }
  if (!situacao.livreDesde) return "disponível desde a abertura"
  return `disponível há ${formatDistanceStrict(new Date(situacao.livreDesde), agora, { locale: ptBR })}`
}

/**
 * Os motoboys no topo de "A caminho": quem está na rua (com quantas entregas), quem está livre
 * e há quanto tempo, e quem não está hoje. "Voltou" dá como entregue o que ele levava.
 */
export function PainelMotoboys({
  situacoes,
  agora,
  ocupado,
  aoVoltar,
}: {
  situacoes: SituacaoMotoboy[]
  agora: Date
  ocupado: boolean
  aoVoltar: (motoboyId: string) => void
}) {
  if (situacoes.length === 0) return null
  return (
    <ul aria-label="Motoboys" className="flex flex-col border-y border-border/70">
      {situacoes.map((situacao) => (
        <li
          key={situacao.motoboy.id}
          className="flex min-h-10 items-center gap-2 border-b border-border/70 py-1.5 last:border-b-0"
        >
          <Traco tom={TOM[situacao.situacao]} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium">{situacao.motoboy.nome}</span>
            <span className="truncate text-xs text-muted-foreground">{texto(situacao, agora)}</span>
          </span>
          {situacao.situacao === "em-rota" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={ocupado}
              aria-label={`${situacao.motoboy.nome} voltou`}
              onClick={() => aoVoltar(situacao.motoboy.id)}
            >
              Voltou
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
