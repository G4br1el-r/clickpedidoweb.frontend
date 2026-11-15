"use client"

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
 * A foto da loja ao fundo, de ponta a ponta, com um véu escuro que garante a leitura:
 * em cima, as ações; embaixo, a marca, o nome e o slogan. Logo abaixo da foto, no fundo
 * da página, a régua do que a pessoa precisa saber antes de pedir e a busca.
 */
export function CabecalhoLoja({ aoVerDetalhes, termo, aoBuscar }: CabecalhoLojaProps) {
  const loja = useLoja()

  return (
    <section aria-labelledby="nome-da-loja" data-testid="cabecalho-loja" className="relative">
      <div
        data-testid="foto-da-loja"
        className="relative isolate flex min-h-[300px] flex-col overflow-hidden bg-neutral-900 text-white md:min-h-[360px]"
      >
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          {/* A foto assenta de um leve zoom, uma vez, na primeira pintura. */}
          <div className="entrada-foto size-full">
            <Foto src={loja.banner} alt="" sizes="100vw" className="size-full" preload />
          </div>
          <div className="absolute inset-0 bg-linear-to-b from-black/55 via-black/25 to-black/80" />
        </div>

        <BarraTopo aoVerDetalhes={aoVerDetalhes} />

        <div className="mx-auto mt-auto w-full max-w-[1120px]">
          <Entrada
            atraso={0.03}
            duracao={0.3}
            className="flex items-end gap-4 px-4 pt-10 pb-6 md:gap-5 md:px-6 md:pb-10"
          >
            <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-white/25 md:size-[72px] md:rounded-[20px]">
              <Image
                src={loja.logo}
                alt={`Logo da ${loja.nome}`}
                fill
                sizes="(min-width: 768px) 72px, 56px"
                preload
              />
            </span>
            <div className="min-w-0">
              <h1
                id="nome-da-loja"
                className="text-[28px] leading-[1.06] font-semibold tracking-[-0.025em] text-balance md:text-[44px]"
              >
                {loja.nome}
              </h1>
              <p className="mt-1 text-sm text-white/80 md:text-base">{loja.slogan}</p>
              {/* O status fecha o bloco, como um fato a mais; o nome abre sem nada em cima. */}
              <p className="mt-2 flex items-center gap-2 text-[13px] font-medium text-emerald-300">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                {loja.status.texto}
              </p>
            </div>
          </Entrada>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1120px]">
        <PainelLoja termo={termo} aoBuscar={aoBuscar} />
      </div>
    </section>
  )
}
