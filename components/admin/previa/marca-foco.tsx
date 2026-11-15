"use client"

import { EyeOffIcon, MousePointerClickIcon } from "lucide-react"
import { type RefObject, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { usePrevia } from "./estado"

type Caixa = { top: number; left: number; width: number; height: number }

/** Quanto do topo da prévia (em px na tela) fica para o aviso: o pedaço em foco para logo abaixo. */
const ESPACO_DO_AVISO = 80

/** O pedaço da prévia que está sendo editado (`data-alvo`), dentro da tela. */
function acharAlvo(tela: HTMLElement | null, alvo: string) {
  return tela?.querySelector<HTMLElement>(`[data-alvo="${CSS.escape(alvo)}"]`) ?? null
}

/**
 * Camada por cima da prévia: diz o que está sendo editado ("Página inicial › Banner promocional"),
 * rola a tela até o pedaço e o contorna. Item desligado ou fora desta tela vira um aviso no topo.
 * Fica fora da tela (que é escalada), então mede tudo em coordenadas da janela.
 */
export function MarcaFoco({ tela }: { tela: RefObject<HTMLElement | null> }) {
  const foco = usePrevia((estado) => estado.foco)
  const camada = useRef<HTMLDivElement>(null)
  const [caixa, setCaixa] = useState<Caixa | null>(null)

  // Leva a tela até o pedaço em foco, uma vez a cada foco novo.
  useEffect(() => {
    const elemento = foco ? acharAlvo(tela.current, foco.alvo) : null
    const rolavel = tela.current
    if (!elemento || !rolavel) return
    const escala =
      rolavel.offsetHeight > 0 ? rolavel.getBoundingClientRect().height / rolavel.offsetHeight : 1
    const distancia =
      (elemento.getBoundingClientRect().top - rolavel.getBoundingClientRect().top) / (escala || 1)
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    rolavel.scrollTo({
      top: Math.max(0, rolavel.scrollTop + distancia - ESPACO_DO_AVISO / (escala || 1)),
      behavior: reduzido ? "auto" : "smooth",
    })
  }, [foco, tela])

  // Acompanha o pedaço enquanto a tela rola ou muda de tamanho.
  useEffect(() => {
    if (!foco) {
      setCaixa(null)
      return
    }
    let quadro = 0
    const medir = () => {
      quadro = 0
      const elemento = acharAlvo(tela.current, foco.alvo)
      const base = camada.current?.getBoundingClientRect()
      if (!elemento || !base) {
        setCaixa(null)
        return
      }
      const r = elemento.getBoundingClientRect()
      setCaixa({
        top: r.top - base.top,
        left: r.left - base.left,
        width: r.width,
        height: r.height,
      })
    }
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir)
    }
    medir()
    const rolavel = tela.current
    rolavel?.addEventListener("scroll", agendar, { passive: true })
    window.addEventListener("resize", agendar)
    return () => {
      rolavel?.removeEventListener("scroll", agendar)
      window.removeEventListener("resize", agendar)
      cancelAnimationFrame(quadro)
    }
  }, [foco, tela])

  if (!foco) return null
  const achou = caixa !== null || Boolean(acharAlvo(tela.current, foco.alvo))
  // Desligado é o único caso de aviso; o resto diz a seção e o item, com ou sem contorno.
  const aviso = `${foco.rotulo} está desligado e não aparece na loja`

  return (
    <div ref={camada} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {achou && caixa && (
        <div
          data-testid="contorno-foco"
          className="absolute rounded-lg outline-2 outline-offset-2 outline-primary transition-[top,left,width,height] duration-200 ease-out"
          style={{ top: caixa.top, left: caixa.left, width: caixa.width, height: caixa.height }}
        />
      )}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "absolute top-2 left-1/2 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-xl px-3 py-1.5 text-xs shadow-lg ring-1",
          !foco.desligado
            ? "bg-popover text-popover-foreground ring-border"
            : "bg-amber-50 text-amber-950 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-800",
        )}
      >
        {!foco.desligado ? (
          <>
            <MousePointerClickIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-[11px] text-muted-foreground">{foco.secao}</span>
              <span className="sr-only">: </span>
              <span className="font-semibold text-balance">{foco.rotulo}</span>
            </span>
          </>
        ) : (
          <>
            <EyeOffIcon className="size-4 shrink-0" aria-hidden="true" />
            <span className="font-medium leading-tight text-balance">{aviso}</span>
          </>
        )}
      </div>
    </div>
  )
}
