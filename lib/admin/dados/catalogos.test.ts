import { describe, expect, test } from "vitest"
import { esquemaLoja } from "../regras/esquema-loja"
import { SEGMENTOS_PAINEL } from "../segmentos-painel"
import { carregarCatalogo } from "./catalogos"
import { gerarPedidos } from "./gerar-pedidos"

const LOJAS = {
  adega: "Adega da Vila",
  acougue: "Açougue Sabor da Carne",
  pizzaria: "Casa da Pizza",
  salao: "Empório das Deusas",
  lanchonete: "Quiosque do Mineiro",
  farmacia: "Drogaria Bem Estar",
}

describe.each(SEGMENTOS_PAINEL.map((segmento) => segmento.id))("catálogo de %s", (segmento) => {
  test("a configuração da loja passa no esquema das configurações", async () => {
    const { loja } = await carregarCatalogo(segmento)
    const resultado = esquemaLoja.safeParse(loja)
    expect(resultado.success ? [] : resultado.error.issues.map((erro) => erro.message)).toEqual([])
  })

  test("é a loja de referência e gera uma semana de pedidos com valor", async () => {
    const catalogo = await carregarCatalogo(segmento)
    expect(catalogo.loja.nome).toBe(LOJAS[segmento])

    const pedidos = gerarPedidos({
      catalogo,
      segmento,
      de: new Date(2026, 10, 7),
      agora: new Date(2026, 10, 13, 18, 0),
    })
    // Sem as vendas do PDV de hoje (o caixa abre fechado), o salão fica com 19 na semana.
    expect(pedidos.length).toBeGreaterThan(15)
    for (const pedido of pedidos) {
      expect(pedido.itens.length).toBeGreaterThan(0)
      expect(pedido.total).toBeGreaterThanOrEqual(0)
    }
    expect(pedidos.some((pedido) => pedido.total > 0)).toBe(true)
  })

  test("todo produto aponta para uma categoria que existe", async () => {
    const catalogo = await carregarCatalogo(segmento)
    const categorias = new Set(catalogo.categorias.map((categoria) => categoria.id))
    for (const produto of catalogo.produtos) expect(categorias).toContain(produto.categoriaId)
  })
})

describe("combos da adega", () => {
  test("os gelos dos combos vêm ligados aos produtos de gelo do cardápio", async () => {
    const { produtos } = await carregarCatalogo("adega")
    const combo = produtos.find((produto) => produto.id === "prod-master-black-combo-2-gelo")
    const gelos = combo?.grupos.find((grupo) => grupo.nome === "Sabores do Gelo")
    const ligacao = Object.fromEntries(
      (gelos?.itens ?? []).map((opcao) => [opcao.nome, opcao.produtoId ?? null]),
    )
    expect(ligacao).toMatchObject({
      "Gelo de Coco": "prod-gelo-de-coco",
      "Gelo de Maçã Verde": "prod-gelo-de-maca-verde",
      "Gelo de Morango c/ Pêssego": "prod-gelo-de-morango-com-pessego",
      "Gelo Blue Ice": "prod-gelo-de-blue-ice-azul",
      // Sem produto no cardápio: continua uma opção solta.
      "Gelo Tradicional": null,
    })
  })
})
