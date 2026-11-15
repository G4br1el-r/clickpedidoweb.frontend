import { etiquetaDoProduto } from "@/lib/etiqueta"
import { emReais } from "@/lib/formato"
import type { Produto } from "@/lib/tipos"
import { cn } from "@/lib/utils"

/**
 * A etiqueta da vitrine, na folha do produto: o mesmo traço na cor da loja, o preço em números
 * tabulares, um passo maior, e o dado que importa no segmento (a embalagem, a duração, as fatias).
 * Aqui cabe numa linha só: o dado vem depois do preço, separado por um ponto.
 */
export function EtiquetaFolha({ produto, className }: { produto: Produto; className?: string }) {
  const { preco, precoAntigo, aPartirDe, porKg, detalhe } = etiquetaDoProduto(produto)
  const suave = "text-sm font-normal text-muted-foreground"

  return (
    <p
      data-testid="etiqueta-folha"
      className={cn(
        "flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 leading-tight tabular-nums",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-4 w-[3px] shrink-0 self-center rounded-full bg-primary"
      />
      {aPartirDe && <span className={suave}>A partir de</span>}
      {precoAntigo && (
        <s className={suave}>
          <span className="sr-only">De </span>
          {emReais(precoAntigo)}
        </s>
      )}
      <span
        className={cn(
          "text-lg font-semibold tracking-[-0.015em]",
          precoAntigo ? "text-marca-acento-texto" : "text-foreground",
        )}
      >
        {precoAntigo && <span className="sr-only">por </span>}
        {emReais(preco)}
      </span>
      {porKg && <span className={suave}>o quilo</span>}
      {detalhe && (
        <>
          <span aria-hidden="true" className={suave}>
            ·
          </span>
          <span className={cn(suave, "min-w-0 truncate")}>{detalhe}</span>
        </>
      )}
    </p>
  )
}
