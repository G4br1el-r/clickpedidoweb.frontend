"use client"

import { AnimatePresence, motion } from "motion/react"
import { type ReactNode, useId } from "react"
import { cn } from "@/lib/utils"

/*
 * Pizza desenhada a partir do nome do sabor, sem depender de foto cadastrada.
 * Sistema de coordenadas: 100 × 100, centro em (50, 50).
 */

const CENTRO = 50
const RAIO_MASSA = 48
const RAIO_MOLHO = 41
const RAIO_RECHEIO = 39.5
const RAIO_COBERTURA = 33

const COR_MASSA = "#D9A45B"
const COR_MASSA_ESCURA = "#B9823D"

type Desenho = (x: number, y: number, giro: number, aleatorio: () => number) => ReactNode

type Camada = { quantidade: number; desenho: Desenho }

type Receita = { base: string; manchas: string; camadas: Camada[] }

/** Gerador pseudoaleatório estável: o mesmo sabor sempre sai igual. */
function semente(texto: string) {
  let h = 1779033703 ^ texto.length
  for (const letra of texto) {
    h = Math.imul(h ^ letra.charCodeAt(0), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let estado = h >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) | 0
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

/* ---------- Coberturas ---------- */

const rodela =
  (fora: string, dentro: string, pontos: string, raio = 5.4): Desenho =>
  (x, y, giro) => (
    <g transform={`translate(${x} ${y}) rotate(${giro})`}>
      <circle r={raio} fill={fora} />
      <circle r={raio * 0.72} fill={dentro} />
      <circle cx={-raio * 0.28} cy={-raio * 0.2} r={raio * 0.15} fill={pontos} />
      <circle cx={raio * 0.3} cy={raio * 0.22} r={raio * 0.13} fill={pontos} />
      <circle cx={raio * 0.05} cy={raio * 0.42} r={raio * 0.1} fill={pontos} />
    </g>
  )

const mancha =
  (cor: string, tamanho = 5.5): Desenho =>
  (x, y, giro, aleatorio) => (
    <ellipse
      cx={x}
      cy={y}
      rx={tamanho * (0.85 + aleatorio() * 0.35)}
      ry={tamanho * (0.6 + aleatorio() * 0.25)}
      transform={`rotate(${giro} ${x} ${y})`}
      fill={cor}
      opacity={0.95}
    />
  )

const ponto =
  (cor: string, raio = 0.5): Desenho =>
  (x, y) => <circle cx={x} cy={y} r={raio} fill={cor} />

const cebola: Desenho = (x, y, giro) => (
  <ellipse
    cx={x}
    cy={y}
    rx={3.6}
    ry={2.1}
    transform={`rotate(${giro} ${x} ${y})`}
    fill="none"
    stroke="#E6D2EC"
    strokeWidth={0.9}
  />
)

const azeitona: Desenho = (x, y) => (
  <g>
    <circle cx={x} cy={y} r={2.1} fill="#2B2626" />
    <circle cx={x} cy={y} r={0.8} fill="#5C534F" />
  </g>
)

const folha: Desenho = (x, y, giro) => (
  <g transform={`translate(${x} ${y}) rotate(${giro})`}>
    <ellipse rx={4} ry={1.9} fill="#2F7D32" />
    <line x1={-3.4} x2={3.4} stroke="#55A858" strokeWidth={0.45} />
  </g>
)

const tira =
  (cor: string): Desenho =>
  (x, y, giro) => (
    <rect
      x={x - 3.2}
      y={y - 1.1}
      width={6.4}
      height={2.2}
      rx={1.1}
      fill={cor}
      transform={`rotate(${giro} ${x} ${y})`}
    />
  )

const CORES_CONFEITO = ["#E94B3C", "#F6C343", "#3DA35D", "#3B82F6", "#F472B6", "#FFFFFF"]
const confeito: Desenho = (x, y, giro, aleatorio) => (
  <rect
    x={x - 1.4}
    y={y - 0.5}
    width={2.8}
    height={1}
    rx={0.5}
    fill={CORES_CONFEITO[Math.floor(aleatorio() * CORES_CONFEITO.length)]}
    transform={`rotate(${giro} ${x} ${y})`}
  />
)

const QUEIJO = "#F3C150"
const MANCHA_QUEIJO = "#F8D982"

/** Receitas conhecidas, achadas por palavra no nome do sabor. */
const RECEITAS: { chaves: string[]; receita: Receita }[] = [
  {
    chaves: ["chocolate", "brigadeiro", "nutella"],
    receita: {
      base: "#5B3420",
      manchas: "#734428",
      camadas: [{ quantidade: 46, desenho: confeito }],
    },
  },
  {
    chaves: ["quatro queijos", "4 queijos"],
    receita: {
      base: QUEIJO,
      manchas: MANCHA_QUEIJO,
      camadas: [
        { quantidade: 5, desenho: mancha("#FFF6DD") },
        { quantidade: 5, desenho: mancha("#EFD58B") },
        { quantidade: 4, desenho: mancha("#F2EAD3", 4.5) },
        { quantidade: 14, desenho: ponto("#7E93B8", 0.95) },
      ],
    },
  },
  {
    chaves: ["calabresa"],
    receita: {
      base: QUEIJO,
      manchas: MANCHA_QUEIJO,
      camadas: [
        { quantidade: 10, desenho: rodela("#A8352A", "#C55142", "#F0C6A5") },
        { quantidade: 6, desenho: cebola },
        { quantidade: 26, desenho: ponto("#5E7B2E", 0.45) },
      ],
    },
  },
  {
    chaves: ["pepperoni", "salame"],
    receita: {
      base: QUEIJO,
      manchas: MANCHA_QUEIJO,
      camadas: [
        { quantidade: 12, desenho: rodela("#9E2A1E", "#B8372A", "#7A1C13", 5.8) },
        { quantidade: 18, desenho: ponto("#5E7B2E", 0.45) },
      ],
    },
  },
  {
    chaves: ["frango"],
    receita: {
      base: QUEIJO,
      manchas: MANCHA_QUEIJO,
      camadas: [
        { quantidade: 16, desenho: tira("#E2B57E") },
        { quantidade: 5, desenho: mancha("#FBF5E6", 5) },
        { quantidade: 16, desenho: ponto("#5E7B2E", 0.45) },
      ],
    },
  },
  {
    chaves: ["marguerita", "margherita", "margarita"],
    receita: {
      base: QUEIJO,
      manchas: MANCHA_QUEIJO,
      camadas: [
        { quantidade: 6, desenho: mancha("#FFF6DD", 6) },
        { quantidade: 7, desenho: rodela("#D63B2A", "#E8604B", "#F6C48C", 5) },
        { quantidade: 7, desenho: folha },
      ],
    },
  },
  {
    chaves: ["mussarela", "muçarela", "mucarela", "queijo"],
    receita: {
      base: QUEIJO,
      manchas: MANCHA_QUEIJO,
      camadas: [
        { quantidade: 9, desenho: mancha("#FFF6DD", 6) },
        { quantidade: 6, desenho: azeitona },
        { quantidade: 22, desenho: ponto("#5E7B2E", 0.45) },
      ],
    },
  },
]

/** Para sabores desconhecidos: coberturas genéricas, sorteadas a partir do nome. */
const GENERICAS: Desenho[] = [
  rodela("#A8352A", "#C55142", "#F0C6A5"),
  azeitona,
  folha,
  tira("#E2B57E"),
  mancha("#FFF6DD", 5),
  cebola,
]

function receitaDo(sabor: string): Receita {
  const nome = normalizar(sabor)
  const conhecida = RECEITAS.find(({ chaves }) =>
    chaves.some((chave) => nome.includes(normalizar(chave))),
  )
  if (conhecida) return conhecida.receita
  const aleatorio = semente(nome)
  const primeira = GENERICAS[Math.floor(aleatorio() * GENERICAS.length)]
  const segunda = GENERICAS[Math.floor(aleatorio() * GENERICAS.length)]
  return {
    base: QUEIJO,
    manchas: MANCHA_QUEIJO,
    camadas: [
      { quantidade: 9, desenho: primeira },
      { quantidade: 7, desenho: segunda },
      { quantidade: 18, desenho: ponto("#5E7B2E", 0.45) },
    ],
  }
}

/** Distribui as peças em espiral (ângulo de ouro), com um pouco de variação. */
function posicoes(quantidade: number, aleatorio: () => number, deslocamento: number) {
  return Array.from({ length: quantidade }, (_, indice) => {
    const raio = Math.sqrt((indice + 0.5) / quantidade) * RAIO_COBERTURA
    const angulo = indice * 2.39996 + deslocamento
    return {
      x: CENTRO + Math.cos(angulo) * raio + (aleatorio() - 0.5) * 3,
      y: CENTRO + Math.sin(angulo) * raio + (aleatorio() - 0.5) * 3,
      giro: aleatorio() * 360,
    }
  })
}

/** Peça caindo sobre a pizza: vem de cima, maior e transparente, e assenta com mola. */
const CAIR = { opacity: 0, y: -14, scale: 1.7 }
const ASSENTAR = { opacity: 1, y: 0, scale: 1 }

/**
 * Recheio de um sabor: base (queijo ou chocolate), manchas e coberturas.
 * Animado, o queijo derrete e as coberturas caem uma a uma, como se fossem espalhadas.
 */
function Recheio({ sabor, animar = false }: { sabor: string; animar?: boolean }) {
  const receita = receitaDo(sabor)
  const aleatorio = semente(sabor)
  const manchas = posicoes(9, aleatorio, 0.7)

  return (
    <g>
      <motion.circle
        cx={CENTRO}
        cy={CENTRO}
        r={RAIO_RECHEIO}
        fill={receita.base}
        style={{ transformOrigin: "50px 50px" }}
        initial={animar ? { scale: 0.88, opacity: 0.4 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
      />
      {manchas.map(({ x, y, giro }) => (
        <ellipse
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          rx={6.5}
          ry={3.6}
          transform={`rotate(${giro} ${x} ${y})`}
          fill={receita.manchas}
          opacity={0.7}
        />
      ))}
      {receita.camadas.map((camada, indiceCamada) =>
        posicoes(camada.quantidade, aleatorio, indiceCamada * 1.3).map(({ x, y, giro }, indice) => (
          // A ordem das peças é fixa para o mesmo sabor, então o índice serve de chave.
          <motion.g
            // biome-ignore lint/suspicious/noArrayIndexKey: peças geradas, sempre na mesma ordem
            key={`${indiceCamada}-${indice}`}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={animar ? CAIR : false}
            animate={ASSENTAR}
            transition={{
              type: "spring",
              duration: 0.45,
              bounce: 0.35,
              delay: 0.12 + indiceCamada * 0.14 + indice * 0.016,
            }}
          >
            {camada.desenho(x, y, giro, aleatorio)}
          </motion.g>
        )),
      )}
    </g>
  )
}

export type BordaPizza = { cor?: string; recheada?: boolean }

export type PizzaSvgProps = {
  /** Um sabor para a pizza inteira, ou dois para meio a meio. `null` deixa a metade vazia. */
  sabores: [string | null] | [string | null, string | null]
  borda?: BordaPizza
  /** Parte em escolha agora: as outras ficam apagadas para a pessoa saber onde está. */
  destaque?: "esquerda" | "direita" | "borda" | null
  className?: string
  /** Desliga as animações (miniaturas de lista). */
  estatica?: boolean
  /** Tudo escolhido: sobe um vapor, de pizza saindo do forno. */
  pronta?: boolean
}

/** Fios de vapor subindo sobre a pizza pronta. */
function Vapor() {
  return (
    <g fill="none" stroke="var(--muted-foreground)" strokeWidth={1.8} strokeLinecap="round">
      {[
        { x: 38, atraso: 0 },
        { x: 50, atraso: 0.35 },
        { x: 62, atraso: 0.18 },
      ].map(({ x, atraso }) => (
        <motion.path
          key={x}
          d={`M ${x} 12 q -4 -6 0 -12 t 0 -12`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: [0, 0.7, 0], y: [6, -2, -10] }}
          transition={{ duration: 1.6, delay: 0.2 + atraso, repeat: 2, ease: "easeOut" }}
        />
      ))}
    </g>
  )
}

const CURVA = [0.23, 1, 0.32, 1] as const

/** Recheio de uma parte, entrando ao trocar de sabor. */
function Parte({ sabor, estatica }: { sabor: string | null; estatica: boolean }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.g
        key={sabor ?? "vazia"}
        style={{ transformOrigin: "50px 50px" }}
        initial={estatica ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.18 } }}
        transition={{ duration: 0.15 }}
      >
        {sabor ? (
          <Recheio sabor={sabor} animar={!estatica} />
        ) : (
          <circle cx={CENTRO} cy={CENTRO} r={RAIO_RECHEIO} fill={QUEIJO} opacity={0.55} />
        )}
      </motion.g>
    </AnimatePresence>
  )
}

/** Massa (com o recheio da borda, quando recheada) e molho. */
function Massa({
  id,
  corRecheioBorda,
  estatica,
}: {
  id: string
  corRecheioBorda?: string
  estatica: boolean
}) {
  return (
    <>
      {/* A massa estufa um pouco quando a borda muda, como se o recheio entrasse nela. */}
      <motion.circle
        key={corRecheioBorda ?? "simples"}
        cx={CENTRO}
        cy={CENTRO}
        r={RAIO_MASSA}
        fill={`url(#${id}-massa)`}
        style={{ transformOrigin: "50px 50px" }}
        initial={estatica ? false : { scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
      />
      <AnimatePresence initial={false}>
        {corRecheioBorda && (
          <motion.circle
            key={corRecheioBorda}
            cx={CENTRO}
            cy={CENTRO}
            r={44.6}
            fill="none"
            stroke={corRecheioBorda}
            strokeWidth={3.4}
            style={{ rotate: -90, transformOrigin: "50px 50px" }}
            initial={estatica ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: CURVA }}
          />
        )}
      </AnimatePresence>
      {[20, 95, 160, 230, 300].map((angulo) => {
        const x = CENTRO + Math.cos((angulo * Math.PI) / 180) * 45.5
        const y = CENTRO + Math.sin((angulo * Math.PI) / 180) * 45.5
        return (
          <ellipse
            key={angulo}
            cx={x}
            cy={y}
            rx={2.2}
            ry={1.1}
            fill={COR_MASSA_ESCURA}
            opacity={0.5}
            transform={`rotate(${angulo + 90} ${x} ${y})`}
          />
        )
      })}
      <circle cx={CENTRO} cy={CENTRO} r={RAIO_MOLHO} fill="#C8452C" />
    </>
  )
}

/** Parte fora de foco: só um pouco mais suave, para o sabor escolhido não parecer desbotado. */
const APAGADA = { opacity: 0.82, filter: "saturate(0.8)" }
const ACESA = { opacity: 1, filter: "saturate(1)" }
const SUAVE = { duration: 0.45, ease: CURVA }

/**
 * Pizza vista de cima: massa, molho, recheio e borda, montada só com SVG.
 * Em meio a meio, a metade em escolha se afasta um pouco do centro, como uma fatia
 * sendo servida, e o resto fica suave. Na escolha da borda, só a borda fica acesa.
 */
export function PizzaSvg({
  sabores,
  borda,
  destaque = null,
  className,
  estatica = false,
  pronta = false,
}: PizzaSvgProps) {
  const id = useId().replace(/:/g, "")
  const meioAMeio = sabores.length === 2
  const corRecheioBorda = borda?.recheada ? borda.cor : undefined
  const recheioApagado = destaque === "borda"

  return (
    <svg
      viewBox="0 0 100 100"
      overflow="visible"
      className={cn("block overflow-visible", className)}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${id}-massa`} cx="50%" cy="45%" r="55%">
          <stop offset="78%" stopColor={COR_MASSA} />
          <stop offset="100%" stopColor={COR_MASSA_ESCURA} />
        </radialGradient>
        <clipPath id={`${id}-esquerda`}>
          <rect x="-10" y="-10" width="60" height="120" />
        </clipPath>
        <clipPath id={`${id}-direita`}>
          <rect x="50" y="-10" width="60" height="120" />
        </clipPath>
      </defs>

      {meioAMeio ? (
        (["esquerda", "direita"] as const).map((lado, indice) => {
          const daVez = destaque === lado
          const foraDeFoco = destaque !== null && destaque !== "borda" && !daVez
          return (
            <motion.g
              key={lado}
              initial={false}
              animate={{ x: daVez ? (lado === "esquerda" ? -3.5 : 3.5) : 0 }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}
            >
              <motion.g
                clipPath={`url(#${id}-${lado})`}
                initial={false}
                animate={foraDeFoco ? APAGADA : ACESA}
                transition={SUAVE}
              >
                <Massa id={id} corRecheioBorda={corRecheioBorda} estatica={estatica} />
                <motion.g
                  initial={false}
                  animate={recheioApagado ? APAGADA : ACESA}
                  transition={SUAVE}
                >
                  <Parte sabor={sabores[indice] ?? null} estatica={estatica} />
                </motion.g>
              </motion.g>
            </motion.g>
          )
        })
      ) : (
        <>
          <Massa id={id} corRecheioBorda={corRecheioBorda} estatica={estatica} />
          <motion.g initial={false} animate={recheioApagado ? APAGADA : ACESA} transition={SUAVE}>
            <Parte sabor={sabores[0]} estatica={estatica} />
          </motion.g>
        </>
      )}

      {pronta && !estatica && <Vapor />}
    </svg>
  )
}
