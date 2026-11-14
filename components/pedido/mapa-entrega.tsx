"use client"

import { HomeIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Image from "next/image"
import type { ReactNode } from "react"
import { useLoja } from "@/lib/loja-atual"
import { Motoboy } from "./motoboy"

export type FaseEntrega = "parado" | "buscando" | "achou" | "nada"

/** Loja e casa ficam a 10% das bordas: no celular, os pinos não encostam no canto. */
const INICIO = 10

/** Onde o entregador está na rota, em % da largura, em cada fase da busca. */
const POSICAO: Record<FaseEntrega, number> = {
  parado: 30,
  buscando: 60,
  achou: 72,
  nada: 30,
}

const CURVA = [0.23, 1, 0.32, 1] as const

/** Ruas do mapa ao fundo: só textura, bem apagada. */
function Ruas() {
  return (
    <svg
      viewBox="0 0 1200 420"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
      aria-hidden="true"
    >
      <g fill="none" stroke="white" strokeLinecap="round" opacity={0.07}>
        <path d="M-40 120 L1240 60" strokeWidth={22} />
        <path d="M-40 300 C300 260 700 360 1240 290" strokeWidth={28} />
        <path d="M180 -20 L260 440" strokeWidth={18} />
        <path d="M560 -20 C540 140 620 260 600 440" strokeWidth={16} />
        <path d="M930 -20 L860 440" strokeWidth={20} />
        <path d="M-40 210 L1240 200" strokeWidth={8} />
        <path d="M380 -20 L420 440" strokeWidth={8} />
        <path d="M760 -20 L780 440" strokeWidth={8} />
        <path d="M1080 -20 L1110 440" strokeWidth={8} />
      </g>
      {/* Quarteirões e uma praça. */}
      <g fill="white" opacity={0.035}>
        <rect x={40} y={140} width={120} height={50} rx={10} />
        <rect x={290} y={130} width={80} height={60} rx={10} />
        <rect x={640} y={90} width={100} height={90} rx={46} />
        <rect x={980} y={110} width={140} height={70} rx={10} />
        <rect x={430} y={220} width={110} height={40} rx={10} />
      </g>
    </svg>
  )
}

function Pino({
  rotulo,
  lado,
  atraso,
  pulsando = false,
  children,
}: {
  rotulo: ReactNode
  lado: "esquerda" | "direita"
  atraso: number
  pulsando?: boolean
  children: ReactNode
}) {
  return (
    <motion.div
      className="absolute bottom-3 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5"
      style={{ left: lado === "esquerda" ? `${INICIO}%` : `${100 - INICIO}%` }}
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", duration: 0.7, bounce: 0.45, delay: atraso }}
    >
      <span className="relative grid size-11 place-items-center rounded-full bg-white text-neutral-900 shadow-lg ring-4 ring-white/15 md:size-12">
        {pulsando && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-white"
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 1.9 }}
            transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: "easeOut" }}
          />
        )}
        {children}
      </span>
      <span className="rounded-full bg-black/35 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-white backdrop-blur-sm">
        {rotulo}
      </span>
    </motion.div>
  )
}

/**
 * Mapa da entrega no topo da tela: ruas ao fundo, a rota tracejada da loja até a casa
 * da pessoa e o entregador andando sobre ela. Durante a busca, ele acelera e avança;
 * achando o pedido, chega na porta.
 */
export function MapaEntrega({ fase, children }: { fase: FaseEntrega; children: ReactNode }) {
  const lojaEscolhida = useLoja()
  const reduzido = useReducedMotion()
  const posicao = POSICAO[fase]
  const rapido = fase === "buscando" || fase === "achou"

  return (
    <section
      className="relative isolate overflow-hidden rounded-[2rem] text-white shadow-[0_30px_60px_-30px_rgb(10_20_40/0.6)]"
      style={{
        background:
          "radial-gradient(120% 90% at 85% 0%, color-mix(in oklch, var(--primary) 70%, white 8%), transparent 60%), linear-gradient(160deg, color-mix(in oklch, var(--primary) 82%, black), color-mix(in oklch, var(--primary) 55%, black))",
      }}
      data-testid="mapa-entrega"
    >
      <Ruas />

      <div className="relative px-5 pt-7 pb-2 md:px-10 md:pt-10">{children}</div>

      {/* A rota: da loja (esquerda) até a casa (direita). */}
      <div className="relative h-40 md:h-52">
        <svg
          className="absolute inset-x-[10%] bottom-[38px] h-2 w-[80%] overflow-visible md:bottom-[42px]"
          viewBox="0 0 100 2"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <motion.line
            x1={0}
            y1={1}
            x2={100}
            y2={1}
            stroke="white"
            strokeOpacity={0.45}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="2 10"
            vectorEffect="non-scaling-stroke"
            animate={reduzido ? undefined : { strokeDashoffset: [0, -24] }}
            transition={{
              duration: rapido ? 0.35 : 1,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        </svg>
        {/* Trecho já percorrido, na cor de destaque da marca. */}
        <motion.div
          aria-hidden="true"
          className="absolute bottom-[40px] left-[10%] h-1 rounded-full bg-marca-acento md:bottom-[44px]"
          initial={{ width: "0%" }}
          animate={{ width: `${posicao - INICIO}%` }}
          transition={{ duration: fase === "buscando" ? 1.3 : 0.8, ease: CURVA, delay: 0.4 }}
        />

        <Pino
          rotulo={
            <>
              <span className="md:hidden">Loja</span>
              <span className="hidden md:inline">{lojaEscolhida.nome}</span>
            </>
          }
          lado="esquerda"
          atraso={0.2}
        >
          <span className="relative size-9 overflow-hidden rounded-full md:size-10">
            <Image src={lojaEscolhida.logo} alt="" fill sizes="40px" />
          </span>
        </Pino>
        <Pino rotulo="Você" lado="direita" atraso={0.55} pulsando={fase === "achou"}>
          <HomeIcon className="size-5" />
        </Pino>

        {/* O entregador sobre a rota. */}
        <motion.div
          className="absolute bottom-[22px] z-20 w-36 -translate-x-1/2 sm:w-44 md:bottom-[24px] md:w-64"
          initial={{ left: "-20%" }}
          animate={{ left: `${posicao}%` }}
          transition={{
            type: "spring",
            duration: fase === "buscando" ? 1.4 : 1,
            bounce: 0.15,
            delay: fase === "parado" ? 0.3 : 0,
          }}
        >
          <Motoboy acelerando={rapido} />
        </motion.div>
      </div>
      {/* Faixa reservada para o cartão do celular sobrepor sem cobrir a rota. */}
      <div aria-hidden="true" className="h-10 md:h-14" />
    </section>
  )
}
