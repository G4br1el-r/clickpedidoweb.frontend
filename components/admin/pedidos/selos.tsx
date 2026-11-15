import type { Pedido, SituacaoPagamento } from "@/lib/admin/dados/tipos"
import { rotuloStatus, tomDoStatus } from "@/lib/admin/regras/status"
import { cn } from "@/lib/utils"
import { Traco } from "../traco"

/**
 * Status do pedido como etiqueta: o traço na cor da etapa e o nome ao lado, na tinta.
 * Cancelado e concluído ficam no texto suave: já saíram da operação.
 */
export function SeloStatus({
  pedido,
  className,
}: {
  pedido: Pick<Pedido, "tipo" | "status">
  className?: string
}) {
  const tom = tomDoStatus(pedido.status)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[13px] leading-none font-medium whitespace-nowrap",
        tom === "fim" || tom === "cancelado" ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      <Traco tom={tom} />
      {rotuloStatus(pedido.tipo, pedido.status)}
    </span>
  )
}

const SITUACOES: Record<SituacaoPagamento, string> = {
  pago: "Pago",
  "na-entrega": "A cobrar",
  pendente: "Aguardando",
  cancelado: "Sem cobrança",
}

export const rotuloSituacao = (situacao: SituacaoPagamento) => SITUACOES[situacao]
