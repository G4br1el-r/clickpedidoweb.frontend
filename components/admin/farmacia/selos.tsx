import { Badge } from "@/components/ui/badge"
import type { ListaControle, Tarja, TipoReceita } from "@/lib/admin/dados/tipos"
import { INFO_RECEITA } from "@/lib/admin/regras/farmacia"
import { cn } from "@/lib/utils"

const TARJAS: Record<Tarja, { rotulo: string; faixa: string }> = {
  "sem-tarja": { rotulo: "Venda livre", faixa: "bg-muted-foreground/40" },
  vermelha: { rotulo: "Tarja vermelha", faixa: "bg-red-600" },
  "vermelha-retencao": { rotulo: "Tarja vermelha · retém receita", faixa: "bg-red-600" },
  preta: { rotulo: "Tarja preta", faixa: "bg-neutral-950 dark:bg-neutral-200" },
}

/** A tarja da caixa, com a faixa na cor dela. */
export function SeloTarja({ tarja, className }: { tarja: Tarja; className?: string }) {
  const { rotulo, faixa } = TARJAS[tarja]
  return (
    <Badge variant="outline" className={cn("gap-1.5 pl-1.5", className)}>
      <span aria-hidden="true" className={cn("h-3 w-1.5 rounded-full", faixa)} />
      {rotulo}
    </Badge>
  )
}

/** Cor do papel: notificação A é amarela; B, azul; o resto, branca. */
const PAPEL: Record<TipoReceita, string> = {
  simples: "",
  antimicrobiano: "",
  "controle-especial": "",
  "notificacao-b":
    "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-400/40 dark:bg-sky-400/15 dark:text-sky-100",
  "notificacao-a":
    "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-100",
}

export function SeloReceita({ tipo }: { tipo: TipoReceita }) {
  return (
    <Badge variant="outline" className={PAPEL[tipo]}>
      {INFO_RECEITA[tipo].nome}
    </Badge>
  )
}

export function SeloLista({ lista }: { lista: ListaControle }) {
  return (
    <Badge variant="secondary" className="font-mono">
      {lista === "antimicrobiano" ? "ATM" : lista}
    </Badge>
  )
}
