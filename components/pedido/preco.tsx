import { emReais } from "@/lib/formato"
import { cn } from "@/lib/utils"

/** O preço na linguagem da etiqueta da vitrine: o traço da cor da loja e o valor tabular. */
export function Preco({ valor, className }: { valor: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-2 tabular-nums", className)}>
      <span
        aria-hidden="true"
        className="h-3.5 w-[3px] shrink-0 self-center rounded-full bg-primary"
      />
      <span className="font-semibold tracking-[-0.01em]">{emReais(valor)}</span>
    </span>
  )
}
