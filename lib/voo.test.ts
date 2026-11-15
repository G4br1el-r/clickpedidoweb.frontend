import type { StaticImageData } from "next/image"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { lancarParaSacola, useVoos } from "./voo"

const IMAGEM = { src: "/foto.jpg", width: 1, height: 1 } as StaticImageData

function botaoEm(x: number, y: number) {
  const botao = document.createElement("button")
  botao.getBoundingClientRect = () => ({ left: x, top: y, width: 44, height: 44 }) as DOMRect
  document.body.append(botao)
  return botao
}

beforeEach(() => {
  document.body.innerHTML = ""
  useVoos.setState(useVoos.getInitialState(), true)
  vi.stubGlobal("matchMedia", (consulta: string) => ({ matches: false, media: consulta }))
})

describe("lancarParaSacola", () => {
  test("a etiqueta que voa leva a foto e o preço do produto", () => {
    lancarParaSacola(botaoEm(100, 300), IMAGEM, "R$ 54,00")

    expect(useVoos.getState().voos).toEqual([
      expect.objectContaining({ imagem: IMAGEM, rotulo: "R$ 54,00", de: { x: 122, y: 322 } }),
    ])
  })

  test("com movimento reduzido, nada voa", () => {
    vi.stubGlobal("matchMedia", (consulta: string) => ({ matches: true, media: consulta }))

    lancarParaSacola(botaoEm(100, 300), IMAGEM, "R$ 54,00")

    expect(useVoos.getState().voos).toEqual([])
  })
})
