import { Skeleton } from "@/components/ui/skeleton"
import { atrasoEscalonado } from "@/lib/admin/movimento"
import { cn } from "@/lib/utils"

/**
 * Esqueletos com a forma do que vai aparecer: lista de linhas, cartões de fila, régua de
 * números. Cada um entra um pouco depois do anterior (`esqueleto-entra`) e brilha de leve
 * (`.painel-admin [data-slot=skeleton]`, em admin.css). Só o invólucro avisa o leitor de tela.
 */
const PASSO = 0.06

function Aviso({
  rotulo,
  className,
  children,
}: {
  rotulo: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div role="status" aria-label={rotulo} aria-busy="true" className={className}>
      {children}
    </div>
  )
}

function atraso(indice: number) {
  return { animationDelay: `${atrasoEscalonado(indice, { passo: PASSO })}s` }
}

function Linhas({ quantidade }: { quantidade: number }) {
  return (
    <div className="flex flex-col divide-y divide-border/60">
      {Array.from({ length: quantidade }, (_, indice) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: linhas de esqueleto não têm identidade.
          key={indice}
          data-testid="esqueleto-linha"
          className="esqueleto-entra flex items-center gap-3 py-3"
          style={atraso(indice)}
        >
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/5 max-w-56" />
            <Skeleton className="h-3 w-3/5 max-w-80" />
          </div>
          <Skeleton className="hidden h-4 w-16 sm:block" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function Cartoes({ quantidade }: { quantidade: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: quantidade }, (_, indice) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: cartões de esqueleto não têm identidade.
          key={indice}
          data-testid="esqueleto-cartao"
          className="esqueleto-entra flex flex-col gap-3 rounded-xl border border-border/70 p-4"
          style={atraso(indice)}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="mt-2 h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}

function Indicadores({ quantidade }: { quantidade: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
      {Array.from({ length: quantidade }, (_, indice) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: indicadores de esqueleto não têm identidade.
          key={indice}
          data-testid="esqueleto-indicador"
          className="esqueleto-entra flex flex-col gap-2"
          style={atraso(indice)}
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

type Comum = { rotulo?: string; className?: string }

export function EsqueletoLista({
  linhas = 6,
  rotulo = "Carregando a lista",
  className,
}: Comum & { linhas?: number }) {
  return (
    <Aviso rotulo={rotulo} className={className}>
      <Linhas quantidade={linhas} />
    </Aviso>
  )
}

export function EsqueletoCartoes({
  quantidade = 4,
  rotulo = "Carregando os cartões",
  className,
}: Comum & { quantidade?: number }) {
  return (
    <Aviso rotulo={rotulo} className={className}>
      <Cartoes quantidade={quantidade} />
    </Aviso>
  )
}

export function EsqueletoRegua({
  quantidade = 4,
  rotulo = "Carregando os números",
  className,
}: Comum & { quantidade?: number }) {
  return (
    <Aviso rotulo={rotulo} className={className}>
      <Indicadores quantidade={quantidade} />
    </Aviso>
  )
}

/** Página inteira: título, resumo, uma régua de números e a lista. */
export function EsqueletoPagina({ rotulo = "Carregando a página", className }: Comum) {
  return (
    <Aviso rotulo={rotulo} className={cn("flex flex-col gap-6 p-4 md:p-6", className)}>
      <div data-testid="esqueleto-cabecalho" className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Indicadores quantidade={4} />
      <Linhas quantidade={5} />
    </Aviso>
  )
}
