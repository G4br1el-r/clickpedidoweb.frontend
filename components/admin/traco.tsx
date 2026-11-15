import type { TomStatus } from "@/lib/admin/regras/status"
import { cn } from "@/lib/utils"

/** Cor de cada tom, definida em `app/admin/admin.css` para o claro e o escuro. */
const COR: Record<TomStatus, string> = {
  espera: "bg-(--tom-espera)",
  novo: "bg-(--tom-novo)",
  preparo: "bg-(--tom-preparo)",
  pronto: "bg-(--tom-pronto)",
  caminho: "bg-(--tom-caminho)",
  fim: "bg-(--tom-fim)",
  cancelado: "bg-(--tom-cancelado)",
}

/**
 * O traço da Etiqueta no painel: a haste de 3 px que, na vitrine, marca o preço e aqui marca
 * o estado. É o único detalhe colorido de um pedido; o texto ao lado continua na tinta.
 */
export function Traco({ tom, className }: { tom: TomStatus; className?: string }) {
  return (
    <span
      data-traco=""
      data-tom={tom}
      aria-hidden="true"
      className={cn(
        "inline-block h-3.5 w-[3px] shrink-0 rounded-full transition-colors duration-200 ease-saida",
        COR[tom],
        className,
      )}
    />
  )
}
