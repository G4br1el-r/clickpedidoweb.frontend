import { Badge } from "@/components/ui/badge"
import type { Pedido, SituacaoPagamento } from "@/lib/admin/dados/tipos"
import { rotuloStatus } from "@/lib/admin/regras/status"

/** Selo do status do pedido: novo em destaque, cancelado apagado, o resto neutro. */
export function SeloStatus({ pedido }: { pedido: Pick<Pedido, "tipo" | "status"> }) {
  const variante =
    pedido.status === "recebido"
      ? "default"
      : pedido.status === "cancelado"
        ? "outline"
        : "secondary"
  return (
    <Badge
      variant={variante}
      className={pedido.status === "cancelado" ? "text-muted-foreground" : undefined}
    >
      {rotuloStatus(pedido.tipo, pedido.status)}
    </Badge>
  )
}

const SITUACOES: Record<SituacaoPagamento, string> = {
  pago: "Pago",
  "na-entrega": "A cobrar",
  pendente: "Aguardando",
  cancelado: "Sem cobrança",
}

export const rotuloSituacao = (situacao: SituacaoPagamento) => SITUACOES[situacao]
