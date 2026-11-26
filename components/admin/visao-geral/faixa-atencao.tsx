import Link from "next/link"
import { useId } from "react"
import type { Alerta, AlertaId } from "@/lib/admin/regras/dashboard/alertas"
import type { TomStatus } from "@/lib/admin/regras/status"
import { Traco } from "../traco"

/** Vermelho para o que já passou da hora; âmbar para o resto (o laranja é só do "Chegou agora"). */
const TOM: Record<AlertaId, TomStatus> = {
  atrasados: "cancelado",
  "pagamento-pendente": "preparo",
  "estoque-zerado": "cancelado",
  "estoque-baixo": "preparo",
  lotes: "preparo",
  receitas: "preparo",
  pesagem: "preparo",
  "loja-fechada": "cancelado",
  "meta-em-risco": "preparo",
}

/** O que precisa de atenção agora. Some sozinha quando não há nada. */
export function FaixaAtencao({ alertas }: { alertas: Alerta[] }) {
  const id = useId()
  if (alertas.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em]">
        Precisa de atenção
      </h2>
      <ul className="flex flex-col border-y border-border/70">
        {alertas.map((alerta) => (
          <li
            key={alerta.id}
            className="flex items-center gap-3 border-border/70 py-3 text-sm not-first:border-t"
          >
            <Traco tom={TOM[alerta.id]} />
            <span className="min-w-0 flex-1">{alerta.texto}</span>
            <Link
              href={alerta.acao.href}
              className="alvo-toque relative shrink-0 font-medium underline-offset-4 hover:underline"
            >
              {alerta.acao.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
