import { beforeEach, describe, expect, test } from "vitest"
import { usePrevia } from "./estado"

beforeEach(() => {
  usePrevia.setState(usePrevia.getInitialState(), true)
})

const BANNER = { alvo: "bloco:promocional", secao: "Página inicial", rotulo: "Banner promocional" }

describe("foco da prévia", () => {
  test("começa sem foco e guarda o que está sendo editado", () => {
    expect(usePrevia.getState().foco).toBeNull()
    usePrevia.getState().focar(BANNER)
    expect(usePrevia.getState().foco).toEqual(BANNER)
  })

  test("soltar só tira o foco se ainda for o mesmo item", () => {
    usePrevia.getState().focar(BANNER)
    // O mouse já passou para outro item antes de o primeiro avisar que saiu.
    usePrevia.getState().focar({ ...BANNER, alvo: "bloco:ofertas", rotulo: "Ofertas do dia" })
    usePrevia.getState().soltar("bloco:promocional")
    expect(usePrevia.getState().foco?.alvo).toBe("bloco:ofertas")

    usePrevia.getState().soltar("bloco:ofertas")
    expect(usePrevia.getState().foco).toBeNull()
  })
})
