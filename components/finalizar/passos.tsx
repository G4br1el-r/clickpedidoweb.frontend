"use client"

import { CheckIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"
import { CURVA_SAIDA, CURVA_TELA } from "./movimento"

export const PASSOS = [
  { id: "dados", nome: "Você" },
  { id: "entrega", nome: "Entrega" },
  { id: "pagamento", nome: "Pagamento" },
  { id: "revisao", nome: "Revisão" },
] as const

export type PassoId = (typeof PASSOS)[number]["id"]

type PassosProps = {
  atual: number
  /** Até onde a pessoa já chegou; dá para voltar a qualquer passo até ali. */
  alcancado: number
  aoIr: (indice: number) => void
  /** Nome de um passo que muda no segmento (no salão, a entrega é o horário). */
  rotulos?: Partial<Record<PassoId, string>>
}

/**
 * Um fio fino por passo, que enche na cor da loja (o progresso), com o nome logo abaixo.
 * O passo atual fica em peso maior; os feitos ganham um visto e dá para voltar a eles.
 */
export function Passos({ atual, alcancado, aoIr, rotulos }: PassosProps) {
  return (
    <nav aria-label="Passos para finalizar o pedido">
      <ol className="grid grid-cols-4 gap-1.5 md:gap-2.5">
        {PASSOS.map((passo, indice) => {
          const feito = indice < atual
          const ativo = indice === atual
          const liberado = indice <= alcancado
          return (
            <li key={passo.id}>
              <button
                type="button"
                disabled={!liberado}
                aria-current={ativo ? "step" : undefined}
                onClick={() => aoIr(indice)}
                className="group/passo flex min-h-11 w-full flex-col gap-2.5 rounded-md pt-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
              >
                <span className="relative h-[3px] w-full overflow-hidden rounded-full bg-border">
                  <motion.span
                    className="absolute inset-0 origin-left rounded-full bg-primary"
                    initial={false}
                    animate={{ scaleX: feito || ativo ? 1 : 0 }}
                    transition={{ duration: 0.45, ease: CURVA_TELA }}
                  />
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1 text-[13px] tracking-[-0.005em] transition-colors duration-150 md:text-sm",
                    ativo ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                    liberado && !ativo && "group-hover/passo:text-foreground",
                  )}
                >
                  <AnimatePresence initial={false}>
                    {feito && (
                      <motion.span
                        key="feito"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0, transition: { duration: 0.12 } }}
                        transition={{ duration: 0.22, ease: CURVA_SAIDA }}
                        className="hidden shrink-0 overflow-hidden md:flex"
                      >
                        <CheckIcon className="size-3.5" strokeWidth={2.75} aria-hidden="true" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <span className="truncate">{rotulos?.[passo.id] ?? passo.nome}</span>
                  {feito && <span className="sr-only">(feito)</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
