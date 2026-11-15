import { FileTextIcon, ShieldAlertIcon, SnowflakeIcon, StoreIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { DadosMedicamento, Tarja } from "@/lib/admin/dados/tipos"
import { comoVender, formatarRegistroMs, type ModoVenda } from "@/lib/farmacia"
import { cn } from "@/lib/utils"

const TARJAS: Record<Tarja, { rotulo: string; faixa: string } | null> = {
  "sem-tarja": null,
  vermelha: { rotulo: "Tarja vermelha", faixa: "bg-red-600" },
  "vermelha-retencao": { rotulo: "Tarja vermelha", faixa: "bg-red-600" },
  preta: { rotulo: "Tarja preta", faixa: "bg-neutral-950 dark:bg-neutral-200" },
}

const VENDA: Record<ModoVenda, { curto: string; aviso: string }> = {
  livre: {
    curto: "Sem receita",
    aviso: "Venda livre. Em caso de dúvida, pergunte à farmacêutica.",
  },
  receita: {
    curto: "Pede receita",
    aviso: "Você manda a foto da receita ao finalizar o pedido.",
  },
  "receita-retida": {
    curto: "Retém a receita",
    aviso:
      "Você manda a foto da receita ao finalizar. Na entrega, a via original fica com a farmácia.",
  },
  "so-balcao": {
    curto: "Só no balcão",
    aviso:
      "Controlado: a lei não permite venda pela internet. Leve a notificação de receita original ao balcão.",
  },
}

const TIPO = { referencia: "Referência", generico: "Genérico", similar: "Similar" } as const

/** Pílulas do cartão: a tarja (com a faixa na cor dela) e o que o pedido vai pedir. */
export function SeloRemedio({
  medicamento,
  className,
}: {
  medicamento: DadosMedicamento
  className?: string
}) {
  const tarja = TARJAS[medicamento.tarja]
  const venda = comoVender(medicamento)
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tarja && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium">
          <span aria-hidden="true" className={cn("h-3 w-1.5 rounded-full", tarja.faixa)} />
          {tarja.rotulo}
        </span>
      )}
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
          venda === "livre" && "bg-accent text-accent-foreground",
          (venda === "receita" || venda === "receita-retida") &&
            "bg-amber-100 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100",
          venda === "so-balcao" && "bg-muted text-foreground",
        )}
      >
        {VENDA[venda].curto}
      </span>
    </span>
  )
}

/** Um fato da ficha: o rótulo pequeno em cima, o valor embaixo. */
function Fato({
  rotulo,
  children,
  className,
}: {
  rotulo: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 py-2.5", className)}>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm font-medium wrap-anywhere">{children}</dd>
    </div>
  )
}

/**
 * Ficha do remédio, na folha do produto: o que a pessoa precisa saber antes de pedir.
 * Os fatos ficam numa régua entre fios, como na vitrine; o aviso do pedido fecha a ficha.
 */
export function InfoRemedio({ medicamento }: { medicamento: DadosMedicamento }) {
  const venda = comoVender(medicamento)
  const Icone =
    venda === "so-balcao" ? StoreIcon : venda === "livre" ? ShieldAlertIcon : FileTextIcon
  return (
    <div className="flex flex-col gap-3">
      <SeloRemedio medicamento={medicamento} />
      <dl className="grid grid-cols-2 border-y border-border/70">
        <Fato rotulo="Princípio ativo" className="col-span-2 border-b border-border/70">
          {medicamento.principioAtivo}
        </Fato>
        <Fato rotulo="Apresentação" className="pr-3">
          {medicamento.apresentacao}
        </Fato>
        <Fato rotulo="Tipo e laboratório" className="border-l border-border/70 pl-3">
          {TIPO[medicamento.tipo]} · {medicamento.laboratorio}
        </Fato>
        <Fato rotulo="Registro na Anvisa" className="col-span-2 border-t border-border/70">
          <span className="tabular-nums">MS {formatarRegistroMs(medicamento.registroMs)}</span>
        </Fato>
      </dl>
      {medicamento.refrigerado && (
        <p className="flex items-center gap-2 text-sm text-sky-700 dark:text-sky-300">
          <SnowflakeIcon className="size-4 shrink-0" aria-hidden="true" />
          Vai na bolsa térmica: guarde na geladeira, entre 2 °C e 8 °C.
        </p>
      )}
      <p
        className={cn(
          "flex items-start gap-2.5 rounded-xl p-3 text-sm leading-snug",
          venda === "livre"
            ? "bg-accent text-accent-foreground"
            : "bg-amber-50 text-amber-950 dark:bg-amber-400/10 dark:text-amber-100",
        )}
      >
        <Icone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {VENDA[venda].aviso}
      </p>
    </div>
  )
}
