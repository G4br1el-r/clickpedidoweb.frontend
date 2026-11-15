"use client"

import { type ComponentProps, type CSSProperties, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/** Curva de saída sem passar do ponto: o "zoom" assenta, não quica. */
const CURVA_ZOOM = "cubic-bezier(0.23, 1, 0.32, 1)"

type EntradaProps = ComponentProps<"div"> & {
  /** Segundos depois da primeira pintura da página. */
  atraso?: number
  de?: "baixo" | "cima" | "direita" | "zoom"
  /** Desfoque na chegada; bom para textos, caro em blocos grandes com sombra. */
  desfoque?: boolean
  duracao?: number
}

/**
 * Entrada da primeira tela, em CSS puro (`.entrada` em globals.css): roda já na primeira
 * pintura, sem esperar o JavaScript, então a página nunca fica em branco numa conexão lenta.
 * Com movimento reduzido, o elemento aparece direto.
 */
export function Entrada({
  atraso = 0,
  de = "baixo",
  desfoque = false,
  duracao = 0.3,
  className,
  style,
  ...props
}: EntradaProps) {
  const variaveis = {
    "--entrada": desfoque ? `entrada-${de}, entrada-desfoque` : `entrada-${de}`,
    "--entrada-atraso": `${atraso}s`,
    "--entrada-duracao": `${duracao}s`,
    ...(de === "zoom" ? { "--entrada-curva": CURVA_ZOOM } : {}),
    ...style,
  } as CSSProperties

  return <div className={cn("entrada", className)} style={variaveis} {...props} />
}

/** Janela em que vale a coreografia da primeira tela; depois, cada bloco entra sem espera. */
const JANELA_COREOGRAFIA_MS = 1400

type EntradaAoRolarProps = ComponentProps<"div"> & {
  /** Espera usada só para o que já está à vista quando a página abre. */
  atraso?: number
}

/**
 * O que está à vista na abertura entra com a coreografia, em CSS. O que está abaixo
 * da dobra fica guardado e entra quando chega à tela.
 */
export function EntradaAoRolar({ atraso = 0, className, style, ...props }: EntradaAoRolarProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [estado, setEstado] = useState<"abertura" | "aguardando" | "entrando">("abertura")

  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return
    if (elemento.getBoundingClientRect().top < window.innerHeight) return
    setEstado("aguardando")
    const observador = new IntersectionObserver(
      ([registro]) => {
        if (!registro.isIntersecting) return
        setEstado("entrando")
        observador.disconnect()
      },
      { rootMargin: "0px 0px -40px 0px" },
    )
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  const esperaAbertura =
    estado === "abertura" && performance.now() < JANELA_COREOGRAFIA_MS ? atraso : 0

  return (
    <div
      ref={ref}
      className={cn(estado === "aguardando" ? "entrada-guardada" : "entrada", className)}
      style={
        {
          "--entrada": "entrada-baixo",
          "--entrada-atraso": `${estado === "entrando" ? 0 : esperaAbertura}s`,
          "--entrada-duracao": "0.6s",
          ...style,
        } as CSSProperties
      }
      {...props}
    />
  )
}
