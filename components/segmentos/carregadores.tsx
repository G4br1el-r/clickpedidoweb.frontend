"use client"

import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Carregadores de cada nicho: um desenho pequeno, do próprio ofício, em laço curto.
 * Usam a cor da loja (`--primary`) e o acento (`--marca-acento`), então vestem qualquer marca.
 * Com movimento reduzido, ficam parados, inteiros e legíveis.
 */
type CarregadorProps = { className?: string }

const EASE = [0.65, 0, 0.35, 1] as const

function Moldura({
  segmento,
  className,
  children,
}: {
  segmento: string
  className?: string
  children: ReactNode
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      data-testid={`carregador-${segmento}`}
      className={cn("size-10 shrink-0 overflow-visible", className)}
    >
      {children}
    </svg>
  )
}

/** Laço infinito, ou parado quando a pessoa pede menos movimento. */
function useLaco() {
  const reduzido = useReducedMotion()
  return (duracao: number, extra: object = {}) =>
    reduzido ? { duration: 0 } : { duration: duracao, repeat: Number.POSITIVE_INFINITY, ...extra }
}

/** Pizzaria: a pizza gira devagar sobre a pá, e falta uma fatia, que acabou de sair. */
export function CarregadorPizzaria({ className }: CarregadorProps) {
  const laco = useLaco()
  const reduzido = useReducedMotion()
  return (
    <Moldura segmento="pizzaria" className={className}>
      <motion.g
        style={{ transformOrigin: "24px 24px" }}
        animate={reduzido ? undefined : { rotate: 360 }}
        transition={laco(2.4, { ease: "linear" })}
      >
        <path d="M24 24 L24 4 A20 20 0 1 1 6.7 14 Z" fill="#E9B872" />
        <path d="M24 24 L24 8 A16 16 0 1 1 10.1 16 Z" fill="var(--marca-acento)" />
        {[
          [30, 14],
          [34, 28],
          [22, 34],
          [14, 26],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={2.3} fill="#F6E7C8" />
        ))}
      </motion.g>
    </Moldura>
  )
}

/** Farmácia: a cápsula dá meia-volta e encaixa, de novo e de novo. */
export function CarregadorFarmacia({ className }: CarregadorProps) {
  const laco = useLaco()
  const reduzido = useReducedMotion()
  return (
    <Moldura segmento="farmacia" className={className}>
      <motion.g
        style={{ transformOrigin: "24px 24px" }}
        initial={{ rotate: -40 }}
        animate={reduzido ? undefined : { rotate: [-40, 140, 140, 320] }}
        transition={laco(1.8, { ease: EASE, times: [0, 0.45, 0.55, 1] })}
      >
        <rect x={10} y={18} width={28} height={12} rx={6} fill="var(--primary)" />
        <path d="M24 18 h8 a6 6 0 0 1 0 12 h-8 Z" fill="#FFFFFF" />
        <rect
          x={10}
          y={18}
          width={28}
          height={12}
          rx={6}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.5}
        />
      </motion.g>
    </Moldura>
  )
}

/** Adega: o copo enche e esvazia, com a espuma acompanhando o nível. */
export function CarregadorAdega({ className }: CarregadorProps) {
  const laco = useLaco()
  const reduzido = useReducedMotion()
  return (
    <Moldura segmento="adega" className={className}>
      <defs>
        <clipPath id="copo-adega">
          <path d="M14 8 h20 l-2.5 32 a3 3 0 0 1 -3 2.8 h-9 a3 3 0 0 1 -3 -2.8 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#copo-adega)">
        <motion.g
          initial={{ y: 22 }}
          animate={reduzido ? undefined : { y: [30, 10, 10, 30] }}
          transition={laco(2.6, { ease: EASE, times: [0, 0.45, 0.6, 1] })}
        >
          <rect x={8} y={6} width={32} height={40} fill="var(--marca-acento)" />
          <rect x={8} y={3} width={32} height={4} rx={2} fill="#FFF7E6" />
        </motion.g>
      </g>
      <path
        d="M14 8 h20 l-2.5 32 a3 3 0 0 1 -3 2.8 h-9 a3 3 0 0 1 -3 -2.8 Z"
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Moldura>
  )
}

/** Açougue: o ponteiro da balança procura o peso e assenta. */
export function CarregadorAcougue({ className }: CarregadorProps) {
  const laco = useLaco()
  const reduzido = useReducedMotion()
  return (
    <Moldura segmento="acougue" className={className}>
      <path
        d="M8 32 A16 16 0 0 1 40 32"
        fill="none"
        stroke="var(--primary)"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {[-60, -30, 0, 30, 60].map((angulo) => (
        <line
          key={angulo}
          x1={24}
          y1={19}
          x2={24}
          y2={21.5}
          stroke="var(--primary)"
          strokeWidth={1.6}
          strokeLinecap="round"
          transform={`rotate(${angulo} 24 32)`}
        />
      ))}
      <motion.line
        x1={24}
        y1={32}
        x2={24}
        y2={20}
        stroke="var(--marca-acento)"
        strokeWidth={2.4}
        strokeLinecap="round"
        style={{ transformOrigin: "24px 32px" }}
        initial={{ rotate: 18 }}
        animate={reduzido ? undefined : { rotate: [-55, 40, 10, 22, 18, -55] }}
        transition={laco(2.2, { ease: EASE, times: [0, 0.3, 0.45, 0.55, 0.75, 1] })}
      />
      <circle cx={24} cy={32} r={3} fill="var(--primary)" />
      <rect x={10} y={38} width={28} height={3} rx={1.5} fill="var(--primary)" opacity={0.35} />
    </Moldura>
  )
}

/** Salão: a tesoura abre e fecha, num corte limpo. */
export function CarregadorSalao({ className }: CarregadorProps) {
  const laco = useLaco()
  const reduzido = useReducedMotion()
  const lamina = (lado: 1 | -1) => (
    <motion.g
      style={{ transformOrigin: "24px 22px" }}
      initial={{ rotate: lado * 14 }}
      animate={reduzido ? undefined : { rotate: [lado * 22, lado * 2, lado * 22] }}
      transition={laco(0.9, { ease: EASE })}
    >
      <path
        d={lado === 1 ? "M24 22 L38 6" : "M24 22 L10 6"}
        stroke="var(--primary)"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle
        cx={lado === 1 ? 17 : 31}
        cy={33}
        r={5.5}
        fill="none"
        stroke="var(--marca-acento)"
        strokeWidth={2.6}
      />
      <path
        d={lado === 1 ? "M24 22 L19.5 28.5" : "M24 22 L28.5 28.5"}
        stroke="var(--marca-acento)"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </motion.g>
  )
  return (
    <Moldura segmento="salao" className={className}>
      {lamina(1)}
      {lamina(-1)}
      <circle cx={24} cy={22} r={2} fill="var(--primary)" />
    </Moldura>
  )
}

/** Lanchonete: o vapor sobe da chapa, em três fios desencontrados. */
export function CarregadorLanchonete({ className }: CarregadorProps) {
  const laco = useLaco()
  const reduzido = useReducedMotion()
  return (
    <Moldura segmento="lanchonete" className={className}>
      {[14, 24, 34].map((x, indice) => (
        <motion.path
          key={x}
          d={`M${x} 30 c-3 -4 3 -6 0 -10 c-3 -4 3 -6 0 -10`}
          fill="none"
          stroke="var(--marca-acento)"
          strokeWidth={2.2}
          strokeLinecap="round"
          initial={{ opacity: 0.8, y: 0 }}
          animate={reduzido ? undefined : { opacity: [0, 0.9, 0], y: [4, -2, -8] }}
          transition={laco(1.6, { ease: "easeOut", delay: indice * 0.35 })}
        />
      ))}
      <rect x={6} y={34} width={36} height={5} rx={2.5} fill="var(--primary)" />
      <rect x={10} y={39} width={4} height={4} rx={1} fill="var(--primary)" opacity={0.5} />
      <rect x={34} y={39} width={4} height={4} rx={1} fill="var(--primary)" opacity={0.5} />
    </Moldura>
  )
}
