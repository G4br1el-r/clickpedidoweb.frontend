"use client"

import { ShoppingBagIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Image from "next/image"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { type Config, type EstiloTituloSecao, useConfigEfetiva } from "@/lib/admin/config"
import { clienteAtual } from "@/lib/cliente"
import { cn } from "@/lib/utils"
import { type Demonstracao, usePrevia } from "./estado"
import { variantesEntrada } from "./estilos"

/** Logo, banner e fundo: o que a loja enviou ou, sem envio, as imagens atuais. */
export function useImagensLoja() {
  const identidade = useConfigEfetiva().identidade
  return {
    logo: identidade.logo ?? clienteAtual.logo.src,
    banner: identidade.banner ?? clienteAtual.banner.src,
    fundo: identidade.fundo,
  }
}

export function ImagemLoja({
  src,
  className,
  sizes = "400px",
}: {
  src: string
  className?: string
  sizes?: string
}) {
  return (
    <span className={cn("relative block overflow-hidden", className)}>
      <Image src={src} alt="" fill sizes={sizes} unoptimized className="object-cover" />
    </span>
  )
}

/**
 * Bloco que entra com a animação escolhida; `indice` define a ordem da cascata. Com reduzir
 * movimento, já aparece no lugar.
 */
export function Entrada({
  indice = 0,
  alvo,
  className,
  children,
}: {
  indice?: number
  /** Nome do pedaço para a marca de foco da prévia (ex.: "bloco:promocional"). */
  alvo?: string
  className?: string
  children: ReactNode
}) {
  const { entrada, velocidade } = useConfigEfetiva().animacoes
  const semMovimento = useReducedMotion()
  return (
    <motion.div
      custom={indice}
      variants={variantesEntrada(entrada, velocidade)}
      initial={semMovimento ? false : "escondido"}
      animate="visivel"
      data-alvo={alvo}
      className={cn("transform-gpu", className)}
      style={{ transformPerspective: 900 }}
    >
      {children}
    </motion.div>
  )
}

/** Título de cada seção da página, no estilo escolhido em Tipografia. */
export function TituloSecao({
  estilo,
  children,
  extra,
}: {
  estilo: EstiloTituloSecao
  children: ReactNode
  extra?: ReactNode
}) {
  const titulo = (
    <h2 className="font-heading text-xl font-extrabold tracking-tight @3xl/tela:text-2xl">
      {children}
    </h2>
  )

  if (estilo === "pilula") {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground [&_h2]:text-base [&_h2]:@3xl/tela:text-lg">
          {titulo}
        </span>
        {extra}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {estilo === "barra" && (
        <span aria-hidden="true" className="h-6 w-1.5 shrink-0 rounded-full bg-marca-acento" />
      )}
      <div className={cn(estilo === "sublinhado" && "border-b-[3px] border-marca-acento pb-1")}>
        {titulo}
      </div>
      {estilo !== "simples" && (
        <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-border" />
      )}
      {extra}
    </div>
  )
}

const CORES_CONFETE = ["var(--primary)", "var(--marca-acento)", "#F5B700", "#2BB673"]

/**
 * Efeito ao adicionar um item, tocado sobre o elemento que o envolve:
 * voo até a sacola, pulso no botão ou confete.
 */
export function EfeitoAdicionar({
  children,
  className,
  demonstravel = false,
}: {
  children: ReactNode
  className?: string
  /** Também toca sozinho quando a prévia pede para mostrar o efeito. */
  demonstravel?: boolean
}) {
  const demo = useDemoAtiva("adicionar")
  const efeito = useConfigEfetiva().animacoes.aoAdicionar
  const adicionados = usePrevia((estado) => estado.adicionados)
  const [disparo, setDisparo] = useState(0)
  const anterior = useRef(adicionados)
  const meu = useRef(false)

  useEffect(() => {
    if (adicionados > anterior.current && meu.current) setDisparo((valor) => valor + 1)
    anterior.current = adicionados
    meu.current = false
  }, [adicionados])

  useEffect(() => {
    if (demonstravel && demo > 0) setDisparo((valor) => valor + 1)
  }, [demonstravel, demo])

  return (
    <span
      className={cn("relative inline-flex", className)}
      onClickCapture={() => {
        meu.current = true
      }}
    >
      <motion.span
        key={efeito === "pulso" ? disparo : "fixo"}
        className="flex flex-1"
        initial={efeito === "pulso" && disparo > 0 ? { scale: 0.85 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.45, bounce: 0.6 }}
      >
        {children}
      </motion.span>
      <AnimatePresence>
        {disparo > 0 && efeito === "pulso" && (
          <motion.span
            key={`anel-${disparo}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full ring-4 ring-primary"
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 1.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}
        {disparo > 0 && efeito === "confete" && (
          <span
            key={`confete-${disparo}`}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2"
          >
            {Array.from({ length: 14 }, (_, indice) => {
              const angulo = (indice / 14) * Math.PI * 2
              const distancia = 38 + (indice % 3) * 14
              return (
                <motion.span
                  // biome-ignore lint/suspicious/noArrayIndexKey: partículas fixas, sem reordenação.
                  key={indice}
                  className="absolute size-2 rounded-[2px]"
                  style={{ background: CORES_CONFETE[indice % CORES_CONFETE.length] }}
                  initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                  animate={{
                    x: Math.cos(angulo) * distancia,
                    y: Math.sin(angulo) * distancia + 18,
                    opacity: 0,
                    rotate: 220,
                    scale: 0.6,
                  }}
                  transition={{ duration: 0.85, ease: [0.23, 1, 0.32, 1] }}
                />
              )
            })}
          </span>
        )}
        {disparo > 0 && efeito === "voo" && (
          <motion.span
            key={`voo-${disparo}`}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 z-50 grid size-7 -translate-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{
              x: [0, -40, 60],
              y: [0, -160, -560],
              scale: [1, 1.1, 0.4],
              opacity: [1, 1, 0],
            }}
            transition={{ duration: 0.75, ease: "easeIn" }}
          >
            <ShoppingBagIcon className="size-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/** Sacola da prévia, que balança quando um item chega. */
export function IconeSacolaPrevia({ sobreFoto = false }: { sobreFoto?: boolean }) {
  const adicionados = usePrevia((estado) => estado.adicionados)
  return (
    <span
      className={cn(
        "relative grid size-10 place-items-center rounded-full",
        sobreFoto
          ? "bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-md"
          : "bg-card ring-1 ring-border",
      )}
    >
      <motion.span
        key={adicionados}
        initial={adicionados > 0 ? { rotate: -14, scale: 1.2 } : false}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: "spring", duration: 0.6, bounce: 0.55, delay: 0.45 }}
      >
        <ShoppingBagIcon className="size-[18px]" />
      </motion.span>
      {adicionados > 0 && (
        <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground ring-2 ring-background">
          {adicionados}
        </span>
      )}
    </span>
  )
}

/** Atalho para os componentes das telas lerem a configuração inteira. */
export function useConfigAtual(): Config {
  return useConfigEfetiva()
}

/** Fica `true` por alguns instantes sempre que a prévia pede uma demonstração desse tipo. */
export function useDemoAtiva(tipo: Demonstracao, duracao = 1600) {
  const demo = usePrevia((estado) => estado.demo)
  const [ativa, setAtiva] = useState(false)
  const vez = demo?.tipo === tipo ? demo.vez : 0

  useEffect(() => {
    if (vez === 0) return
    setAtiva(true)
    const fim = setTimeout(() => setAtiva(false), duracao)
    return () => clearTimeout(fim)
  }, [vez, duracao])

  return ativa ? vez : 0
}
