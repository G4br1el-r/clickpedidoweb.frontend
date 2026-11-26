import type { ListaControle, Tarja, TipoReceita } from "@/lib/admin/dados/tipos"
import { INFO_RECEITA } from "@/lib/admin/regras/farmacia"
import { cn } from "@/lib/utils"

/**
 * Os selos da farmácia seguem a etiqueta do painel: uma haste de 3 px na cor e o texto ao
 * lado, na tinta. A cor aqui é a da caixa (tarja) ou a do papel da receita, não um status:
 * por isso a haste é própria, sem o `data-traco` dos tons de situação.
 */
function Haste({ cor }: { cor: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-3.5 w-[3px] shrink-0 rounded-full", cor)}
    />
  )
}

const TARJAS: Record<Tarja, { rotulo: string; faixa: string }> = {
  "sem-tarja": { rotulo: "Venda livre", faixa: "bg-muted-foreground/40" },
  vermelha: { rotulo: "Tarja vermelha", faixa: "bg-red-600 dark:bg-red-500" },
  "vermelha-retencao": {
    rotulo: "Tarja vermelha · retém receita",
    faixa: "bg-red-600 dark:bg-red-500",
  },
  preta: { rotulo: "Tarja preta", faixa: "bg-neutral-950 dark:bg-neutral-200" },
}

/** A tarja da caixa, com a haste na cor dela. */
export function SeloTarja({ tarja, className }: { tarja: Tarja; className?: string }) {
  const { rotulo, faixa } = TARJAS[tarja]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs leading-none font-medium whitespace-nowrap",
        tarja === "sem-tarja" && "text-muted-foreground",
        className,
      )}
    >
      <Haste cor={faixa} />
      {rotulo}
    </span>
  )
}

/** Cor do papel: notificação A é amarela; B, azul; o resto, branca (haste neutra). */
const PAPEL: Record<TipoReceita, string> = {
  simples: "bg-foreground/25",
  antimicrobiano: "bg-foreground/25",
  "controle-especial": "bg-foreground/25",
  "notificacao-b": "bg-sky-500 dark:bg-sky-400",
  "notificacao-a": "bg-amber-400 dark:bg-amber-300",
}

export function SeloReceita({ tipo }: { tipo: TipoReceita }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs leading-none font-medium whitespace-nowrap text-foreground">
      <Haste cor={PAPEL[tipo]} />
      {INFO_RECEITA[tipo].nome}
    </span>
  )
}

/** A lista da Portaria 344 (B1, C1…) ou ATM: um código curto, em fonte de máquina. */
export function SeloLista({ lista }: { lista: ListaControle }) {
  return (
    <span className="inline-flex h-5 items-center rounded-[5px] bg-foreground/[0.06] px-1.5 font-mono text-xs font-medium text-foreground">
      {lista === "antimicrobiano" ? "ATM" : lista}
    </span>
  )
}
