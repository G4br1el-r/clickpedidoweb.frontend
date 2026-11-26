"use client"

import { type ComponentProps, useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/** Esmaecer a borda só quando há mais conteúdo do outro lado dela. */
const MARGEM_PX = 4

const MASCARAS = {
  nenhuma: undefined,
  direita: "linear-gradient(to right, black calc(100% - 28px), transparent)",
  esquerda: "linear-gradient(to left, black calc(100% - 28px), transparent)",
  ambas: "linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent)",
} as const

/**
 * Faixa de abas ou filtros que rola de lado no celular. Esmaece só a borda que tem mais
 * conteúdo atrás dela (some a dica quando você chega ao fim), esconde a barra de rolagem e
 * leva até a vista o item marcado, para a aba aberta nunca ficar fora da tela.
 */
export function FaixaRolavel({ className, children, ...props }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null)
  const [mais, setMais] = useState({ esquerda: false, direita: false })

  const medir = useCallback(() => {
    const faixa = ref.current
    if (!faixa) return
    const esquerda = faixa.scrollLeft > MARGEM_PX
    const direita = faixa.scrollLeft + faixa.clientWidth < faixa.scrollWidth - MARGEM_PX
    setMais((atual) =>
      atual.esquerda === esquerda && atual.direita === direita ? atual : { esquerda, direita },
    )
  }, [])

  useEffect(() => {
    const faixa = ref.current
    if (!faixa) return
    medir()
    const marcado = faixa.querySelector<HTMLElement>(
      '[aria-selected="true"], [aria-checked="true"], [data-state="active"], [data-state="on"]',
    )
    if (marcado) {
      // Só a faixa anda. `scrollIntoView` também rolaria a página quando a faixa está abaixo da
      // primeira tela (celular deitado), e a tela abriria pulada.
      const caixa = faixa.getBoundingClientRect()
      const alvo = marcado.getBoundingClientRect()
      const desvio = alvo.left + alvo.width / 2 - (caixa.left + caixa.width / 2)
      faixa.scrollTo({ left: faixa.scrollLeft + desvio, behavior: "smooth" })
    }
    const observador = new ResizeObserver(medir)
    observador.observe(faixa)
    return () => observador.disconnect()
  }, [medir])

  const mascara =
    mais.esquerda && mais.direita
      ? MASCARAS.ambas
      : mais.direita
        ? MASCARAS.direita
        : mais.esquerda
          ? MASCARAS.esquerda
          : MASCARAS.nenhuma

  return (
    <div
      ref={ref}
      data-testid="faixa-rolavel"
      data-mais-esquerda={mais.esquerda}
      data-mais-direita={mais.direita}
      onScroll={medir}
      style={{ maskImage: mascara, WebkitMaskImage: mascara }}
      className={cn("overflow-x-auto overscroll-x-contain [scrollbar-width:none]", className)}
      {...props}
    >
      {children}
    </div>
  )
}
