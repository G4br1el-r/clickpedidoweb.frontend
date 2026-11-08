"use client"

import { motion } from "motion/react"
import type { ItemSacola } from "@/lib/sacola"
import { PizzaSvg } from "./pizza-svg"

/** Sabores da primeira pizza do pedido: as escolhas que não são borda, ou o próprio nome. */
function saboresDoPedido(itens: ItemSacola[]): [string | null] | [string | null, string | null] {
  const pizza = itens.find((item) => item.resumo.some((parte) => !parte.startsWith("Borda")))
  if (!pizza) return [itens[0]?.nome ?? "calabresa"]
  const sabores = pizza.resumo.filter((parte) => !parte.startsWith("Borda"))
  return sabores.length >= 2 ? [sabores[0], sabores[1]] : [sabores[0] ?? pizza.nome]
}

export const MENSAGENS_ENVIO_PIZZA = [
  "Abrindo a massa",
  "Caprichando no recheio",
  "Cortando as fatias",
  "Saindo quentinha!",
]

const CURVA = [0.23, 1, 0.32, 1] as const
const VAI_E_VEM = [0.65, 0, 0.35, 1] as const

/**
 * Giro da pizza em cada etapa. Termina num quarto de volta: a fatia que se solta no fim
 * é desenhada à esquerda e, girada, sobe para cima.
 */
const GIRO = [360, 450, 450, 450]

/** Cortes: quatro diâmetros, oito fatias. Ângulos em graus, no desenho de 100 × 100. */
const CORTES = [22.5, 67.5, 112.5, 157.5].map((angulo) => {
  const rad = (angulo * Math.PI) / 180
  const dx = Math.cos(rad) * 47
  const dy = Math.sin(rad) * 47
  return { x1: 50 - dx, y1: 50 - dy, x2: 50 + dx, y2: 50 + dy }
})

/** Fatia da esquerda (entre 157,5° e 202,5°) e o resto da pizza, recortados em CSS. */
const FATIA = "polygon(50% 50%, -19.3% 78.7%, -19.3% 21.3%)"
const SEM_FATIA =
  "polygon(50% 50%, -19.3% 21.3%, -20% -20%, 120% -20%, 120% 120%, -20% 120%, -19.3% 78.7%)"

/** Massa crua, girando e abrindo, com o molho entrando em espiral. */
function MassaCrua() {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
      <motion.g
        style={{ transformOrigin: "50px 50px" }}
        initial={{ scale: 0.55 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.9, ease: CURVA }}
      >
        <circle cx={50} cy={50} r={47} fill="#EED7AE" />
        <circle cx={50} cy={50} r={47} fill="none" stroke="#DDBF8A" strokeWidth={2.4} />
        {[
          [36, 38],
          [62, 34],
          [58, 64],
          [33, 60],
          [48, 50],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={2.4} fill="#F6E6C6" />
        ))}
        {/* Molho espalhado com a concha, do centro para fora. */}
        <motion.path
          d="M50 50 m0 -3 a3 3 0 1 1 -0.1 0 M50 50 m0 -9 a9 9 0 1 1 -0.1 0 M50 50 m0 -16 a16 16 0 1 1 -0.1 0 M50 50 m0 -24 a24 24 0 1 1 -0.1 0 M50 50 m0 -32 a32 32 0 1 1 -0.1 0 M50 50 m0 -38 a38 38 0 1 1 -0.1 0"
          fill="none"
          stroke="#C8452C"
          strokeWidth={7.5}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.9 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7, delay: 0.45, ease: "easeInOut" }}
        />
      </motion.g>
    </svg>
  )
}

/** Farinha que sobe quando a massa é aberta. */
function Farinha() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
    >
      {Array.from({ length: 12 }, (_, indice) => {
        const angulo = (indice / 12) * Math.PI * 2
        return (
          <motion.circle
            // biome-ignore lint/suspicious/noArrayIndexKey: partículas fixas, só decorativas
            key={indice}
            cx={50 + Math.cos(angulo) * 40}
            cy={50 + Math.sin(angulo) * 40}
            r={indice % 3 === 0 ? 1.6 : 1}
            fill="#FFFFFF"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.9, 0],
              x: Math.cos(angulo) * 12,
              y: Math.sin(angulo) * 12 - 4,
            }}
            transition={{ duration: 0.9, delay: 0.15 + (indice % 4) * 0.06, ease: "easeOut" }}
          />
        )
      })}
    </svg>
  )
}

/** Cortes riscados na pizza e o cortador passando por cima de cada um. */
function Cortes({ cortando, pronta }: { cortando: boolean; pronta: boolean }) {
  const passo = 0.28
  const caminho = CORTES.flatMap(({ x1, y1, x2, y2 }) => [
    [x1, y1],
    [x2, y2],
  ])
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 size-full overflow-visible"
      aria-hidden="true"
    >
      {CORTES.map(({ x1, y1, x2, y2 }, indice) => (
        <motion.line
          key={x1}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#7A3B12"
          strokeWidth={0.9}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={
            cortando || pronta
              ? { pathLength: 1, opacity: pronta ? 0.35 : 0.55 }
              : { pathLength: 0, opacity: 0 }
          }
          transition={{
            pathLength: { duration: passo * 0.8, delay: indice * passo, ease: "easeInOut" },
            opacity: { duration: 0.2, delay: pronta ? 0 : indice * passo },
          }}
        />
      ))}
      {cortando && (
        <motion.g
          initial={{ opacity: 0, x: caminho[0][0], y: caminho[0][1] }}
          animate={{
            opacity: [0, 1, 1, 1, 1, 1, 1, 1, 0],
            x: [caminho[0][0], ...caminho.map(([x]) => x)],
            y: [caminho[0][1], ...caminho.map(([, y]) => y)],
          }}
          transition={{ duration: passo * 4 + 0.1, ease: "easeInOut" }}
        >
          {/* Cortador de pizza: disco de metal girando e o cabo. */}
          <rect x={4} y={-2.2} width={16} height={4.4} rx={2.2} fill="#7C2D12" />
          <motion.g animate={{ rotate: 720 }} transition={{ duration: passo * 4, ease: "linear" }}>
            <circle r={6.5} fill="#E5E7EB" stroke="#9CA3AF" strokeWidth={0.8} />
            <line x1={-6} x2={6} stroke="#9CA3AF" strokeWidth={0.6} />
            <circle r={1.6} fill="#6B7280" />
          </motion.g>
        </motion.g>
      )}
    </svg>
  )
}

/**
 * Arte do envio na pizzaria: o preparo da pizza do pedido, visto de cima, numa tábua.
 * 1. A massa gira e abre, solta farinha, e o molho entra em espiral.
 * 2. O queijo derrete e os ingredientes caem, com a pizza girando devagar.
 * 3. O cortador risca as oito fatias.
 * 4. Uma fatia se solta e sobe o vapor: pronta.
 */
export function ArteEnvioPizza({ etapa, itens }: { etapa: number; itens: ItemSacola[] }) {
  const sabores = saboresDoPedido(itens)
  const montada = etapa >= 1
  const cortando = etapa === 2
  const pronta = etapa === 3

  return (
    <div className="relative grid size-72 place-items-center md:size-80" data-etapa={etapa}>
      {/* Tábua de madeira, com a sombra no balcão. */}
      <div
        aria-hidden="true"
        className="absolute inset-[2%] rounded-full bg-black/25 blur-xl dark:bg-black/60"
        style={{ transform: "translateY(6%)" }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-[3%] rounded-full shadow-inner"
        style={{
          background:
            "repeating-radial-gradient(circle at 50% 50%, #C99360 0 6px, #BF8752 6px 7px, #C99360 7px 13px), #C99360",
        }}
      />

      <motion.div
        className="relative size-[80%]"
        initial={{ rotate: 0 }}
        animate={{
          rotate: GIRO[etapa] ?? 450,
          scale: pronta ? [1, 1.05, 1] : 1,
        }}
        transition={{
          rotate:
            etapa === 0 ? { duration: 1.15, ease: CURVA } : { duration: 1.2, ease: VAI_E_VEM },
          scale: { duration: 0.5, ease: CURVA },
        }}
      >
        {!montada ? (
          <>
            <MassaCrua />
            <Farinha />
          </>
        ) : (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {/* A pizza sem a fatia da esquerda… */}
            <div className="absolute inset-0" style={{ clipPath: SEM_FATIA }}>
              <PizzaSvg sabores={sabores} className="size-full drop-shadow-md" />
            </div>
            {/* …e a fatia, que se solta no fim (girada, ela sobe). */}
            <motion.div
              className="absolute inset-0"
              style={{ clipPath: FATIA }}
              animate={pronta ? { x: "-9%", scale: 1.04 } : { x: "0%", scale: 1 }}
              transition={{ type: "spring", duration: 0.7, bounce: 0.3 }}
            >
              <PizzaSvg sabores={sabores} className="size-full drop-shadow-lg" />
            </motion.div>
            <Cortes cortando={cortando} pronta={pronta} />
          </motion.div>
        )}
      </motion.div>

      {/* Vapor fora do giro, para subir sempre para cima. */}
      {pronta && (
        <svg
          viewBox="0 0 100 40"
          className="pointer-events-none absolute inset-x-[25%] top-[-6%] overflow-visible"
          aria-hidden="true"
        >
          {[
            { x: 36, atraso: 0 },
            { x: 50, atraso: 0.3 },
            { x: 64, atraso: 0.15 },
          ].map(({ x, atraso }) => (
            <motion.path
              key={x}
              d={`M ${x} 36 q -5 -7 0 -14 t 0 -14`}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={2.4}
              strokeLinecap="round"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: [0, 0.75, 0], y: [8, -2, -12] }}
              transition={{ duration: 1.4, delay: 0.25 + atraso, repeat: 2, ease: "easeOut" }}
            />
          ))}
        </svg>
      )}

      {/* Brilho de "ficou pronta". */}
      {pronta && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[15%] rounded-full"
          style={{ background: "radial-gradient(circle, rgb(255 230 160 / 0.5), transparent 65%)" }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 1.35] }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
        />
      )}
    </div>
  )
}
