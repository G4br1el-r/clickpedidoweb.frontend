import type { StaticImageData } from "next/image"
import { describe, expect, test } from "vitest"
import {
  avisoDeFaltantes,
  escolhidosDe,
  gruposFaltantes,
  montarItemSacola,
  precoComExtras,
  textoDeBusca,
} from "./produto"
import type { GrupoOpcao, Produto } from "./tipos"

const IMAGEM = { src: "/pizza.jpg", width: 1, height: 1 } as StaticImageData

const SABOR_1 = {
  id: "sabor-1",
  tipo: "sabor",
  nome: "1º sabor",
  titulo: "Escolha o primeiro sabor",
  obrigatorio: true,
  itens: [
    { id: "calabresa", nome: "Calabresa", extra: 0 },
    { id: "camarao", nome: "Camarão", extra: 10 },
  ],
} as GrupoOpcao

const SABOR_2 = {
  id: "sabor-2",
  tipo: "sabor",
  nome: "2º sabor",
  titulo: "Escolha o segundo sabor",
  obrigatorio: true,
  itens: [{ id: "mussarela", nome: "Mussarela", extra: 0 }],
} as GrupoOpcao

const BORDA = {
  id: "borda",
  tipo: "borda",
  nome: "Borda",
  titulo: "Quer borda recheada?",
  obrigatorio: false,
  itens: [{ id: "catupiry", nome: "Catupiry", extra: 8.5 }],
} as GrupoOpcao

const GRUPOS = [SABOR_1, SABOR_2, BORDA]

const PRODUTO = {
  id: "pizza-montada",
  tipo: "pizza",
  nome: "Monte a sua",
  descricao: "",
  preco: 39.9,
  imagem: IMAGEM,
  grupos: GRUPOS,
} as Produto

describe("escolhidosDe", () => {
  test("devolve o item escolhido de cada grupo, na ordem dos grupos", () => {
    const escolhidos = escolhidosDe(GRUPOS, { borda: "catupiry", "sabor-1": "camarao" })

    expect(escolhidos.map(({ grupo, item }) => [grupo.id, item.id])).toEqual([
      ["sabor-1", "camarao"],
      ["borda", "catupiry"],
    ])
  })

  test("ignora escolha que não existe no grupo", () => {
    expect(escolhidosDe(GRUPOS, { "sabor-1": "portuguesa" })).toEqual([])
  })
})

describe("gruposFaltantes", () => {
  test("lista os grupos obrigatórios ainda sem escolha", () => {
    expect(gruposFaltantes(GRUPOS, {})).toEqual([SABOR_1, SABOR_2])
    expect(gruposFaltantes(GRUPOS, { "sabor-1": "calabresa" })).toEqual([SABOR_2])
  })

  test("grupo opcional nunca falta", () => {
    expect(gruposFaltantes(GRUPOS, { "sabor-1": "calabresa", "sabor-2": "mussarela" })).toEqual([])
  })
})

describe("avisoDeFaltantes", () => {
  test("com uma escolha faltando, usa o título do grupo", () => {
    expect(avisoDeFaltantes([SABOR_1])).toBe("Escolha o primeiro sabor para continuar")
  })

  test("com várias, conta e lista os nomes curtos", () => {
    expect(avisoDeFaltantes([SABOR_1, SABOR_2])).toBe("Faltam 2 escolhas: 1º sabor, 2º sabor")
  })
})

describe("precoComExtras", () => {
  test("soma ao preço do produto o extra de cada escolha", () => {
    const escolhidos = escolhidosDe(GRUPOS, { "sabor-1": "camarao", borda: "catupiry" })
    expect(precoComExtras(PRODUTO, escolhidos)).toBe(58.4)
  })

  test("sem escolhas, é o preço do produto", () => {
    expect(precoComExtras(PRODUTO, [])).toBe(39.9)
  })
})

describe("montarItemSacola", () => {
  test("monta o item com preço, quantidade e resumo das escolhas", () => {
    const escolhidos = escolhidosDe(GRUPOS, {
      "sabor-1": "camarao",
      "sabor-2": "mussarela",
      borda: "catupiry",
    })

    expect(montarItemSacola(PRODUTO, escolhidos, 2, "  sem cebola ")).toEqual({
      produtoId: "pizza-montada",
      nome: "Monte a sua",
      imagem: IMAGEM,
      precoUnitario: 58.4,
      quantidade: 2,
      resumo: ["Camarão", "Mussarela", "Borda catupiry"],
      observacao: "sem cebola",
    })
  })

  test("observação em branco não vai para o item", () => {
    expect(montarItemSacola(PRODUTO, [], 1, "   ").observacao).toBeUndefined()
  })
})

describe("na farmácia", () => {
  const remedio = (medicamento?: Produto["medicamento"]): Produto =>
    ({
      id: "amoxicilina-500",
      tipo: "medicamento",
      nome: "Amoxicilina 500 mg",
      descricao: "Antibiótico. Caixa com 21 cápsulas.",
      preco: 27.9,
      imagem: IMAGEM,
      ...(medicamento ? { medicamento } : {}),
    }) as Produto

  const amoxicilina = {
    tarja: "vermelha-retencao",
    tipo: "generico",
    principioAtivo: "Amoxicilina tri-hidratada",
    apresentacao: "500 mg, 21 cápsulas",
    laboratorio: "EMS",
    registroMs: "1023508930064",
    lista: "antimicrobiano",
  } as const

  test("o item da sacola guarda como o remédio pode ser vendido", () => {
    expect(montarItemSacola(remedio(amoxicilina), [], 1, "").venda).toBe("receita-retida")
    expect(montarItemSacola(remedio(), [], 1, "")).not.toHaveProperty("venda")
  })

  test("a busca também acha pelo princípio ativo e pelo laboratório", () => {
    expect(textoDeBusca(remedio(amoxicilina))).toBe(
      "amoxicilina 500 mg antibiotico. caixa com 21 capsulas. amoxicilina tri-hidratada ems",
    )
    expect(textoDeBusca(remedio())).toBe("amoxicilina 500 mg antibiotico. caixa com 21 capsulas.")
  })
})
