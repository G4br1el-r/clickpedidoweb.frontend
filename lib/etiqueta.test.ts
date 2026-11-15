import type { StaticImageData } from "next/image"
import { describe, expect, test } from "vitest"
import type { DadosMedicamento } from "./admin/dados/tipos"
import { etiquetaDoProduto } from "./etiqueta"
import type { GrupoOpcao, Produto } from "./tipos"

const IMAGEM = { src: "/foto.jpg", width: 1, height: 1 } as StaticImageData

function produto(extra: Partial<Produto> = {}): Produto {
  return {
    id: "p",
    tipo: "produto",
    nome: "Produto",
    descricao: "",
    preco: 54,
    imagem: IMAGEM,
    ...extra,
  } as Produto
}

const BORDA_PAGA = {
  id: "borda",
  tipo: "borda",
  nome: "Borda",
  titulo: "Borda",
  obrigatorio: false,
  itens: [{ id: "catupiry", nome: "Catupiry", extra: 8 }],
} as GrupoOpcao

const BORDA_GRATIS = { ...BORDA_PAGA, itens: [{ id: "fina", nome: "Fina", extra: 0 }] }

describe("etiquetaDoProduto", () => {
  test("produto simples mostra só o preço", () => {
    expect(etiquetaDoProduto(produto())).toEqual({ preco: 54 })
  })

  test("com opção que cobra a mais, o preço vem como 'a partir de'", () => {
    expect(etiquetaDoProduto(produto({ grupos: [BORDA_PAGA] }))).toEqual({
      preco: 54,
      aPartirDe: true,
    })
  })

  test("opções sem acréscimo não mudam o preço", () => {
    expect(etiquetaDoProduto(produto({ grupos: [BORDA_GRATIS] }))).toEqual({ preco: 54 })
  })

  test("açougue: corte vendido por quilo diz que o preço é do kg", () => {
    expect(etiquetaDoProduto(produto({ preco: 89.9, unidade: "kg" }))).toEqual({
      preco: 89.9,
      porKg: true,
    })
  })

  test("farmácia: remédio mostra a apresentação da embalagem", () => {
    const medicamento = { apresentacao: "500 mg, 20 comprimidos" } as DadosMedicamento
    expect(etiquetaDoProduto(produto({ preco: 12.9, medicamento }))).toEqual({
      preco: 12.9,
      detalhe: "500 mg, 20 comprimidos",
    })
  })

  test.each([
    [45, "45 min"],
    [60, "1 h"],
    [90, "1h30"],
    [120, "2 h"],
  ])("salão: serviço de %i minutos mostra %s", (duracaoMin, detalhe) => {
    expect(etiquetaDoProduto(produto({ duracaoMin }))).toEqual({ preco: 54, detalhe })
  })

  test("oferta leva o preço antigo junto", () => {
    expect(etiquetaDoProduto(produto({ preco: 44, precoOriginal: 54 }))).toEqual({
      preco: 44,
      precoAntigo: 54,
    })
  })
})

describe("medida na etiqueta", () => {
  test("a medida cadastrada vai para a etiqueta", () => {
    expect(etiquetaDoProduto(produto({ medida: "Grande · 8 fatias" })).detalhe).toBe(
      "Grande · 8 fatias",
    )
  })

  test.each([
    ["Cerveja Skol 350ml", "", "350 ml"],
    ["Refrigerante de cola 2L", "", "2 L"],
    ["Água sem gás", "Garrafa de 500 ml.", "500 ml"],
    ["Pizza meio a meio", "8 fatias. Escolha dois sabores e a borda.", "8 fatias"],
    ["Linguiça toscana", "Pacote de 1 kg, ideal para o churrasco.", "1 kg"],
    ["Carvão vegetal", "Saco de 2,5 kg.", "2,5 kg"],
    ["Dúzia de esfihas", "12 unidades sortidas.", "12 unidades"],
    ["Combo família", "Pizza gigante e refrigerante de 2 litros.", "2 L"],
  ])("sem medida cadastrada, %s mostra a do próprio texto: %s", (nome, descricao, medida) => {
    expect(etiquetaDoProduto(produto({ nome, descricao })).detalhe).toBe(medida)
  })

  test("sem medida no texto, a etiqueta fica só com o preço", () => {
    expect(
      etiquetaDoProduto(produto({ nome: "Calabresa", descricao: "Calabresa e cebola." })).detalhe,
    ).toBeUndefined()
  })

  test("a embalagem do remédio vale mais que o texto", () => {
    const medicamento = { apresentacao: "500 mg, 21 cápsulas" } as DadosMedicamento
    expect(
      etiquetaDoProduto(produto({ descricao: "Caixa com 21 cápsulas de 500 ml", medicamento }))
        .detalhe,
    ).toBe("500 mg, 21 cápsulas")
  })
})
