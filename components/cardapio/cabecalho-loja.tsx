"use client"

import { motion, useScroll, useTransform } from "motion/react"
import Image from "next/image"
import { Entrada } from "@/components/entrada"
import { Foto } from "@/components/foto"
import { useLoja } from "@/lib/loja-atual"
import { BarraTopo } from "./barra-topo"
import { PainelLoja } from "./painel-loja"

type CabecalhoLojaProps = {
  aoVerDetalhes: () => void
  termo: string
  aoBuscar: (termo: string) => void
}

/**
 * A foto da loja é o fundo de tudo: a marca aparece por cima dela, na largura inteira.
 * O painel de informações fica exatamente na divisória: a metade de baixo dele é coberta
 * pela cor da página, então a linha passa no meio do painel, qualquer que seja a altura dele.
 */
export function CabecalhoLoja({ aoVerDetalhes, termo, aoBuscar }: CabecalhoLojaProps) {
  const loja = useLoja()
  const { scrollY } = useScroll()
  const deslocamento = useTransform(scrollY, [0, 500], [0, 90])

  return (
    <section
      aria-labelledby="nome-da-loja"
      data-testid="cabecalho-loja"
      className="relative bg-black text-white"
    >
      {/* Só a foto é recortada; a sombra do painel pode passar para a página. */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.div className="absolute -inset-y-24 inset-x-0" style={{ y: deslocamento }}>
          {/* A foto chega de um leve zoom, em CSS, já na primeira pintura. */}
          <div className="entrada-foto size-full">
            <Foto src={loja.banner} alt="" sizes="100vw" className="size-full" preload />
          </div>
        </motion.div>
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
      </div>

      <Entrada de="cima" atraso={0.08} className="relative z-10">
        <BarraTopo aoVerDetalhes={aoVerDetalhes} />
      </Entrada>

      <div className="relative mx-auto flex w-full max-w-[1320px] items-center gap-4 px-4 pt-1 pb-8 md:gap-6 md:px-6 md:pt-6 md:pb-[90px] lg:pb-[106px] 2xl:max-w-[1640px] [@media(max-height:500px)]:md:pt-0 [@media(max-height:500px)]:md:pb-14">
        <Entrada
          de="zoom"
          atraso={0.12}
          duracao={0.8}
          className="relative size-20 shrink-0 overflow-hidden rounded-full bg-white ring-4 ring-white/15 md:size-28 lg:size-36"
        >
          <Image
            src={loja.logo}
            alt={`Logo da ${loja.nome}`}
            fill
            sizes="(min-width: 1024px) 144px, (min-width: 768px) 112px, 80px"
            preload
          />
        </Entrada>

        <div className="min-w-0">
          <Entrada
            atraso={0.2}
            desfoque
            className="flex items-center gap-2 text-sm font-semibold text-emerald-300 md:text-base"
          >
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 [animation-iteration-count:3]" />
              <span className="relative inline-flex size-2 rounded-full bg-current" />
            </span>
            {loja.status.texto}
          </Entrada>
          <Entrada atraso={0.27} desfoque>
            <h1
              id="nome-da-loja"
              className="text-3xl leading-[1.05] font-extrabold tracking-tight md:text-5xl lg:text-6xl"
            >
              {loja.nome}
            </h1>
          </Entrada>
          <Entrada atraso={0.34} desfoque>
            <p className="mt-1 text-[15px] text-white/90 md:text-lg lg:text-xl">{loja.slogan}</p>
          </Entrada>
        </div>
      </div>

      <div className="relative" data-testid="divisoria-painel">
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-background" />
        <div className="relative mx-auto w-full max-w-[1320px] 2xl:max-w-[1640px]">
          <PainelLoja termo={termo} aoBuscar={aoBuscar} />
        </div>
      </div>
    </section>
  )
}
