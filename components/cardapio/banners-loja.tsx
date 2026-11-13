"use client"

import { ArrowUpRightIcon } from "lucide-react"
import Image from "next/image"
import type { ComponentProps } from "react"
import { Entrada } from "@/components/entrada"
import { Badge } from "@/components/ui/badge"
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
    "grid grid-cols-2 gap-3 md:h-[380px] md:grid-cols-4 md:grid-rows-2 md:gap-4 lg:h-[440px] xl:h-[480px] 2xl:h-[540px]",
  celulaGrande: "col-span-2 md:row-span-2",
  celulaLarga: "col-span-2",
  peca: "relative isolate flex size-full overflow-hidden rounded-3xl",
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
        "group text-left outline-none transition-transform duration-150 ease-saida focus-visible:ring-3 focus-visible:ring-ring/60 active:scale-[0.985]",
        className,
      )}
      {...props}
    />
  )
}

/** Seta no canto: gira de leve no hover, dizendo que o banner leva a algum lugar. */
function Seta({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full transition-transform duration-500 ease-saida group-hover:rotate-45 md:top-4 md:right-4",
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
        className="object-cover transition-transform duration-[1200ms] ease-saida group-hover:scale-[1.04]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-black/0"
      />
      <span className="relative mt-auto flex flex-col items-start gap-2.5 p-5 md:gap-3 md:p-8">
        {banner.selo && (
          <Badge className="border-white/20 bg-white/15 text-white backdrop-blur-md">
            {banner.selo}
          </Badge>
        )}
        <span className="block max-w-[13ch] font-heading text-3xl leading-[1.02] font-extrabold tracking-tight text-balance sm:text-4xl lg:text-5xl">
          {banner.titulo}
        </span>
        <span className="block max-w-[38ch] text-sm text-white/80 md:text-base">
          {banner.texto}
        </span>
        {banner.chamada && (
          <span
            className={cn(
              buttonVariants({ size: "cta" }),
              "mt-1 bg-white text-neutral-900 group-hover:-translate-y-0.5 group-hover:bg-white group-hover:shadow-lg group-hover:shadow-black/30",
            )}
          >
            {banner.chamada}
          </span>
        )}
      </span>
    </Peca>
  )
}

/** Os quadrados: cor da marca, título curto e a foto num círculo que vaza pelo canto. */
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
      <span className="relative z-10 block max-w-[9ch] pr-8 font-heading text-lg leading-[1.1] font-extrabold tracking-tight sm:text-xl lg:text-2xl">
        {banner.titulo}
      </span>
      {/* Nos quadrados pequenos do tablet, só o título: a frase encostaria na foto. */}
      <span className="relative z-10 mt-1.5 hidden max-w-[15ch] text-sm leading-snug sm:block md:hidden xl:block xl:max-w-[19ch]">
        {banner.texto}
      </span>
      <span
        aria-hidden="true"
        className="absolute -right-[12%] -bottom-[16%] aspect-square w-[66%] overflow-hidden rounded-full shadow-2xl ring-[6px] ring-white/20 transition-transform duration-700 ease-saida group-hover:-rotate-6 group-hover:scale-105"
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

/** O largo: oferta com preço de e por, e a foto cortada em diagonal à direita. */
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
        {banner.selo && <Badge variant="destructive">{banner.selo}</Badge>}
        <span className="block font-heading text-xl leading-tight font-extrabold tracking-tight lg:text-2xl">
          {banner.titulo}
        </span>
        {temOferta && produto ? (
          <span className="flex items-baseline gap-1.5 text-sm text-muted-foreground">
            <s>{emReaisCurto(produto.precoOriginal ?? 0)}</s>
            <span>por</span>
            <span className="text-2xl font-extrabold tracking-tight text-marca-texto lg:text-3xl">
              {emReaisCurto(produto.preco)}
            </span>
          </span>
        ) : (
          <span className="line-clamp-2 text-sm text-muted-foreground">{banner.texto}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className="absolute inset-y-0 right-0 w-[48%] overflow-hidden [clip-path:polygon(22%_0,100%_0,100%_100%,0_100%)]"
      >
        <Image
          src={banner.imagem}
          alt=""
          fill
          placeholder="blur"
          sizes="(min-width: 768px) 25vw, 50vw"
          className="object-cover transition-transform duration-[1200ms] ease-saida group-hover:scale-[1.06]"
        />
      </span>
      <Seta className="bg-background/85 text-foreground shadow-sm backdrop-blur-md" />
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
        <Entrada atraso={0} duracao={0.8} className={MOSAICO.celulaGrande}>
          <BannerFoto banner={grande} aoEscolher={() => aoEscolher(grande)} />
        </Entrada>
        {primeiro && (
          <Entrada atraso={0.08} duracao={0.8}>
            <BannerCor banner={primeiro} tom="acento" aoEscolher={() => aoEscolher(primeiro)} />
          </Entrada>
        )}
        {segundo && (
          <Entrada atraso={0.14} duracao={0.8}>
            <BannerCor banner={segundo} tom="primaria" aoEscolher={() => aoEscolher(segundo)} />
          </Entrada>
        )}
        {largo && (
          <Entrada atraso={0.2} duracao={0.8} className={MOSAICO.celulaLarga}>
            <BannerOferta
              banner={largo}
              produto={produtoDoBanner(largo)}
              aoEscolher={() => aoEscolher(largo)}
            />
          </Entrada>
        )}
      </div>
    </section>
  )
}
