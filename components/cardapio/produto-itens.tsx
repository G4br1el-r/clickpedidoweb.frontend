"use client"

import { AmpliarFoto } from "@/components/ampliar-foto"
import { Foto } from "@/components/foto"
import { SeloRemedio } from "@/components/produto/info-remedio"
import { etiquetaDoProduto } from "@/lib/etiqueta"
import { emReais } from "@/lib/formato"
import type { Produto } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { BotaoAdicionar } from "./botao-adicionar"

/** A foto cresce de leve dentro da moldura, só com mouse (o hover do Tailwind já exige ponteiro). */
const ZOOM_FOTO =
  "[&_img]:transition-transform [&_img]:duration-300 [&_img]:ease-saida group-hover:[&_img]:scale-[1.03]"

/**
 * A etiqueta: o único detalhe marcado do produto. Um traço na cor da loja, o dado que importa
 * no segmento (a embalagem, a duração, "a partir de") e o preço em números tabulares.
 */
export function Etiqueta({ produto, className }: { produto: Produto; className?: string }) {
  const { preco, precoAntigo, aPartirDe, porKg, detalhe } = etiquetaDoProduto(produto)
  const suave = "text-[13px] font-normal text-muted-foreground"

  return (
    <p
      data-testid={`etiqueta-${produto.id}`}
      className={cn("flex min-w-0 flex-col gap-0.5 leading-tight tabular-nums", className)}
    >
      {/* O dado do segmento em cima, numa linha só; o preço embaixo, com o ponto da loja. */}
      {detalhe && <span className={cn(suave, "truncate")}>{detalhe}</span>}
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span
          aria-hidden="true"
          className="h-3.5 w-[3px] shrink-0 self-center rounded-full bg-primary"
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
            "text-[15px] font-semibold tracking-[-0.01em]",
            precoAntigo ? "text-marca-acento-texto" : "text-foreground",
          )}
        >
          {precoAntigo && <span className="sr-only">por </span>}
          {emReais(preco)}
        </span>
        {porKg && <span className={suave}>o kg</span>}
      </span>
    </p>
  )
}

type ItemProps = { produto: Produto; aoAbrir: () => void }

/**
 * Linha do cardápio, sem cartão: a foto à esquerda e, ao lado, nome, descrição e, no pé,
 * a etiqueta e o botão de adicionar. As linhas se separam por um fio fino.
 * A linha inteira abre o produto; a foto amplia e o botão responde à parte.
 */
export function ProdutoLinha({ produto, aoAbrir }: ItemProps) {
  return (
    <article
      // Tocar no nome afunda a linha de leve; o botão de adicionar responde à parte.
      className="group relative flex h-full gap-4 py-4 transition-transform duration-150 ease-saida has-[h3_button:active]:scale-[0.985]"
      data-testid={`produto-${produto.id}`}
    >
      <AmpliarFoto
        src={produto.imagem}
        nome={produto.nome}
        descricao={produto.descricao}
        className="size-[104px] shrink-0 rounded-xl md:size-28"
      >
        <Foto src={produto.imagem} alt="" sizes="112px" className={cn("size-full", ZOOM_FOTO)} />
      </AmpliarFoto>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-sans text-[15px] leading-snug font-medium tracking-[-0.01em] wrap-anywhere">
          <button
            type="button"
            onClick={aoAbrir}
            className="text-left outline-none after:absolute after:-inset-x-2 after:inset-y-1 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {produto.nome}
          </button>
        </h3>
        {produto.medicamento && (
          <SeloRemedio medicamento={produto.medicamento} className="mt-1.5" />
        )}
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
          {produto.descricao}
        </p>
        <div
          className="mt-auto flex items-end justify-between gap-3 pt-3"
          data-testid={`rodape-${produto.id}`}
        >
          <Etiqueta produto={produto} />
          <BotaoAdicionar produto={produto} aoAbrir={aoAbrir} embutido className="shrink-0" />
        </div>
      </div>
    </article>
  )
}

/**
 * Mais pedidos: a foto grande é o cartão, o botão de adicionar fica no canto dela,
 * e o nome e a etiqueta vêm embaixo, fora da foto, como no resto do cardápio.
 */
export function ProdutoDestaque({ produto, aoAbrir }: ItemProps) {
  return (
    <article className="group relative w-full" data-testid={`destaque-${produto.id}`}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
        <Foto
          src={produto.imagem}
          alt=""
          sizes="(min-width: 768px) 300px, 64vw"
          className={cn("absolute inset-0 size-full", ZOOM_FOTO)}
        />
        {produto.precoOriginal && (
          <span className="absolute top-2.5 left-2.5 rounded-md bg-background px-2 py-0.5 text-xs font-semibold text-marca-acento-texto">
            Oferta
          </span>
        )}
        <BotaoAdicionar
          produto={produto}
          aoAbrir={aoAbrir}
          className="absolute right-2.5 bottom-2.5"
        />
      </div>
      <h3 className="mt-3 font-sans text-[15px] leading-snug font-medium tracking-[-0.01em] wrap-anywhere">
        <button
          type="button"
          onClick={aoAbrir}
          className="text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {produto.nome}
        </button>
      </h3>
      <Etiqueta produto={produto} className="mt-1" />
    </article>
  )
}
