import type { CorDePraca } from "@/lib/admin/dados/tipos"
import { cn } from "@/lib/utils"

/** Cor de cada praça, dos tons de `app/admin/admin.css` (claro e escuro). */
const COR: Record<CorDePraca, string> = {
  ambar: "bg-(--tom-preparo)",
  verde: "bg-(--tom-pronto)",
  azul: "bg-(--tom-caminho)",
  roxo: "bg-(--tom-espera)",
  rosa: "bg-(--praca-rosa)",
  cinza: "bg-(--tom-fim)",
}

export const NOME_DA_COR: Record<CorDePraca, string> = {
  ambar: "Âmbar",
  verde: "Verde",
  azul: "Azul",
  roxo: "Roxo",
  rosa: "Rosa",
  cinza: "Cinza",
}

/** O traço de 3 px na cor da praça, como o traço de status do painel. */
export function TracoDePraca({ cor, className }: { cor: CorDePraca; className?: string }) {
  return (
    <span
      data-traco=""
      data-cor={cor}
      aria-hidden="true"
      className={cn("inline-block h-3.5 w-[3px] shrink-0 rounded-full", COR[cor], className)}
    />
  )
}
