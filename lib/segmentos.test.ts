import { describe, expect, test } from "vitest"
import { textosDoSegmento } from "./segmentos"

describe("textosDoSegmento", () => {
  test("cada segmento fala do que vende", () => {
    expect(textosDoSegmento("pizzaria")).toMatchObject({
      busca: "Buscar pizza, borda, bebida",
      destaques: "Mais pedidas",
    })
    expect(textosDoSegmento("farmacia")).toMatchObject({
      busca: "Buscar remédio ou princípio ativo",
      destaques: "Mais vendidos",
      buscaVazia: "Tente pelo nome do remédio ou pelo princípio ativo.",
    })
  })
})
