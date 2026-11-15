"use client"

import NumberFlow from "@number-flow/react"
import { ArrowRightIcon, SendIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { registroSegmentos } from "@/components/segmentos/registro"
import { Button } from "@/components/ui/button"
import { emReais, formatoMoeda } from "@/lib/formato"
import { useLoja } from "@/lib/loja-atual"
import { cn } from "@/lib/utils"
import { CURVA_SAIDA } from "./movimento"

type AcaoCheckoutProps = {
  ultimo: boolean
  enviando: boolean
  total: number
  /** Mostra o total também nos passos do meio (no celular, o total vai sempre no botão). */
  mostrarTotal?: boolean
  testId: string
  /** Id do formulário, quando o botão fica fora dele (a barra do polegar no celular). */
  form?: string
  className?: string
}

/**
 * A ação principal do checkout: continua nos passos e envia no último, com o total à vista.
 * O rótulo troca com um crossfade curto; enviando, o ícone vira o carregador do nicho.
 */
export function AcaoCheckout({
  ultimo,
  enviando,
  total,
  mostrarTotal = false,
  testId,
  form,
  className,
}: AcaoCheckoutProps) {
  const { Carregador } = registroSegmentos[useLoja().segmento]
  const reduzido = useReducedMotion()
  const rotulo = enviando ? "Enviando…" : ultimo ? "Enviar pedido" : "Continuar"
  const comTotal = ultimo || mostrarTotal
  const icone = enviando ? "enviando" : ultimo ? "enviar" : "seguir"

  return (
    <Button
      type="submit"
      form={form}
      size="cta"
      className={cn("justify-between gap-4 pr-4", className)}
      data-testid={testId}
      aria-busy={enviando || undefined}
    >
      <span className="relative grid overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={rotulo}
            className="block whitespace-nowrap"
            initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={
              reduzido
                ? { opacity: 0, transition: { duration: 0.1 } }
                : { opacity: 0, y: -10, filter: "blur(2px)", transition: { duration: 0.12 } }
            }
            transition={{ duration: 0.2, ease: CURVA_SAIDA }}
          >
            {rotulo}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="flex items-center gap-2.5 tabular-nums">
        {comTotal && (
          <>
            <NumberFlow
              value={total}
              locales="pt-BR"
              format={formatoMoeda}
              aria-hidden="true"
              className="font-semibold"
            />
            <span className="sr-only">{emReais(total)}</span>
          </>
        )}
        <span className="relative grid size-7 place-items-center" aria-hidden="true">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={icone}
              className="grid place-items-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
              transition={{ duration: 0.18, ease: CURVA_SAIDA }}
            >
              {icone === "enviando" ? (
                // O carregador usa a cor da loja: num disco claro, ele aparece sobre o botão.
                <span className="grid size-7 place-items-center rounded-full bg-background">
                  <Carregador className="size-5" />
                </span>
              ) : icone === "enviar" ? (
                <SendIcon className="size-[18px]" />
              ) : (
                <ArrowRightIcon className="size-5" />
              )}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
    </Button>
  )
}
