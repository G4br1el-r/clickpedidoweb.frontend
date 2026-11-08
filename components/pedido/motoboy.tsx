"use client"

import { type DotLottie, DotLottieReact, setWasmUrl } from "@lottiefiles/dotlottie-react"
import { useReducedMotion } from "motion/react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

// O motor da animação vem do próprio site, sem depender de CDN.
setWasmUrl("/lottie/dotlottie-player.wasm")

/**
 * Entregador de scooter (animação "Man riding a red scooter", de mike mk, LottieFiles,
 * gratuita). Com `acelerando`, a animação corre mais rápido enquanto o pedido é procurado.
 * Com movimento reduzido, fica parada num quadro.
 */
export function Motoboy({
  acelerando = false,
  className,
}: {
  acelerando?: boolean
  className?: string
}) {
  const reduzido = useReducedMotion()
  const [animacao, setAnimacao] = useState<DotLottie | null>(null)

  useEffect(() => {
    animacao?.setSpeed(acelerando ? 2.4 : 1)
  }, [animacao, acelerando])

  return (
    <div
      role="img"
      aria-label="Entregador de moto a caminho"
      className={cn("aspect-[16/9] w-full", className)}
    >
      {/* A arte original é quadrada e com muita sobra: preenche a faixa e corta só o vazio. */}
      <DotLottieReact
        src="/lottie/motoboy.lottie"
        loop
        autoplay={!reduzido}
        layout={{ fit: "cover", align: [0.5, 0.5] }}
        dotLottieRefCallback={setAnimacao}
        className="size-full"
      />
    </div>
  )
}
