"use client"

import { PlusIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Foto } from "@/components/foto"
import type { Config, VarianteCard } from "@/lib/admin/config"
import { emReais } from "@/lib/formato"
import type { Produto } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { classeBotao, classeHover } from "./estilos"

type CardProps = {
  produto: Produto
  config: Config
  /** Botão de ação. Na prévia, um "+" que não mexe na sacola de verdade. */
  acao: ReactNode
  /** Mostra o efeito de passar o mouse sem o mouse, logo depois de escolhê-lo. */
  demo?: boolean
}

function Preco({ produto, sobreFoto = false }: { produto: Produto; sobreFoto?: boolean }) {
  return (
    <p className="flex min-w-0 flex-col leading-tight font-bold tabular-nums">
      {produto.precoOriginal && (
        <s
          className={cn(
            "text-xs font-medium",
            sobreFoto ? "text-white/80" : "text-muted-foreground",
          )}
        >
          {emReais(produto.precoOriginal)}
        </s>
      )}
      <span
        className={cn(
          "text-[15px]",
          produto.precoOriginal && !sobreFoto && "text-marca-acento-texto",
        )}
      >
        {emReais(produto.preco)}
      </span>
    </p>
  )
}

function SeloOferta({ produto, config }: { produto: Produto; config: Config }) {
  if (!config.cards.seloOferta || !produto.precoOriginal) return null
  return (
    <span className="absolute top-2 left-2 z-10 rounded-full bg-marca-acento px-2.5 py-0.5 text-xs font-bold text-marca-acento-sobre">
      Oferta
    </span>
  )
}

/** Foto à esquerda, texto à direita e rodapé com preço e ação: o card atual da loja. */
function Classico({ produto, config, acao, demo }: CardProps) {
  return (
    <article
      data-demo={demo || undefined}
      className={cn(
        "relative flex h-full flex-col gap-2.5 rounded-3xl bg-card p-2.5 ring-1 ring-border/70",
        classeHover(config.animacoes.hover),
      )}
    >
      <div className="flex gap-3">
        <div className="relative shrink-0">
          <SeloOferta produto={produto} config={config} />
          <Foto src={produto.imagem} alt="" sizes="96px" className="size-[84px] rounded-[18px]" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-[15px] leading-snug font-semibold">{produto.nome}</h3>
          {config.cards.descricao && (
            <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
              {produto.descricao}
            </p>
          )}
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 pl-1.5">
        <Preco produto={produto} />
        {acao}
      </div>
    </article>
  )
}

/** Foto grande em cima, texto embaixo: vitrine de loja. */
function Vitrine({ produto, config, acao, demo }: CardProps) {
  return (
    <article
      data-demo={demo || undefined}
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-border/70",
        classeHover(config.animacoes.hover),
      )}
    >
      <SeloOferta produto={produto} config={config} />
      <Foto src={produto.imagem} alt="" sizes="320px" className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-[15px] leading-snug font-semibold">{produto.nome}</h3>
        {config.cards.descricao && (
          <p className="line-clamp-2 text-[13px] text-muted-foreground">{produto.descricao}</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <Preco produto={produto} />
          {acao}
        </div>
      </div>
    </article>
  )
}

/** Lista enxuta, sem caixa: texto à esquerda e foto pequena à direita. */
function Compacto({ produto, config, acao, demo }: CardProps) {
  return (
    <article
      data-demo={demo || undefined}
      className={cn(
        "relative flex h-full items-start gap-3 border-b border-border py-3",
        classeHover(config.animacoes.hover === "levantar" ? "nenhum" : config.animacoes.hover),
      )}
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] leading-snug font-semibold">{produto.nome}</h3>
        {config.cards.descricao && (
          <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">
            {produto.descricao}
          </p>
        )}
        <div className="mt-1.5">
          <Preco produto={produto} />
        </div>
      </div>
      <div className="relative shrink-0">
        <SeloOferta produto={produto} config={config} />
        <Foto src={produto.imagem} alt="" sizes="96px" className="size-20 rounded-2xl" />
        <span className="absolute -right-1.5 -bottom-1.5">{acao}</span>
      </div>
    </article>
  )
}

/** A foto é o card: texto por cima, sobre um degradê escuro. */
function Imersivo({ produto, config, acao, demo }: CardProps) {
  return (
    <article
      data-demo={demo || undefined}
      className={cn(
        "relative h-56 overflow-hidden rounded-3xl bg-black text-white",
        classeHover(config.animacoes.hover === "levantar" ? "zoom" : config.animacoes.hover),
      )}
    >
      <SeloOferta produto={produto} config={config} />
      <Foto src={produto.imagem} alt="" sizes="360px" className="absolute inset-0 size-full" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5">
        <div className="min-w-0">
          <h3 className="font-heading text-lg leading-tight font-bold">{produto.nome}</h3>
          {config.cards.descricao && (
            <p className="mt-0.5 line-clamp-1 text-[13px] text-white/80">{produto.descricao}</p>
          )}
          <div className="mt-1">
            <Preco produto={produto} sobreFoto />
          </div>
        </div>
        {acao}
      </div>
    </article>
  )
}

/** Foto quadrada e só o essencial embaixo: feito para grades de duas ou mais colunas. */
function Mosaico({ produto, config, acao, demo }: CardProps) {
  return (
    <article
      data-demo={demo || undefined}
      className={cn("relative flex h-full flex-col gap-2", classeHover(config.animacoes.hover))}
    >
      <div className="relative">
        <SeloOferta produto={produto} config={config} />
        <Foto
          src={produto.imagem}
          alt=""
          sizes="240px"
          className="aspect-square w-full rounded-[22px]"
        />
        <span className="absolute right-2 bottom-2">{acao}</span>
      </div>
      <div className="px-0.5">
        <h3 className="line-clamp-1 text-sm leading-snug font-semibold">{produto.nome}</h3>
        {config.cards.descricao && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{produto.descricao}</p>
        )}
        <div className="mt-0.5">
          <Preco produto={produto} />
        </div>
      </div>
    </article>
  )
}

const VARIANTES: Record<VarianteCard, (props: CardProps) => ReactNode> = {
  classico: Classico,
  vitrine: Vitrine,
  compacto: Compacto,
  imersivo: Imersivo,
  mosaico: Mosaico,
}

/** Card do produto no modelo escolhido nas configurações. */
export function CardProduto({ variante, ...props }: CardProps & { variante?: VarianteCard }) {
  const Variante = VARIANTES[variante ?? props.config.cards.variante]
  return <Variante {...props} />
}

/** Botão "+" da prévia, no estilo de botão escolhido. */
export function BotaoMais({
  config,
  nome,
  aoClicar,
}: {
  config: Config
  nome: string
  aoClicar?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`Adicionar ${nome}`}
      onClick={aoClicar}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full transition-transform duration-150 active:scale-90",
        classeBotao(config.cores.botao),
      )}
    >
      <PlusIcon className="size-5" />
    </button>
  )
}
