"use client"

import { ArrowUpRightIcon } from "lucide-react"
import Image from "next/image"
import type { ComponentProps } from "react"
import { buttonVariants } from "@/components/ui/button"
import { emReaisCurto } from "@/lib/formato"
import type { Banner, Produto } from "@/lib/tipos"
import { cn } from "@/lib/utils"

type BannersLojaProps = {
  banners: Banner[]
  /** Para mostrar a oferta (preço de e por) no banner que abre um produto. */
  produtoDoBanner: (banner: Banner) => Produto | undefined
  aoEscolher: (banner: Banner) => void
}

/**
 * Geometria do mosaico, compartilhada com o esqueleto: o que carrega ocupa exatamente o
 * lugar do que chega. Mudou aqui, muda nos dois.
 */
export const MOSAICO = {
  secao: "px-4 md:px-6",
  grade:
    "grid grid-cols-2 gap-3 md:h-[380px] md:grid-cols-4 md:grid-rows-2 md:gap-4 lg:h-[440px] xl:h-[460px]",
  celulaGrande: "col-span-2 md:row-span-2",
  celulaLarga: "col-span-2",
  peca: "relative isolate flex size-full overflow-hidden rounded-2xl",
  grande: "aspect-square sm:aspect-[16/9] md:aspect-auto",
  quadrado: "aspect-square flex-col p-4 md:aspect-auto md:p-5",
  largo: "h-44 md:h-full",
} as const

/** Base comum: o banner inteiro é um botão, com foco visível e um leve afundar ao toque. */
function Peca({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        MOSAICO.peca,
        "group text-left outline-none transition-transform duration-150 ease-saida focus-visible:ring-3 focus-visible:ring-ring/60 active:scale-[0.99]",
        className,
      )}
      {...props}
    />
  )
}

/** Seta no canto: avança de leve no hover, dizendo que o banner leva a algum lugar. */
function Seta({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full transition-transform duration-300 ease-saida group-hover:translate-x-0.5 group-hover:-translate-y-0.5 md:top-4 md:right-4",
        className,
      )}
    >
      <ArrowUpRightIcon className="size-4" />
    </span>
  )
}

/** O grande: foto de ponta a ponta, título forte e o botão de ação. */
function BannerFoto({ banner, aoEscolher }: { banner: Banner; aoEscolher: () => void }) {
  return (
    <Peca
      onClick={aoEscolher}
      data-testid={`banner-${banner.id}`}
      className={cn(MOSAICO.grande, "bg-neutral-900 text-white")}
    >
      <Image
        src={banner.imagem}
        alt=""
        fill
        priority
        placeholder="blur"
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover transition-transform duration-300 ease-saida group-hover:scale-[1.03]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-black/0"
      />
      <span className="relative mt-auto flex flex-col items-start gap-2.5 p-5 md:gap-3 md:p-8">
        <span className="block max-w-[14ch] text-[28px] leading-[1.05] font-semibold tracking-[-0.025em] text-balance sm:text-4xl lg:text-5xl">
          {banner.titulo}
        </span>
        <span className="block max-w-[38ch] text-sm text-white/80 md:text-base">
          {banner.texto}
        </span>
        {banner.chamada && (
          <span
            className={cn(
              buttonVariants({ size: "cta" }),
              "mt-1 h-11 bg-white font-medium text-neutral-900 group-hover:bg-white/90",
            )}
          >
            {banner.chamada}
          </span>
        )}
      </span>
    </Peca>
  )
}

/** Os quadrados: cor da marca de ponta a ponta, título curto e a foto quadrada no canto. */
function BannerCor({
  banner,
  tom,
  aoEscolher,
}: {
  banner: Banner
  tom: "acento" | "primaria"
  aoEscolher: () => void
}) {
  return (
    <Peca
      onClick={aoEscolher}
      data-testid={`banner-${banner.id}`}
      className={cn(
        MOSAICO.quadrado,
        tom === "acento"
          ? "bg-marca-acento text-marca-acento-sobre"
          : "bg-primary text-primary-foreground",
      )}
    >
      <Seta className="bg-white/15" />
      <span className="relative z-10 block max-w-[10ch] pr-8 text-lg leading-[1.1] font-semibold tracking-[-0.015em] sm:text-xl lg:text-2xl">
        {banner.titulo}
      </span>
      {/* Nos quadrados pequenos do tablet, só o título: a frase encostaria na foto. */}
      <span className="relative z-10 mt-1.5 hidden max-w-[50%] text-sm leading-snug sm:block md:hidden xl:block">
        {banner.texto}
      </span>
      <span
        aria-hidden="true"
        className="absolute right-3 bottom-3 aspect-square w-[46%] overflow-hidden rounded-xl transition-transform duration-300 ease-saida group-hover:scale-[1.03] md:right-4 md:bottom-4"
      >
        <Image
          src={banner.imagem}
          alt=""
          fill
          placeholder="blur"
          sizes="(min-width: 768px) 20vw, 40vw"
          className="object-cover"
        />
      </span>
    </Peca>
  )
}

/** O largo: oferta com preço de e por, e a foto à direita, num corte reto. */
function BannerOferta({
  banner,
  produto,
  aoEscolher,
}: {
  banner: Banner
  produto?: Produto
  aoEscolher: () => void
}) {
  const temOferta = produto?.precoOriginal && produto.precoOriginal > produto.preco
  return (
    <Peca
      onClick={aoEscolher}
      data-testid={`banner-${banner.id}`}
      className={cn(MOSAICO.largo, "bg-card ring-1 ring-border ring-inset")}
    >
      <span className="relative z-10 flex w-[60%] flex-col items-start justify-center gap-1.5 p-4 md:p-6">
        <span className="block text-lg leading-tight font-semibold tracking-[-0.015em] lg:text-2xl">
          {banner.titulo}
        </span>
        {temOferta && produto ? (
          <span className="flex items-baseline gap-1.5 text-sm text-muted-foreground">
            <s>{emReaisCurto(produto.precoOriginal ?? 0)}</s>
            <span>por</span>
            <span className="text-2xl font-semibold tracking-[-0.02em] tabular-nums lg:text-3xl">
              {emReaisCurto(produto.preco)}
            </span>
          </span>
        ) : (
          <span className="line-clamp-2 text-sm text-muted-foreground">{banner.texto}</span>
        )}
      </span>
      <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[40%] overflow-hidden">
        <Image
          src={banner.imagem}
          alt=""
          fill
          placeholder="blur"
          sizes="(min-width: 768px) 25vw, 50vw"
          className="object-cover transition-transform duration-300 ease-saida group-hover:scale-[1.03]"
        />
      </span>
      <Seta className="bg-background text-foreground" />
    </Peca>
  )
}

/**
 * Vitrine em mosaico antes de "Mais pedidas". No computador e no tablet, quatro colunas:
 * o grande ocupa as duas primeiras de cima a baixo; à direita, dois quadrados em cima e
 * um banner largo embaixo. No celular, o grande vem inteiro e os outros logo abaixo.
 */
export function BannersLoja({ banners, produtoDoBanner, aoEscolher }: BannersLojaProps) {
  const [grande, primeiro, segundo, largo] = banners
  if (!grande) return null

  return (
    <section aria-label="Destaques da casa" data-testid="banners-loja" className={MOSAICO.secao}>
      <div className={MOSAICO.grade}>
        <div className={MOSAICO.celulaGrande}>
          <BannerFoto banner={grande} aoEscolher={() => aoEscolher(grande)} />
        </div>
        {primeiro && (
          <div>
            <BannerCor banner={primeiro} tom="acento" aoEscolher={() => aoEscolher(primeiro)} />
          </div>
        )}
        {segundo && (
          <div>
            <BannerCor banner={segundo} tom="primaria" aoEscolher={() => aoEscolher(segundo)} />
          </div>
        )}
        {largo && (
          <div className={MOSAICO.celulaLarga}>
            <BannerOferta
              banner={largo}
              produto={produtoDoBanner(largo)}
              aoEscolher={() => aoEscolher(largo)}
            />
          </div>
        )}
      </div>
    </section>
  )
}
