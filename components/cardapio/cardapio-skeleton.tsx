import { registroSegmentos } from "@/components/segmentos/registro"
import { Skeleton } from "@/components/ui/skeleton"
import { useLoja } from "@/lib/loja-atual"
import { textosDoSegmento } from "@/lib/segmentos"
import { cn } from "@/lib/utils"
import { MOSAICO } from "./banners-loja"

const LINHAS = ["linha-1", "linha-2", "linha-3"]
const CARTOES = ["cartao-1", "cartao-2", "cartao-3"]

/** Peça do mosaico carregando: só o bloco, na mesma geometria do banner que vai chegar. */
const PECA = cn(MOSAICO.peca, "animate-pulse bg-muted")

/** Mosaico dos banners carregando: cada peça no lugar exato do banner real. */
function BannersSkeleton() {
  return (
    <div className={MOSAICO.secao}>
      <div className={MOSAICO.grade}>
        <div className={MOSAICO.celulaGrande}>
          <div data-testid="esqueleto-banner-grande" className={cn(PECA, MOSAICO.grande)} />
        </div>
        <div>
          <div data-testid="esqueleto-banner-primeiro" className={cn(PECA, MOSAICO.quadrado)} />
        </div>
        <div>
          <div data-testid="esqueleto-banner-segundo" className={cn(PECA, MOSAICO.quadrado)} />
        </div>
        <div className={MOSAICO.celulaLarga}>
          <div data-testid="esqueleto-banner-largo" className={cn(PECA, MOSAICO.largo)} />
        </div>
      </div>
    </div>
  )
}

/** Mesmo formato do cardápio, para a tela não pular quando os dados chegam. */
export function CardapioSkeleton() {
  const loja = useLoja()
  const { Carregador } = registroSegmentos[loja.segmento]
  const { carregando } = textosDoSegmento(loja.segmento)

  return (
    <div
      role="status"
      aria-label="Carregando cardápio"
      // Os mesmos espaços do cardápio carregado: o primeiro bloco começa no mesmo lugar.
      className="flex flex-col gap-10 pt-7 md:gap-14 md:pt-10"
    >
      <div className="flex flex-col px-4 md:px-6">
        {/* No lugar do título, o carregador do nicho e a frase do ofício, na mesma altura. */}
        <p className="flex h-7 items-center gap-2.5 text-[15px] font-medium text-muted-foreground">
          <Carregador className="size-7" />
          {carregando}
        </p>
        <div className="mt-1 grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
          {LINHAS.map((chave) => (
            <div
              key={chave}
              data-testid={`esqueleto-${chave}`}
              className="flex gap-4 border-b border-border/70 py-4"
            >
              <Skeleton className="size-[104px] shrink-0 rounded-xl md:size-28" />
              <div className="flex flex-1 flex-col gap-2 pt-0.5">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
                <div className="mt-auto flex items-end justify-between">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="size-11 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <BannersSkeleton />
      <div className="flex flex-col gap-4 px-4 md:px-6">
        <Skeleton className="h-6 w-36" />
        <div className="flex gap-3 overflow-hidden md:gap-4">
          {CARTOES.map((chave) => (
            <div key={chave} className="flex w-[62%] shrink-0 flex-col gap-2 sm:w-[40%] md:w-[30%]">
              <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-2/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
