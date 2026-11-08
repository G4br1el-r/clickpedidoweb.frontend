import { Skeleton } from "@/components/ui/skeleton"

const LINHAS = ["linha-1", "linha-2", "linha-3"]
const CARTOES = ["cartao-1", "cartao-2", "cartao-3"]

/** Mesmo formato do cardápio, para a tela não pular quando os dados chegam. */
export function CardapioSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando cardápio"
      className="flex flex-col gap-5 px-4 pt-4 md:px-6 md:pt-6"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-36" />
        <div className="flex gap-3 overflow-hidden">
          {CARTOES.map((chave) => (
            <div
              key={chave}
              className="flex w-[72vw] max-w-72 shrink-0 flex-col gap-2 md:w-1/3 md:max-w-none"
            >
              <Skeleton className="h-72 w-full rounded-3xl md:h-80" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {LINHAS.map((chave) => (
            <div
              key={chave}
              className="flex flex-col gap-2.5 rounded-3xl p-2.5 ring-1 ring-border/70 md:gap-3 md:p-3"
            >
              <div className="flex gap-3.5 md:gap-4">
                <Skeleton className="size-[88px] shrink-0 rounded-[18px] md:size-28" />
                <div className="flex flex-1 flex-col gap-2 pt-1">
                  <Skeleton className="h-5 w-3/5" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
              <div className="flex items-end justify-between pl-1.5">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="size-11 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
