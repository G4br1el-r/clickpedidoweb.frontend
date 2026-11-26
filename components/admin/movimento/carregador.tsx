"use client"

import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"
import { CURVA_SAIDA } from "@/lib/admin/movimento"
import { cn } from "@/lib/utils"

/**
 * Carregadores do painel: cada situação tem o seu desenho, nenhum é "o giro de sempre".
 * - pontos: três pontos em onda, para o botão que está salvando.
 * - barra: um fio que corre pelo topo de uma lista ou tabela que atualiza.
 * - papel: o papel que sai da impressora, para o cupom que imprime.
 * - radar: ondas que partem de um ponto, para o que sincroniza ao vivo.
 * - anel: um arco que respira ao girar, para a página ou o painel que carrega.
 * Herdam a cor do texto ao redor. Com movimento reduzido, ficam parados e legíveis.
 */
export const VARIANTES_CARREGADOR = ["pontos", "barra", "papel", "radar", "anel"] as const
export type VarianteCarregador = (typeof VARIANTES_CARREGADOR)[number]

type CarregadorProps = {
  variante: VarianteCarregador
  /** O que está acontecendo, dito em voz alta pelo leitor de tela. */
  rotulo?: string
  /** Só desenho: outro elemento da tela já avisa o leitor de tela (ex.: dentro de um botão). */
  decorativo?: boolean
  className?: string
}

const LACO = { repeat: Number.POSITIVE_INFINITY } as const

function Pontos({ reduzido }: { reduzido: boolean }) {
  return (
    <>
      {[0, 1, 2].map((indice) => (
        <motion.span
          key={indice}
          className="size-1.5 rounded-full bg-current"
          animate={reduzido ? { opacity: 0.6 } : { y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
          transition={
            reduzido
              ? { duration: 0 }
              : { ...LACO, duration: 0.9, ease: CURVA_SAIDA, delay: indice * 0.12 }
          }
        />
      ))}
    </>
  )
}

function Barra({ reduzido }: { reduzido: boolean }) {
  return (
    <span className="relative block h-0.5 w-full overflow-hidden rounded-full bg-current/15">
      <motion.span
        className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-current"
        initial={{ x: reduzido ? "75%" : "-100%" }}
        animate={reduzido ? undefined : { x: ["-100%", "250%"] }}
        transition={{ ...LACO, duration: 1.1, ease: "easeInOut" }}
      />
    </span>
  )
}

function Papel({ reduzido }: { reduzido: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full overflow-visible">
      <title>Impressora</title>
      <motion.rect
        x="8"
        y="2"
        width="8"
        height="9"
        rx="1"
        fill="currentColor"
        opacity={0.35}
        animate={reduzido ? undefined : { y: [2, 7, 7, 2], opacity: [0.35, 0.9, 0.9, 0.35] }}
        transition={{ ...LACO, duration: 1.6, ease: CURVA_SAIDA, times: [0, 0.4, 0.8, 1] }}
      />
      <rect x="3" y="9" width="18" height="8" rx="2" fill="currentColor" />
      <rect x="6" y="17" width="12" height="4" rx="1" fill="currentColor" opacity={0.55} />
    </svg>
  )
}

function Radar({ reduzido }: { reduzido: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-full overflow-visible">
      <title>Sincronizando</title>
      {[0, 1].map((onda) => (
        <motion.circle
          key={onda}
          cx="12"
          cy="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          initial={{ r: reduzido ? 6 + onda * 3 : 2, opacity: reduzido ? 0.5 : 0.9 }}
          animate={reduzido ? undefined : { r: [2, 11], opacity: [0.9, 0] }}
          transition={{ ...LACO, duration: 1.6, ease: "easeOut", delay: onda * 0.8 }}
        />
      ))}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  )
}

function Anel({ reduzido }: { reduzido: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-full"
      animate={reduzido ? undefined : { rotate: 360 }}
      transition={{ ...LACO, duration: 1.4, ease: "linear" }}
    >
      <title>Carregando</title>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity={0.15}
      />
      <motion.circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        initial={{ strokeDashoffset: reduzido ? 0.7 : 0.9 }}
        animate={reduzido ? undefined : { strokeDashoffset: [0.9, 0.3, 0.9] }}
        transition={{ ...LACO, duration: 1.6, ease: "easeInOut" }}
      />
    </motion.svg>
  )
}

const TAMANHO: Record<VarianteCarregador, string> = {
  pontos: "h-4 gap-1",
  barra: "w-full",
  papel: "size-5",
  radar: "size-5",
  anel: "size-6",
}

export function Carregador({
  variante,
  rotulo = "Carregando",
  decorativo = false,
  className,
}: CarregadorProps) {
  const reduzido = useReducedMotion() ?? false
  const desenhos: Record<VarianteCarregador, ReactNode> = {
    pontos: <Pontos reduzido={reduzido} />,
    barra: <Barra reduzido={reduzido} />,
    papel: <Papel reduzido={reduzido} />,
    radar: <Radar reduzido={reduzido} />,
    anel: <Anel reduzido={reduzido} />,
  }
  return (
    <span
      {...(decorativo ? { "aria-hidden": true } : { role: "status", "aria-label": rotulo })}
      data-testid={`carregador-${variante}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-current",
        TAMANHO[variante],
        className,
      )}
    >
      {desenhos[variante]}
    </span>
  )
}
