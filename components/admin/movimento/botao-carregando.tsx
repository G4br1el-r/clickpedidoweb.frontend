"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { CURVA_SAIDA, DURACAO, semRelogioDoNavegador } from "@/lib/admin/movimento"
import { cn } from "@/lib/utils"
import { Carregador, type VarianteCarregador } from "./carregador"

type BotaoCarregandoProps = ComponentProps<typeof Button> & {
  carregando?: boolean
  /** O que o leitor de tela diz enquanto carrega. */
  rotuloCarregando?: string
  /** O desenho que acompanha a ação: pontos para salvar, papel para imprimir, anel para o resto. */
  carregador?: Extract<VarianteCarregador, "pontos" | "papel" | "anel" | "radar">
}

/**
 * Botão de ação que mostra o que está acontecendo: os três pontos abrem espaço à esquerda
 * do texto, o botão não aceita outro clique e o texto continua o mesmo. Quem aperta vê que
 * o toque valeu, sem o botão trocar de largura nem de rótulo.
 */
export function BotaoCarregando({
  carregando = false,
  rotuloCarregando = "Salvando",
  carregador = "pontos",
  disabled,
  className,
  children,
  ...props
}: BotaoCarregandoProps) {
  const reduzido = useReducedMotion() ?? false
  return (
    <>
      <Button
        aria-busy={carregando || undefined}
        disabled={disabled || carregando}
        className={cn(carregando && "disabled:opacity-100", className)}
        {...props}
      >
        <AnimatePresence initial={false}>
          {carregando && (
            <motion.span
              key="carregando"
              className="flex items-center overflow-hidden"
              initial={{ width: 0, opacity: 0, marginRight: 0 }}
              animate={{ width: "auto", opacity: 1, marginRight: 6 }}
              onUpdate={semRelogioDoNavegador}
              exit={{ width: 0, opacity: 0, marginRight: 0 }}
              transition={{ duration: reduzido ? 0 : DURACAO.rapida, ease: CURVA_SAIDA }}
            >
              <Carregador
                variante={carregador}
                decorativo
                className={carregador === "pontos" ? undefined : "size-4"}
              />
            </motion.span>
          )}
        </AnimatePresence>
        {children}
      </Button>
      {/* O aviso fica ao lado do botão, não dentro: o nome do botão não muda enquanto carrega. */}
      {carregando && <span role="status" aria-label={rotuloCarregando} className="sr-only" />}
    </>
  )
}
