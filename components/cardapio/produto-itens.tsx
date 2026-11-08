"use client"

import { motion } from "motion/react"
import { AmpliarFoto } from "@/components/ampliar-foto"
import { Foto } from "@/components/foto"
import { emReais } from "@/lib/formato"
import type { Produto } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { BotaoAdicionar, useQuantidadeNaSacola } from "./botao-adicionar"

const ZOOM_FOTO =
  "[&_img]:transition-transform [&_img]:duration-700 [&_img]:ease-saida group-hover:[&_img]:scale-[1.06]"

type PrecoProps = {
  produto: Produto
  sobreFoto?: boolean
  /** "A partir de" ou o preço antigo numa linha pequena acima do valor: ocupa menos largura. */
  empilhado?: boolean
}

function Preco({ produto, sobreFoto = false, empilhado = false }: PrecoProps) {
  const aPartirDe = produto.grupos?.some((grupo) => grupo.itens.some((item) => item.extra > 0))
  const suave = sobreFoto ? "text-white/85" : "text-muted-foreground"
  const detalhe = cn(empilhado ? "text-xs" : "text-sm", "font-medium", suave)

  return (
    <p
      className={cn(
        "font-bold tabular-nums",
        empilhado
          ? "flex min-w-0 flex-col leading-tight"
          : "flex flex-wrap items-baseline gap-x-1.5",
      )}
    >
      {produto.precoOriginal ? (
        <>
          <s className={detalhe}>
            <span className="sr-only">De </span>
            {emReais(produto.precoOriginal)}
          </s>
          <span
            className={cn(
              sobreFoto ? "text-white" : "text-marca-acento-texto",
              empilhado && "text-[17px]",
            )}
          >
            <span className="sr-only">por </span>
            {emReais(produto.preco)}
          </span>
        </>
      ) : (
        <>
          {aPartirDe && <span className={detalhe}>A partir de</span>}
          <span className={empilhado ? "text-[17px]" : undefined}>{emReais(produto.preco)}</span>
        </>
      )}
    </p>
  )
}
type ItemProps = { produto: Produto; aoAbrir: () => void }

/**
 * Cartão largo: foto à esquerda e texto à direita; no rodapé, de ponta a ponta,
 * o preço e o seletor sempre na mesma linha, em qualquer largura de tela.
 * O cartão inteiro abre o produto; o seletor responde à parte.
 */
export function ProdutoLinha({ produto, aoAbrir }: ItemProps) {
  return (
    <article
      className="group relative flex h-full flex-col gap-2.5 rounded-3xl bg-card p-2.5 ring-1 ring-border/70 transition-[box-shadow,transform] duration-300 ease-saida hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgb(14_26_43/0.35)] md:gap-3 md:p-3 dark:hover:shadow-[0_18px_40px_-20px_rgb(0_0_0/0.8)]"
      data-testid={`produto-${produto.id}`}
    >
      <div className="flex gap-3.5 md:gap-4">
        {/* A foto amplia no centro da tela; o resto do cartão abre o produto. */}
        <AmpliarFoto
          src={produto.imagem}
          nome={produto.nome}
          descricao={produto.descricao}
          className="size-[88px] rounded-[18px] md:size-28 md:rounded-[20px]"
        >
          <Foto src={produto.imagem} alt="" sizes="112px" className={cn("size-full", ZOOM_FOTO)} />
        </AmpliarFoto>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="font-sans text-base leading-snug font-semibold md:text-[17px]">
            <button
              type="button"
              onClick={aoAbrir}
              className="text-left outline-none group-hover:text-marca-texto after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              {produto.nome}
            </button>
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground md:line-clamp-3">
            {produto.descricao}
          </p>
        </div>
      </div>
      <div
        className="mt-auto flex items-end justify-between gap-3 pl-1.5"
        data-testid={`rodape-${produto.id}`}
      >
        <Preco produto={produto} empilhado />
        <BotaoAdicionar produto={produto} aoAbrir={aoAbrir} embutido className="shrink-0" />
      </div>
    </article>
  )
}
/**
 * Faixa de mais pedidas: a foto é o cartão, com o texto por cima.
 * Com o produto na sacola, o texto sobe e o seletor completo ocupa a base do cartão.
 */
export function ProdutoDestaque({ produto, aoAbrir }: ItemProps) {
  const naSacola = useQuantidadeNaSacola(produto.id) > 0

  return (
    <article
      className="group relative h-72 w-full overflow-hidden rounded-3xl bg-black text-white md:h-80"
      data-testid={`destaque-${produto.id}`}
    >
      <Foto
        src={produto.imagem}
        alt=""
        sizes="(min-width: 768px) 340px, 72vw"
        className={cn("absolute inset-0 size-full", ZOOM_FOTO)}
      />
      <div
        className="absolute inset-0 bg-linear-to-t from-black/90 via-black/35 to-transparent"
        aria-hidden="true"
      />
      {produto.precoOriginal && (
        <span className="absolute top-3 left-3 rounded-full bg-marca-acento px-3 py-1 text-sm font-bold text-marca-acento-sobre">
          Oferta
        </span>
      )}
      <motion.div
        layout="position"
        transition={{ type: "spring", duration: 0.42, bounce: 0.18 }}
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-4",
          naSacola ? "pr-4 pb-[72px]" : "pr-20",
        )}
      >
        <h3 className="font-heading text-xl leading-tight font-bold">
          <button
            type="button"
            onClick={aoAbrir}
            className="text-left outline-none after:absolute after:inset-0 after:rounded-3xl focus-visible:after:ring-3 focus-visible:after:ring-white"
          >
            {produto.nome}
          </button>
        </h3>
        <Preco produto={produto} sobreFoto />
      </motion.div>
      <BotaoAdicionar produto={produto} aoAbrir={aoAbrir} className="absolute right-3 bottom-4" />
    </article>
  )
}
