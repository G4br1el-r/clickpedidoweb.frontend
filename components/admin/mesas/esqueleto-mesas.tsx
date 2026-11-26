import { Skeleton } from "@/components/ui/skeleton"
import { atrasoEscalonado } from "@/lib/admin/movimento"

/** A mesma grade do salão: 2 colunas no celular, até 5 no desktop. */
export const GRADE_DE_MESAS =
  "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"

/**
 * Esqueleto da grade de mesas: cada mesa é um ladrilho com o número e o estado em cima, o
 * cliente no meio e o total embaixo. Entram em sequência e brilham; só o invólucro avisa o
 * leitor de tela.
 */
export function EsqueletoMesas({ quantidade = 10 }: { quantidade?: number }) {
  return (
    <div role="status" aria-label="Carregando as mesas" aria-busy="true" className={GRADE_DE_MESAS}>
      {Array.from({ length: quantidade }, (_, indice) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: ladrilhos de esqueleto não têm identidade.
          key={indice}
          data-testid="esqueleto-mesa"
          className="esqueleto-entra flex min-h-32 flex-col gap-2 rounded-xl border border-border/70 p-3"
          style={{ animationDelay: `${atrasoEscalonado(indice, { passo: 0.05 })}s` }}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3.5 w-14" />
          </div>
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="mt-auto h-4 w-full" />
        </div>
      ))}
    </div>
  )
}
