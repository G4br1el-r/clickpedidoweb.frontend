import type { Transition, Variants } from "motion/react"
import type { Config, EntradaPagina, Espacamento, EstiloBotao, HoverCard } from "@/lib/admin/config"

/** Classe do botão de ação conforme o estilo escolhido. */
export function classeBotao(estilo: EstiloBotao) {
  switch (estilo) {
    case "suave":
      return "bg-accent text-accent-foreground hover:bg-accent/80"
    case "contorno":
      return "border-2 border-primary bg-transparent text-marca-texto hover:bg-accent"
    case "degrade":
      return "bg-linear-to-br from-primary to-marca-acento text-primary-foreground shadow-md shadow-primary/25"
    case "brilho":
      return "botao-brilho bg-primary text-primary-foreground shadow-md shadow-primary/30"
    default:
      return "bg-primary text-primary-foreground hover:bg-primary/90"
  }
}

export function classeHover(hover: HoverCard) {
  switch (hover) {
    case "levantar":
      return "transition-[transform,box-shadow] duration-300 ease-saida hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgb(0_0_0/0.35)] data-demo:-translate-y-1 data-demo:shadow-[0_18px_40px_-20px_rgb(0_0_0/0.35)]"
    case "zoom":
      return "[&_img]:transition-transform [&_img]:duration-700 [&_img]:ease-saida hover:[&_img]:scale-[1.07] data-demo:[&_img]:scale-[1.07]"
    case "brilho":
      return "card-brilho transition-shadow duration-300 hover:shadow-[0_0_0_2px_var(--primary)] data-demo:shadow-[0_0_0_2px_var(--primary)]"
    default:
      return ""
  }
}

export const ESPACO: Record<Espacamento, string> = {
  justo: "gap-2",
  padrao: "gap-3",
  amplo: "gap-5",
}

const CURVA = [0.23, 1, 0.32, 1] as const

/** Variantes de entrada dos blocos da página; `custom` é a posição do bloco. */
export function variantesEntrada(entrada: EntradaPagina, velocidade: number): Variants {
  const duracao = 0.55 * velocidade
  const atraso = (indice: number) =>
    entrada === "cascata" ? indice * 0.12 * velocidade : indice * 0.05 * velocidade
  const base = (indice: number): Transition => ({
    duration: duracao,
    delay: atraso(indice),
    ease: CURVA,
  })

  const inicio: Record<EntradaPagina, Record<string, number | string>> = {
    nenhuma: { opacity: 1 },
    suave: { opacity: 0 },
    subir: { opacity: 0, y: 24 },
    zoom: { opacity: 0, scale: 0.94 },
    desfoque: { opacity: 0, filter: "blur(12px)", y: 8 },
    cascata: { opacity: 0, y: 36, rotateX: 12 },
  }

  return {
    escondido: inicio[entrada],
    visivel: (indice: number) =>
      entrada === "nenhuma"
        ? { opacity: 1 }
        : {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            rotateX: 0,
            transition: base(indice),
          },
  }
}

/** Arredondamento base em rem a partir dos pixels escolhidos. */
export function raio(cantos: number) {
  return `${cantos / 16}rem`
}

export type ConfigPrevia = Config
