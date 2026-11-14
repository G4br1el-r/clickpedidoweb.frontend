import { describe, expect, test } from "vitest"
import type { GrupoOpcao, Produto } from "../dados/tipos"
import {
  adicionarItem,
  bloqueioDaVenda,
  descontoPassaDoSubtotal,
  errosDasEscolhas,
  precoComOpcoes,
  precoDeBalcao,
  resumoDasOpcoes,
  totaisDaVenda,
  troco,
} from "./pdv"

const item = (id: string, nome: string, precoAdicional: number, ativo = true) => ({
  id,
  nome,
  precoAdicional,
  ordem: 1,
  ativo,
})

const BORDA: GrupoOpcao = {
  id: "borda",
  nome: "Borda",
  minimo: 1,
  maximo: 1,
  gratisAte: 0,
  ordem: 1,
  ativo: true,
  itens: [item("sem", "Sem borda", 0), item("catupiry", "Catupiry", 8)],
}
const ADICIONAIS: GrupoOpcao = {
  id: "adicionais",
  nome: "Adicionais",
  minimo: 0,
  maximo: 3,
  gratisAte: 1,
  ordem: 2,
  ativo: true,
  itens: [item("bacon", "Bacon", 5), item("ovo", "Ovo", 2), item("cheddar", "Cheddar", 4)],
}
const GRUPOS = [BORDA, ADICIONAIS]

const produto: Produto = {
  id: "prod-x",
  categoriaId: "cat",
  nome: "X-Tudo",
  descricao: "",
  preco: 30,
  precoBalcao: 27,
  ativo: true,
  disponivel: true,
  destaque: false,
  oferta: false,
  ordem: 1,
  unidade: "un",
  grupos: GRUPOS,
}

describe("precoDeBalcao", () => {
  test("usa o preço de balcão quando o segmento tem e o produto preencheu", () => {
    expect(precoDeBalcao(produto, "adega")).toBe(27)
    expect(precoDeBalcao({ ...produto, precoBalcao: undefined }, "adega")).toBe(30)
  })

  test("sem o recurso no segmento, vale o preço do cardápio", () => {
    expect(precoDeBalcao(produto, "lanchonete")).toBe(30)
  })
})

describe("precoComOpcoes", () => {
  test("soma os adicionais escolhidos", () => {
    expect(precoComOpcoes(30, GRUPOS, { borda: ["catupiry"], adicionais: [] })).toBe(38)
  })

  test("grátis até 1: o mais barato sai de graça", () => {
    // Bacon 5 + Ovo 2 + Cheddar 4: o Ovo (o mais barato) não é cobrado.
    expect(
      precoComOpcoes(30, GRUPOS, { borda: ["sem"], adicionais: ["bacon", "ovo", "cheddar"] }),
    ).toBe(39)
  })
})

describe("errosDasEscolhas", () => {
  test("pede o mínimo e não deixa passar do máximo", () => {
    const quatro = { ...ADICIONAIS, maximo: 2 }
    expect(
      errosDasEscolhas([BORDA, quatro], { borda: [], adicionais: ["bacon", "ovo", "cheddar"] }),
    ).toEqual({
      borda: "Escolha 1 opção.",
      adicionais: "No máximo 2 opções.",
    })
  })

  test("mínimo maior que 1 e máximo de 1 no singular", () => {
    const doisOuTres = { ...ADICIONAIS, minimo: 2, maximo: 3 }
    const umSo = { ...ADICIONAIS, id: "um", minimo: 0, maximo: 1 }
    expect(
      errosDasEscolhas([doisOuTres, umSo], { adicionais: ["bacon"], um: ["bacon", "ovo"] }),
    ).toEqual({ adicionais: "Escolha pelo menos 2 opções.", um: "No máximo 1 opção." })
  })

  test("escolhas certas não têm erro", () => {
    expect(errosDasEscolhas(GRUPOS, { borda: ["sem"] })).toEqual({})
  })
})

describe("resumoDasOpcoes", () => {
  test("texto das opções na ordem dos grupos, sem grupo vazio", () => {
    expect(resumoDasOpcoes(GRUPOS, { adicionais: ["ovo", "bacon"], borda: ["catupiry"] })).toEqual([
      "Borda: Catupiry",
      "Adicionais: Bacon, Ovo",
    ])
    expect(resumoDasOpcoes(GRUPOS, { borda: ["sem"], adicionais: [] })).toEqual([
      "Borda: Sem borda",
    ])
  })
})

describe("adicionarItem", () => {
  const coca = { produtoId: "coca", nome: "Coca", quantidade: 1, precoUnitario: 8, opcoes: [] }

  test("item igual soma a quantidade; diferente entra como outra linha", () => {
    let itens = adicionarItem([], coca)
    itens = adicionarItem(itens, { ...coca, quantidade: 2 })
    expect(itens).toHaveLength(1)
    expect(itens[0].quantidade).toBe(3)

    itens = adicionarItem(itens, { ...coca, observacao: "Sem gelo" })
    expect(itens).toHaveLength(2)
  })
})

describe("totaisDaVenda", () => {
  const itens = [
    { chave: "a", produtoId: "a", nome: "A", quantidade: 2, precoUnitario: 15, opcoes: [] },
    { chave: "b", produtoId: "b", nome: "B", quantidade: 1, precoUnitario: 20.5, opcoes: [] },
  ]

  test("subtotal, desconto em reais e total", () => {
    expect(totaisDaVenda(itens, { modo: "reais", valor: 5.5 })).toEqual({
      quantidade: 3,
      subtotal: 50.5,
      desconto: 5.5,
      total: 45,
    })
  })

  test("desconto em %, arredondado nos centavos", () => {
    expect(totaisDaVenda(itens, { modo: "porcento", valor: 10 }).desconto).toBe(5.05)
  })

  test("desconto negativo vale zero", () => {
    expect(totaisDaVenda(itens, { modo: "reais", valor: -5 }).desconto).toBe(0)
    expect(totaisDaVenda(itens, { modo: "porcento", valor: -5 }).desconto).toBe(0)
  })

  test("o desconto não passa do subtotal nem de 100%", () => {
    expect(totaisDaVenda(itens, { modo: "reais", valor: 80 }).total).toBe(0)
    expect(totaisDaVenda(itens, { modo: "porcento", valor: 150 }).desconto).toBe(50.5)
  })

  test("desconto que não é número vale zero", () => {
    expect(totaisDaVenda(itens, { modo: "reais", valor: Number.NaN })).toMatchObject({
      desconto: 0,
      total: 50.5,
    })
    expect(totaisDaVenda(itens, { modo: "porcento", valor: Number.NaN }).total).toBe(50.5)
  })
})

describe("descontoPassaDoSubtotal", () => {
  test("em reais, acima do subtotal; em %, acima de 100", () => {
    expect(descontoPassaDoSubtotal(50, { modo: "reais", valor: 50 })).toBe(false)
    expect(descontoPassaDoSubtotal(50, { modo: "reais", valor: 50.01 })).toBe(true)
    expect(descontoPassaDoSubtotal(50, { modo: "porcento", valor: 100 })).toBe(false)
    expect(descontoPassaDoSubtotal(50, { modo: "porcento", valor: 101 })).toBe(true)
  })
})

describe("bloqueioDaVenda", () => {
  const lanche = {
    chave: "a",
    produtoId: "a",
    nome: "A",
    quantidade: 2,
    precoUnitario: 15,
    opcoes: [],
  }
  const venda = {
    itens: [lanche],
    desconto: { modo: "reais" as const, valor: 0 },
    pagamento: "dinheiro",
    recebido: undefined,
  }

  test("o que falta para fechar, na ordem em que o caixa resolve", () => {
    expect(bloqueioDaVenda({ ...venda, itens: [] })).toBe("Inclua um item.")
    expect(bloqueioDaVenda({ ...venda, desconto: { modo: "reais", valor: 31 } })).toBe(
      "O desconto passa do subtotal.",
    )
    expect(bloqueioDaVenda({ ...venda, desconto: { modo: "porcento", valor: 120 } })).toBe(
      "O desconto passa do subtotal.",
    )
    expect(bloqueioDaVenda({ ...venda, pagamento: null })).toBe("Escolha a forma de pagamento.")
    expect(bloqueioDaVenda({ ...venda, recebido: 29.99 })).toBe("Falta dinheiro.")
  })

  test("pode fechar: dinheiro que cobre o total, sem valor recebido ou outro pagamento", () => {
    expect(bloqueioDaVenda({ ...venda, recebido: 30 })).toBeNull()
    expect(bloqueioDaVenda(venda)).toBeNull()
    expect(bloqueioDaVenda({ ...venda, pagamento: "pix", recebido: 10 })).toBeNull()
    expect(
      bloqueioDaVenda({ ...venda, desconto: { modo: "reais", valor: 30 }, recebido: 0 }),
    ).toBeNull()
  })
})

describe("troco", () => {
  test("troco quando sobra, falta quando não chega", () => {
    expect(troco(45, 50)).toEqual({ troco: 5, falta: 0 })
    expect(troco(45, 40)).toEqual({ troco: 0, falta: 5 })
  })
})
