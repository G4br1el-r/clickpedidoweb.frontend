import type { StaticImageData } from "next/image"
import { create } from "zustand"

export type Voo = {
  id: number
  imagem: StaticImageData
  /** O preço escrito na etiqueta que desliza até a sacola. */
  rotulo: string
  de: { x: number; y: number }
  para: { x: number; y: number }
}

type EstadoVoo = {
  voos: Voo[]
  concluir: (id: number) => void
}

export const useVoos = create<EstadoVoo>()((set) => ({
  voos: [],
  concluir: (id) => set(({ voos }) => ({ voos: voos.filter((voo) => voo.id !== id) })),
}))

let proximoId = 0

function centro(elemento: Element) {
  const { left, top, width, height } = elemento.getBoundingClientRect()
  return { x: left + width / 2, y: top + height / 2 }
}

/** No celular, a barra de baixo (mais perto do polegar) tem preferência sobre o ícone do topo. */
function alvoDaSacola() {
  const candidatos = [
    ...document.querySelectorAll('[data-alvo-sacola="principal"]'),
    ...document.querySelectorAll("[data-alvo-sacola]"),
  ]
  // Vale o primeiro destino que está à vista: com a barra grudada, o ícone sobre a foto
  // continua na página, mas fora da tela.
  for (const elemento of candidatos) {
    const { width, top, bottom } = elemento.getBoundingClientRect()
    if (width > 0 && bottom > 0 && top < window.innerHeight) return centro(elemento)
  }
  // No celular, a barra da sacola surge junto com o primeiro item.
  return { x: window.innerWidth / 2, y: window.innerHeight - 40 }
}

/** A etiqueta do produto se solta de onde a pessoa tocou e desliza até a sacola. */
export function lancarParaSacola(origem: Element, imagem: StaticImageData, rotulo: string) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  proximoId += 1
  const voo = { id: proximoId, imagem, rotulo, de: centro(origem), para: alvoDaSacola() }
  useVoos.setState(({ voos }) => ({ voos: [...voos, voo] }))
}
