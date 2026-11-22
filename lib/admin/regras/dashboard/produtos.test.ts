import { describe, expect, test } from "vitest"
import type { ItemPedido, Produto } from "../../dados/tipos"
import {
  PEDIDOS_DE_TESTE as PEDIDOS,
  PERIODO_DE_TESTE as PERIODO,
  pedidoDeTeste,
} from "../pedidos-de-teste"
import {
  coberturaDoEstoque,
  curvaABC,
  margemDoPeriodo,
  opcoesMaisEscolhidas,
  porCategoria,
  resumoABC,
  semVenda,
  vendasPorProduto,
} from "./produtos"

describe("vendasPorProduto", () => {
  test("cada produto vendido no período, com quantidade, faturamento e pedidos, do maior faturamento ao menor", () => {
    // Cancelado e aguardando o Pix não contam; os dias 10 e 11 ficam fora do período.
    expect(vendasPorProduto(PEDIDOS, PERIODO)).toEqual([
      {
        chave: "Calabresa",
        produtoId: "Calabresa",
        nome: "Calabresa",
        quantidade: 2,
        faturamento: 80,
        pedidos: 2,
      },
      {
        chave: "Coca",
        produtoId: "Coca",
        nome: "Coca",
        quantidade: 4,
        faturamento: 60,
        pedidos: 2,
      },
      {
        chave: "Guaraná",
        produtoId: "Guaraná",
        nome: "Guaraná",
        quantidade: 1,
        faturamento: 20,
        pedidos: 1,
      },
    ])
  })
})

const NO_PERIODO = new Date(2026, 10, 13, 19)

/** Um item de teste; os campos que faltam vêm do pedido de teste. */
const item = (mudancas: Partial<ItemPedido>): ItemPedido => ({
  id: mudancas.nome ?? "item",
  produtoId: mudancas.nome ?? "item",
  nome: "item",
  quantidade: 1,
  precoUnitario: 10,
  opcoes: [],
  total: 10,
  ...mudancas,
})

describe("vendasPorProduto: quilo", () => {
  test("no quilo, soma o peso da balança, ou o pedido quando ainda não pesou", () => {
    const pedidos = [
      pedidoDeTeste(1, NO_PERIODO, 60, {
        itens: [
          item({ nome: "Picanha", pesoGramas: 500, quantidade: 2, pesoReal: 1040, total: 60 }),
        ],
      }),
      pedidoDeTeste(2, NO_PERIODO, 45, {
        itens: [item({ nome: "Picanha", pesoGramas: 750, quantidade: 1, total: 45 })],
      }),
    ]
    expect(vendasPorProduto(pedidos, PERIODO)[0]).toMatchObject({
      nome: "Picanha",
      quantidade: 3,
      kg: 1.79,
      faturamento: 105,
    })
    expect(vendasPorProduto(PEDIDOS, PERIODO)[0]).not.toHaveProperty("kg")
  })
})

describe("curvaABC", () => {
  const vendido = (nome: string, faturamento: number) => ({
    chave: nome,
    produtoId: nome,
    nome,
    quantidade: 1,
    faturamento,
    pedidos: 1,
  })

  test("A até somar 80% do faturamento, B os 15% seguintes e C o resto, com a parte de cada um", () => {
    const curva = curvaABC([
      vendido("Pizza", 50),
      vendido("Lanche", 30),
      vendido("Refri", 15),
      vendido("Bala", 5),
    ])
    expect(curva.map((produto) => [produto.nome, produto.classe, produto.percentual])).toEqual([
      ["Pizza", "A", 50],
      ["Lanche", "A", 30],
      ["Refri", "B", 15],
      ["Bala", "C", 5],
    ])
  })

  test("o resumo soma cada classe que aparece: produtos, faturamento e a parte dela", () => {
    const curva = curvaABC([
      vendido("Pizza", 50),
      vendido("Lanche", 30),
      vendido("Refri", 15),
      vendido("Bala", 5),
    ])
    expect(resumoABC(curva)).toEqual([
      { classe: "A", produtos: 2, faturamento: 80, percentual: 80 },
      { classe: "B", produtos: 1, faturamento: 15, percentual: 15 },
      { classe: "C", produtos: 1, faturamento: 5, percentual: 5 },
    ])
    expect(resumoABC(curvaABC([vendido("Pizza", 10)]))).toEqual([
      { classe: "A", produtos: 1, faturamento: 10, percentual: 100 },
    ])
  })

  test("o produto que cruza os 80% ainda é A; sem venda, a curva é vazia", () => {
    const curva = curvaABC([vendido("Pizza", 70), vendido("Lanche", 20), vendido("Refri", 10)])
    expect(curva.map((produto) => produto.classe)).toEqual(["A", "A", "B"])
    expect(curvaABC([])).toEqual([])
  })
})

/** Produto de teste do cardápio: só o que as contas usam. */
const produto = (id: string, mudancas: Partial<Produto> = {}): Produto => ({
  id,
  categoriaId: "bebidas",
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
  ...mudancas,
})

const CATEGORIAS = [
  { id: "pizzas", nome: "Pizzas", ordem: 1, ativa: true },
  { id: "bebidas", nome: "Bebidas", ordem: 2, ativa: true },
]

describe("porCategoria", () => {
  test("soma os produtos de cada categoria, com a parte do faturamento; avulso fica em Avulsos", () => {
    const vendas = [
      ...vendasPorProduto(PEDIDOS, PERIODO),
      {
        chave: "avulso:Gelo",
        produtoId: null,
        nome: "Gelo",
        quantidade: 2,
        faturamento: 40,
        pedidos: 1,
      },
    ]
    const produtos = [
      produto("Calabresa", { categoriaId: "pizzas" }),
      produto("Coca"),
      produto("Guaraná"),
    ]

    expect(porCategoria(vendas, produtos, CATEGORIAS)).toEqual([
      { chave: "pizzas", nome: "Pizzas", quantidade: 2, faturamento: 80, percentual: 40 },
      { chave: "bebidas", nome: "Bebidas", quantidade: 5, faturamento: 80, percentual: 40 },
      { chave: "avulsos", nome: "Avulsos", quantidade: 2, faturamento: 40, percentual: 20 },
    ])
  })

  test("produto que saiu do cardápio fica em Sem categoria", () => {
    expect(porCategoria(vendasPorProduto(PEDIDOS, PERIODO), [], CATEGORIAS)).toEqual([
      {
        chave: "sem-categoria",
        nome: "Sem categoria",
        quantidade: 7,
        faturamento: 160,
        percentual: 100,
      },
    ])
  })
})

describe("semVenda", () => {
  test("os produtos ativos no cardápio que não venderam no período, em ordem alfabética", () => {
    const produtos = [
      produto("Coca"),
      produto("Suco"),
      produto("Água"),
      produto("Antigo", { ativo: false }),
      produto("Calabresa"),
    ]
    expect(semVenda(produtos, vendasPorProduto(PEDIDOS, PERIODO)).map((item) => item.nome)).toEqual(
      ["Água", "Suco"],
    )
  })
})

describe("opcoesMaisEscolhidas", () => {
  test("cada opção escolhida conta uma vez por unidade do item, da mais escolhida à menos", () => {
    const pedidos = [
      pedidoDeTeste(1, NO_PERIODO, 60, {
        itens: [
          item({
            nome: "X-Burger",
            quantidade: 2,
            opcoes: ["Adicional: Bacon, Ovo", "Ponto: Mal passado"],
          }),
          item({ nome: "X-Salada", opcoes: ["Adicional: Bacon"] }),
        ],
      }),
      // Cancelado não conta.
      pedidoDeTeste(2, NO_PERIODO, 30, {
        status: "cancelado",
        itens: [item({ nome: "X-Burger", quantidade: 5, opcoes: ["Adicional: Ovo"] })],
      }),
    ]
    expect(opcoesMaisEscolhidas(pedidos, PERIODO)).toEqual([
      { grupo: "Adicional", opcao: "Bacon", vezes: 3 },
      { grupo: "Adicional", opcao: "Ovo", vezes: 2 },
      { grupo: "Ponto", opcao: "Mal passado", vezes: 2 },
    ])
  })
})

describe("margemDoPeriodo", () => {
  const pedidos = [
    pedidoDeTeste(1, NO_PERIODO, 110, {
      itens: [
        // Margem: 30 − 2 × 6 = R$ 18 (60%).
        item({ nome: "Lanche", quantidade: 2, total: 30, custoUnitario: 6 }),
        // No quilo, o custo vai pelo peso: 1,04 kg × R$ 30 = R$ 31,20; margem R$ 28,80 (48%).
        item({
          nome: "Picanha",
          quantidade: 2,
          pesoGramas: 500,
          pesoReal: 1040,
          total: 60,
          custoUnitario: 30,
        }),
        item({ nome: "Sem custo", total: 20 }),
      ],
    }),
  ]

  test("margem de cada produto com custo, da maior para a menor", () => {
    expect(margemDoPeriodo(pedidos, PERIODO).porProduto).toEqual([
      { chave: "Picanha", nome: "Picanha", receita: 60, custo: 31.2, margem: 28.8, percentual: 48 },
      { chave: "Lanche", nome: "Lanche", receita: 30, custo: 12, margem: 18, percentual: 60 },
    ])
  })

  test("a margem do período só com o que tem custo, e quanto do faturamento ela cobre", () => {
    const { total, cobertura, semCusto } = margemDoPeriodo(pedidos, PERIODO)
    expect(total).toEqual({ receita: 90, custo: 43.2, margem: 46.8, percentual: 52 })
    // R$ 90 dos R$ 110 vendidos têm custo.
    expect(cobertura).toBeCloseTo(81.82, 2)
    expect(semCusto).toEqual({ produtos: 1, faturamento: 20 })
  })

  test("sem nenhum custo informado, a margem é zero e a cobertura também", () => {
    expect(margemDoPeriodo(PEDIDOS, PERIODO)).toMatchObject({
      total: { receita: 0, custo: 0, margem: 0, percentual: 0 },
      cobertura: 0,
      porProduto: [],
    })
  })
})

describe("coberturaDoEstoque", () => {
  const controle = (quantidade: number) => ({
    controlar: true,
    quantidade,
    minimo: 1,
    esgotarAoZerar: true,
  })

  test("em quantos dias cada controlado acaba, pelo consumo médio do período; sem venda, sem previsão", () => {
    const produtos = [
      produto("Coca", { estoque: controle(10) }),
      produto("Guaraná", { estoque: controle(3) }),
      produto("Água", { estoque: controle(8) }),
      produto("Calabresa"),
    ]
    // Em 2 dias: 4 Cocas (2 por dia) e 1 Guaraná (0,5 por dia).
    expect(coberturaDoEstoque(produtos, PEDIDOS, PERIODO)).toEqual([
      { id: "Coca", nome: "Coca", unidade: "un", saldo: 10, porDia: 2, dias: 5 },
      { id: "Guaraná", nome: "Guaraná", unidade: "un", saldo: 3, porDia: 0.5, dias: 6 },
      { id: "Água", nome: "Água", unidade: "un", saldo: 8, porDia: 0, dias: null },
    ])
  })
})
