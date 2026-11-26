import { Skeleton } from "@/components/ui/skeleton"
import { atrasoEscalonado } from "@/lib/admin/movimento"

/**
 * Esqueletos do cardápio, no formato do que vai aparecer: grupos de categoria com linhas de
 * produto, linhas de categoria e os campos do formulário. Cada linha entra um pouco depois
 * da anterior (`esqueleto-entra`) e brilha de leve (admin.css). Só o invólucro avisa o leitor.
 */
const PASSO = 0.05

const atraso = (indice: number) => ({
  animationDelay: `${atrasoEscalonado(indice, { passo: PASSO })}s`,
})

function LinhaDeProduto({ indice }: { indice: number }) {
  return (
    <div
      data-testid="esqueleto-produto"
      className="esqueleto-entra flex items-center gap-3 py-2.5"
      style={atraso(indice)}
    >
      <Skeleton className="size-4 shrink-0 rounded-[4px]" />
      <Skeleton className="size-10 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-48 max-w-full" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </div>
      <Skeleton className="hidden h-8 w-28 sm:block" />
      <Skeleton className="hidden h-5 w-44 md:block" />
    </div>
  )
}

/** Lista do cardápio: cabeçalho de categoria e linhas finas, em dois grupos. */
export function EsqueletoCardapio() {
  let indice = 0
  return (
    <div
      role="status"
      aria-label="Carregando o cardápio"
      aria-busy="true"
      className="flex flex-col gap-8"
    >
      {[5, 3].map((linhas) => (
        <div key={linhas} data-testid="esqueleto-grupo" className="flex flex-col">
          <Skeleton className="mb-3 h-5 w-40" />
          <div className="flex flex-col divide-y divide-border/70 border-y border-border/70">
            {Array.from({ length: linhas }, () => {
              const atual = indice++
              return <LinhaDeProduto key={atual} indice={atual} />
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Lista de categorias: alça, número, nome, contagem e chave. */
export function EsqueletoCategorias() {
  return (
    <div
      role="status"
      aria-label="Carregando as categorias"
      aria-busy="true"
      className="flex flex-col divide-y divide-border/70 border-y border-border/70"
    >
      {["a", "b", "c", "d", "e", "f"].map((chave, indice) => (
        <div
          key={chave}
          data-testid="esqueleto-categoria"
          className="esqueleto-entra flex items-center gap-3 py-3"
          style={atraso(indice)}
        >
          <Skeleton className="size-5 shrink-0" />
          <Skeleton className="h-4 w-48 max-w-[50%]" />
          <Skeleton className="ml-auto h-4 w-20" />
          <Skeleton className="hidden h-5 w-24 sm:block" />
        </div>
      ))}
    </div>
  )
}

/** Painel do produto: rótulo e campo, repetidos, e a descrição maior no fim. */
export function EsqueletoFormularioProduto() {
  return (
    <div
      role="status"
      aria-label="Carregando o produto"
      aria-busy="true"
      className="flex flex-col gap-5 p-4"
    >
      {[0, 1, 2, 3].map((indice) => (
        <div
          key={indice}
          data-testid="esqueleto-campo"
          className="esqueleto-entra flex flex-col gap-2"
          style={atraso(indice)}
        >
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <div
        data-testid="esqueleto-campo"
        className="esqueleto-entra flex flex-col gap-2"
        style={atraso(4)}
      >
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}
