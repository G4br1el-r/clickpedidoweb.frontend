"use client"

import NumberFlow from "@number-flow/react"
import { ChevronRightIcon } from "lucide-react"
import { AnimatePresence, motion, useAnimationControls } from "motion/react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { clienteAtual } from "@/lib/cliente"
import { emReais, formatoMoeda, plural } from "@/lib/formato"
import { calcularSubtotal, contarItens, faltaParaMinimo, useSacola } from "@/lib/sacola"
import { MOLA_ILHA, PECA_ILHA, useIlhaSacola } from "./ilha-sacola"

/** Tempo do voo do produto até a barra; o pulo acontece quando ele chega. */
const CHEGADA_S = 0.52
const MOLA = { type: "spring", duration: 0.5, bounce: 0.35 } as const

/**
 * Só no celular: fica na área do polegar.
 * As miniaturas mostram o que já está na sacola, o fundo enche até o pedido mínimo
 * e cada item que chega faz a barra pular e brilhar.
 */
export function BarraSacola({ oculta }: { oculta: boolean }) {
  const abrir = useIlhaSacola((estado) => estado.abrir)
  // Aberta pela própria barra: ela vira a sacola. Aberta pelo ícone do topo: a barra sai de cena.
  const abertaAqui = useIlhaSacola((estado) => estado.aberta && estado.de === "barra")
  const abertaNoTopo = useIlhaSacola((estado) => estado.aberta && estado.de !== "barra")
  const itens = useSacola((estado) => estado.itens)
  const hidratada = useSacola((estado) => estado.hidratada)
  const quantidade = contarItens(itens)
  const subtotal = calcularSubtotal(itens)
  const visivel = hidratada && quantidade > 0 && !oculta && !abertaNoTopo
  const falta = faltaParaMinimo(subtotal, clienteAtual.pedidoMinimo)
  const progresso = Math.min(1, subtotal / clienteAtual.pedidoMinimo)
  const miniaturas = itens.slice(-3)

  const pulo = useAnimationControls()
  const anterior = useRef(quantidade)
  const [chegadas, setChegadas] = useState(0)

  useEffect(() => {
    const aumentou = quantidade > anterior.current
    anterior.current = quantidade
    if (!aumentou || !visivel) return
    setChegadas((atual) => atual + 1)
    void pulo.start({
      scale: [1, 1.045, 0.985, 1],
      transition: { duration: 0.45, delay: CHEGADA_S, times: [0, 0.35, 0.7, 1] },
    })
  }, [quantidade, visivel, pulo])

  return (
    <>
      <span className="sr-only" aria-live="polite" data-testid="resumo-sacola">
        {quantidade > 0
          ? `Sacola com ${plural(quantidade, "item", "itens")}, ${emReais(subtotal)}`
          : "Sacola vazia"}
      </span>
      <AnimatePresence>
        {visivel && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
            initial={{ y: "120%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "120%", opacity: 0 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.22 }}
          >
            <motion.button
              type="button"
              animate={pulo}
              whileTap={{ scale: 0.97 }}
              onClick={() => abrir("barra")}
              data-testid="barra-sacola"
              data-alvo-sacola="principal"
              className="relative flex h-16 w-full items-center gap-3 rounded-full pr-4 pl-2 text-left text-primary-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
            >
              {/* O fundo azul é a peça que sobe e vira a sacola. */}
              {!abertaAqui && (
                <motion.span
                  layoutId={PECA_ILHA.barra}
                  aria-hidden="true"
                  className="absolute inset-0 bg-primary shadow-[0_18px_40px_-14px] shadow-primary/70"
                  style={{ borderRadius: 32 }}
                  transition={MOLA_ILHA}
                />
              )}
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
                animate={{ opacity: abertaAqui ? 0 : 1 }}
                transition={{ duration: 0.12 }}
              >
                {/* O fundo enche até o pedido mínimo. */}
                <motion.span
                  className="absolute inset-y-0 left-0 w-full origin-left bg-white/14"
                  initial={false}
                  animate={{ scaleX: progresso, opacity: progresso >= 1 ? 0 : 1 }}
                  transition={{ type: "spring", duration: 0.7, bounce: 0.1, delay: CHEGADA_S }}
                />
                {/* Brilho que atravessa a barra a cada item que chega. */}
                {chegadas > 0 && (
                  <motion.span
                    key={chegadas}
                    className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-white/35 to-transparent"
                    initial={{ x: "0%" }}
                    animate={{ x: "420%" }}
                    transition={{ duration: 0.8, delay: CHEGADA_S, ease: [0.23, 1, 0.32, 1] }}
                  />
                )}
              </motion.span>

              <motion.span
                className="relative flex min-w-0 flex-1 items-center gap-3"
                animate={{ opacity: abertaAqui ? 0 : 1 }}
                transition={{ duration: abertaAqui ? 0.1 : 0.25, delay: abertaAqui ? 0 : 0.2 }}
              >
                <span className="relative flex shrink-0 items-center">
                  <span className="flex -space-x-5">
                    <AnimatePresence initial={false} mode="popLayout">
                      {miniaturas.map((item) => (
                        <motion.span
                          key={item.chave}
                          layout
                          className="relative size-11 overflow-hidden rounded-full bg-white ring-[2.5px] ring-primary"
                          initial={{ scale: 0.3, y: -18, opacity: 0 }}
                          animate={{ scale: 1, y: 0, opacity: 1 }}
                          exit={{ scale: 0.3, opacity: 0 }}
                          transition={{ ...MOLA, delay: CHEGADA_S - 0.08 }}
                        >
                          <Image
                            src={item.imagem}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </span>
                  <motion.span
                    key={quantidade}
                    aria-hidden="true"
                    className="absolute -top-1 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-marca-acento px-1 text-[11px] font-bold text-white tabular-nums ring-2 ring-primary"
                    initial={{ scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ ...MOLA, delay: CHEGADA_S }}
                  >
                    {quantidade}
                  </motion.span>
                </span>

                <span className="relative flex min-w-0 flex-1 flex-col pl-1">
                  <span className="text-[15px] leading-tight font-bold">Ver sacola</span>
                  <span className="relative h-4 overflow-hidden text-xs leading-4 text-primary-foreground/80">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        key={falta > 0 ? "falta" : "pronto"}
                        className="block truncate"
                        initial={{ y: 12, opacity: 0, filter: "blur(3px)" }}
                        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                        exit={{ y: -12, opacity: 0, filter: "blur(3px)" }}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                      >
                        {falta > 0
                          ? `Faltam ${emReais(falta)} pro mínimo`
                          : "Pronto para finalizar"}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </span>

                <span className="relative flex shrink-0 items-center gap-1 text-base font-bold">
                  <NumberFlow
                    value={subtotal}
                    locales="pt-BR"
                    format={formatoMoeda}
                    className="tabular-nums"
                  />
                  <motion.span
                    key={chegadas}
                    aria-hidden="true"
                    initial={{ x: 0 }}
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 0.5, delay: CHEGADA_S + 0.15 }}
                  >
                    <ChevronRightIcon className="size-5" />
                  </motion.span>
                </span>
              </motion.span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
