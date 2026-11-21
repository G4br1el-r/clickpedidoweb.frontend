import { describe, expect, test } from "vitest"
import { situacaoEstoque } from "../regras/estoque"
import { carregarCatalogo } from "./catalogos"
import { semearEstoque } from "./estoque-demo"

const AGORA = new Date(2026, 10, 13, 20, 30)

describe("semearEstoque", () => {
  test("o mesmo catálogo semeia sempre o mesmo estoque", async () => {
    const catalogo = await carregarCatalogo("adega")
    const um = semearEstoque({ catalogo, segmento: "adega", agora: AGORA })
    const outro = semearEstoque({ catalogo, segmento: "adega", agora: AGORA })
    expect(outro.produtos.map((produto) => produto.estoque)).toEqual(
      um.produtos.map((produto) => produto.estoque),
    )
    expect(outro.movimentos.map(({ id: _, ...resto }) => resto)).toEqual(
      um.movimentos.map(({ id: _, ...resto }) => resto),
    )
  })

  test("o que cada loja controla: tudo na adega, só revenda na pizzaria, nada no salão", async () => {
    const controlados = async (segmento: Parameters<typeof carregarCatalogo>[0]) => {
      const catalogo = await carregarCatalogo(segmento)
      const { produtos } = semearEstoque({ catalogo, segmento, agora: AGORA })
      const categorias = new Map(catalogo.categorias.map((item) => [item.id, item.nome]))
      return {
        todos: produtos.filter((produto) => produto.ativo).length,
        controlados: produtos.filter((produto) => produto.estoque?.controlar),
        categorias,
      }
    }
    const adega = await controlados("adega")
    expect(adega.controlados.length).toBe(adega.todos)

    const pizzaria = await controlados("pizzaria")
    expect(pizzaria.controlados.length).toBeGreaterThan(0)
    for (const produto of pizzaria.controlados) {
      expect(pizzaria.categorias.get(produto.categoriaId)).toMatch(/bebida|sobremesa/i)
    }

    expect((await controlados("salao")).controlados).toEqual([])
  })

  test("o histórico fecha com o saldo, e a tela nasce com itens baixos e um zerado esgotado", async () => {
    const catalogo = await carregarCatalogo("adega")
    const { produtos, movimentos } = semearEstoque({ catalogo, segmento: "adega", agora: AGORA })
    for (const produto of produtos.filter((item) => item.estoque?.controlar)) {
      const dele = movimentos.filter((movimento) => movimento.produtoId === produto.id)
      expect(dele.at(-1)?.saldo).toBe(produto.estoque?.quantidade)
      // Cada saldo é o anterior mais o movimento.
      let saldo = 0
      for (const movimento of dele) {
        saldo = Math.round((saldo + movimento.quantidade) * 1000) / 1000
        expect(movimento.saldo).toBe(saldo)
      }
    }
    const datas = movimentos.map((movimento) => Date.parse(movimento.criadoEm))
    expect(datas).toEqual(datas.toSorted((a, b) => a - b))
    expect(datas.every((data) => data <= AGORA.getTime())).toBe(true)

    const situacoes = produtos.flatMap((produto) =>
      produto.estoque?.controlar ? [situacaoEstoque(produto.estoque)] : [],
    )
    expect(situacoes.filter((situacao) => situacao === "baixo").length).toBeGreaterThan(1)
    const zerados = produtos.filter(
      (produto) => produto.estoque?.controlar && produto.estoque.quantidade === 0,
    )
    expect(zerados.length).toBeGreaterThan(0)
    for (const produto of zerados) {
      expect(produto.disponivel).toBe(false)
      expect(produto.estoque?.esgotadoPeloEstoque).toBe(true)
    }
  })

  test("as compras usam o custo do produto; sem custo, o produto ganha um plausível", async () => {
    const catalogo = await carregarCatalogo("adega")
    const [primeiro, segundo] = catalogo.produtos
    const comCusto = {
      ...catalogo,
      produtos: [
        { ...primeiro, custo: 12.34 },
        { ...segundo, custo: undefined },
      ],
    }
    const { produtos, movimentos } = semearEstoque({
      catalogo: comCusto,
      segmento: "adega",
      agora: AGORA,
    })
    const entradas = (id: string) =>
      movimentos.filter((movimento) => movimento.produtoId === id && movimento.tipo === "entrada")

    expect(produtos[0].custo).toBe(12.34)
    for (const entrada of entradas(primeiro.id)) expect(entrada.custoUnitario).toBe(12.34)
    expect(produtos[0].estoque).not.toHaveProperty("custo")

    const custo = produtos[1].custo as number
    expect(custo).toBeGreaterThanOrEqual(segundo.preco * 0.4)
    expect(custo).toBeLessThanOrEqual(segundo.preco * 0.65)
    for (const entrada of entradas(segundo.id)) expect(entrada.custoUnitario).toBe(custo)
  })

  test("produto que já vem com estoque fica como veio, sem histórico inventado", async () => {
    const catalogo = await carregarCatalogo("adega")
    const [primeiro] = catalogo.produtos
    const proprio = { controlar: true, quantidade: 7, minimo: 2, esgotarAoZerar: true }
    const comEstoque = {
      ...catalogo,
      produtos: [{ ...primeiro, estoque: proprio }, ...catalogo.produtos.slice(1)],
    }
    const { produtos, movimentos } = semearEstoque({
      catalogo: comEstoque,
      segmento: "adega",
      agora: AGORA,
    })
    expect(produtos[0].estoque).toEqual(proprio)
    expect(movimentos.some((movimento) => movimento.produtoId === primeiro.id)).toBe(false)
  })
})
