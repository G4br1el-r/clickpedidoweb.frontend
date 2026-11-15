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

describe("espera de cada segmento", () => {
  test("cada nicho tem a sua frase de carregamento, do próprio ofício", () => {
    expect(textosDoSegmento("pizzaria").carregando).toBe("Acendendo o forno")
    expect(textosDoSegmento("farmacia").carregando).toBe("Organizando as prateleiras")
    expect(textosDoSegmento("adega").carregando).toBe("Gelando as bebidas")
    expect(textosDoSegmento("acougue").carregando).toBe("Afiando as facas")
    expect(textosDoSegmento("salao").carregando).toBe("Preparando a bancada")
    expect(textosDoSegmento("lanchonete").carregando).toBe("Esquentando a chapa")
  })
})
