import { describe, expect, test } from "vitest"
import type { ControleEstoque, ItemPedido, Pedido, Produto } from "../dados/tipos"
import {
  consumoDoPedido,
  emQuantidade,
  errosDoMovimento,
  numeroComSinal,
  resumoDoEstoque,
  rotuloDoMovimento,
  saldoDepois,
  situacaoEstoque,
} from "./estoque"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const controle = (mudanca: Partial<ControleEstoque> = {}): ControleEstoque => ({
  controlar: true,
  quantidade: 10,
  minimo: 3,
  esgotarAoZerar: true,
  ...mudanca,
})

function produto(id: string, mudanca: Partial<Produto> = {}): Produto {
  return {
    id,
    categoriaId: "cat",
    nome: id,
    descricao: "",
    preco: 10,
    ativo: true,
    disponivel: true,
    destaque: false,
    oferta: false,
    ordem: 1,
    unidade: "un",
    grupos: [],
    ...mudanca,
  }
}

describe("situacaoEstoque", () => {
  test("ok, baixo (no mínimo ou abaixo), zerado e negativo", () => {
    expect(situacaoEstoque(controle({ quantidade: 4 }))).toBe("ok")
    expect(situacaoEstoque(controle({ quantidade: 3 }))).toBe("baixo")
    expect(situacaoEstoque(controle({ quantidade: 0.5 }))).toBe("baixo")
    expect(situacaoEstoque(controle({ quantidade: 0 }))).toBe("zerado")
    expect(situacaoEstoque(controle({ quantidade: -2 }))).toBe("negativo")
  })
})

describe("saldoDepois", () => {
  test("soma com sinal e guarda 3 casas (quilo)", () => {
    expect(saldoDepois(10, -3)).toBe(7)
    expect(saldoDepois(2.5, -0.62)).toBe(1.88)
    expect(saldoDepois(0.1, 0.2)).toBe(0.3)
  })
})

describe("consumoDoPedido", () => {
  const cerveja = produto("cerveja", { estoque: controle() })
  const picanha = produto("picanha", { unidade: "kg", estoque: controle({ quantidade: 20 }) })
  const gelo = produto("gelo", { estoque: controle() })
  const semControle = produto("pizza")
  const PRODUTOS = [cerveja, picanha, gelo, semControle]

  const item = (mudanca: Partial<ItemPedido>): ItemPedido => ({
    id: "i",
    produtoId: null,
    nome: "",
    quantidade: 1,
    precoUnitario: 10,
    opcoes: [],
    total: 10,
    ...mudanca,
  })
  const pedido = (itens: ItemPedido[]): Pedido => ({ ...PEDIDOS_DE_TESTE[2], itens })

  test("unidade, quilo (peso real se pesado), opções ligadas; o resto não conta", () => {
    const consumo = consumoDoPedido(
      pedido([
        item({ id: "a", produtoId: "cerveja", quantidade: 3 }),
        item({ id: "b", produtoId: "picanha", quantidade: 2, pesoGramas: 500 }),
        item({ id: "c", produtoId: "picanha", quantidade: 1, pesoGramas: 400, pesoReal: 450 }),
        item({ id: "d", produtoId: "pizza", quantidade: 2, produtosDasOpcoes: ["gelo", "gelo"] }),
        item({ id: "e", produtoId: null, nome: "Avulso" }),
      ]),
      PRODUTOS,
    )
    // Picanha: 2 × 500 g + 450 g pesados = 1,45 kg. Gelo: 2 pizzas × 2 gelos.
    expect(Object.fromEntries(consumo)).toEqual({ cerveja: 3, picanha: 1.45, gelo: 4 })
  })

  test("produto sem controle ou com o controle desligado não entra", () => {
    const desligado = produto("cerveja", { estoque: controle({ controlar: false }) })
    expect(
      consumoDoPedido(pedido([item({ produtoId: "cerveja", quantidade: 2 })]), [desligado]).size,
    ).toBe(0)
  })
})

describe("resumoDoEstoque", () => {
  test("controlados, baixos, zerados (com negativos) e o valor parado pelo custo", () => {
    const resumo = resumoDoEstoque([
      produto("a", { custo: 2.5, estoque: controle({ quantidade: 10 }) }),
      produto("b", { custo: 10, estoque: controle({ quantidade: 2 }) }),
      produto("c", { custo: 4, estoque: controle({ quantidade: 0 }) }),
      produto("d", { custo: 4, estoque: controle({ quantidade: -1 }) }),
      produto("e", { estoque: controle({ quantidade: 5 }) }),
      produto("f", { custo: 9, estoque: controle({ controlar: false, quantidade: 100 }) }),
      produto("g"),
    ])
    // Valor: 10 × 2,50 + 2 × 10 = R$ 45 (sem custo e negativo não somam).
    expect(resumo).toEqual({ controlados: 5, baixos: 1, zerados: 2, valorParado: 45 })
  })
})

describe("errosDoMovimento", () => {
  test("quantidade positiva, inteira na unidade, motivo na saída", () => {
    expect(errosDoMovimento({ tipo: "entrada", quantidade: 5, unidade: "un" })).toBeNull()
    expect(errosDoMovimento({ tipo: "entrada", quantidade: 0, unidade: "un" })).toBe(
      "Informe uma quantidade maior que zero.",
    )
    expect(errosDoMovimento({ tipo: "entrada", quantidade: 1.5, unidade: "un" })).toBe(
      "Na unidade, a quantidade é inteira.",
    )
    expect(errosDoMovimento({ tipo: "entrada", quantidade: 1.255, unidade: "kg" })).toBeNull()
    expect(errosDoMovimento({ tipo: "saida", quantidade: 2, unidade: "un", motivo: " " })).toBe(
      "Diga o motivo da saída.",
    )
    expect(errosDoMovimento({ tipo: "contagem", quantidade: 0, unidade: "un" })).toBeNull()
  })
})

describe("quantidades na tela", () => {
  test("unidade inteira e quilo com até 3 casas, no jeito brasileiro", () => {
    expect(emQuantidade(12, "un")).toBe("12 un")
    expect(emQuantidade(3.5, "kg")).toBe("3,5 kg")
    expect(emQuantidade(0.125, "kg")).toBe("0,125 kg")
    expect(emQuantidade(-2, "un")).toBe("−2 un")
  })

  test("diferença e movimento com sinal; zero sem sinal", () => {
    expect(numeroComSinal(10)).toBe("+10")
    expect(numeroComSinal(-2)).toBe("−2")
    expect(numeroComSinal(-0.5)).toBe("−0,5")
    expect(numeroComSinal(0)).toBe("0")
  })
})

describe("rotuloDoMovimento", () => {
  test.each([
    ["perda", "Perda"],
    ["devolucao", "Devolução"],
    ["venda", "Venda"],
    ["saida", "Saída"],
  ] as const)("%s se lê %s", (tipo, rotulo) => {
    expect(rotuloDoMovimento(tipo)).toBe(rotulo)
  })
})
