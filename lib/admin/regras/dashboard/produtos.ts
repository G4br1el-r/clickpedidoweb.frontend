import type { Categoria, ItemPedido, Pedido, Produto } from "../../dados/tipos"
import { consumoDoPedido } from "../estoque"
import { diasNoPeriodo, type Periodo } from "../periodo"
import { ehValido, noPeriodo, reais } from "./comum"

/** Um produto vendido no período. Item avulso (sem produto) junta pelo nome. */
export type ProdutoVendido = {
  chave: string
  produtoId: string | null
  nome: string
  quantidade: number
  faturamento: number
  pedidos: number
  /** Venda por quilo: o peso vendido, em kg. */
  kg?: number
}

/** O produto do item; o avulso é identificado pelo nome. */
export const chaveDoItem = (item: ItemPedido) => item.produtoId ?? `avulso:${item.nome}`

/** Peso do item por quilo, em kg: o da balança, ou o pedido quando ainda não pesou. */
export const kgDoItem = (item: ItemPedido) =>
  item.pesoGramas === undefined
    ? undefined
    : (item.pesoReal ?? item.pesoGramas * item.quantidade) / 1000

const gramas = (kg: number) => Math.round(kg * 1000) / 1000

/** Itens das vendas válidas do período, cada um com o pedido de onde veio. */
export function itensDoPeriodo(pedidos: Pedido[], periodo: Periodo) {
  return noPeriodo(pedidos, periodo)
    .filter(ehValido)
    .flatMap((pedido) => pedido.itens.map((item) => ({ item, pedido })))
}

/**
 * Vendas de cada produto no período, do maior faturamento ao menor. O faturamento é o total
 * do item como foi vendido (com os adicionais e sem ratear o desconto do pedido).
 */
export function vendasPorProduto(pedidos: Pedido[], periodo: Periodo): ProdutoVendido[] {
  const vendidos = new Map<string, ProdutoVendido & { ids: Set<number> }>()
  for (const { item, pedido } of itensDoPeriodo(pedidos, periodo)) {
    const chave = chaveDoItem(item)
    const atual = vendidos.get(chave) ?? {
      chave,
      produtoId: item.produtoId,
      nome: item.nome,
      quantidade: 0,
      faturamento: 0,
      pedidos: 0,
      ids: new Set<number>(),
    }
    atual.ids.add(pedido.id)
    const kg = kgDoItem(item)
    vendidos.set(chave, {
      ...atual,
      quantidade: atual.quantidade + item.quantidade,
      faturamento: reais(atual.faturamento + item.total),
      pedidos: atual.ids.size,
      ...(kg === undefined ? {} : { kg: gramas((atual.kg ?? 0) + kg) }),
    })
  }
  return [...vendidos.values()]
    .map(({ ids: _, ...vendido }) => vendido)
    .sort((a, b) => b.faturamento - a.faturamento || b.quantidade - a.quantidade)
}

export type ClasseABC = "A" | "B" | "C"

/**
 * Curva ABC pelo faturamento: A são os produtos que somam os primeiros 80% (o que cruza a
 * linha ainda é A), B os 15% seguintes e C o resto. Espera a lista do maior para o menor.
 */
export function curvaABC(vendas: ProdutoVendido[]) {
  const total = vendas.reduce((soma, produto) => soma + produto.faturamento, 0)
  let antes = 0
  return vendas.map((produto) => {
    const percentual = total ? (produto.faturamento / total) * 100 : 0
    const classe: ClasseABC = antes < 80 ? "A" : antes < 95 ? "B" : "C"
    antes = Math.round((antes + percentual) * 1e6) / 1e6
    return { ...produto, classe, percentual }
  })
}

/**
 * Vendas por categoria do cardápio, do maior faturamento ao menor (empate: a ordem do
 * cardápio). Item avulso fica em Avulsos; produto que saiu do cardápio, em Sem categoria.
 */
export function porCategoria(
  vendas: ProdutoVendido[],
  produtos: Produto[],
  categorias: Categoria[],
) {
  const total = vendas.reduce((soma, produto) => soma + produto.faturamento, 0)
  const categoriaDo = new Map(produtos.map((produto) => [produto.id, produto.categoriaId]))
  const grupos = new Map<
    string,
    { chave: string; nome: string; quantidade: number; faturamento: number }
  >()
  for (const vendido of vendas) {
    const categoria = vendido.produtoId
      ? categorias.find((item) => item.id === categoriaDo.get(vendido.produtoId as string))
      : undefined
    const [chave, nome] = categoria
      ? [categoria.id, categoria.nome]
      : vendido.produtoId
        ? ["sem-categoria", "Sem categoria"]
        : ["avulsos", "Avulsos"]
    const atual = grupos.get(chave) ?? { chave, nome, quantidade: 0, faturamento: 0 }
    grupos.set(chave, {
      ...atual,
      quantidade: atual.quantidade + vendido.quantidade,
      faturamento: reais(atual.faturamento + vendido.faturamento),
    })
  }
  const ordem = (chave: string) => categorias.find((item) => item.id === chave)?.ordem ?? Infinity
  return [...grupos.values()]
    .map((grupo) => ({ ...grupo, percentual: total ? (grupo.faturamento / total) * 100 : 0 }))
    .sort((a, b) => b.faturamento - a.faturamento || ordem(a.chave) - ordem(b.chave))
}

/** Produtos ativos no cardápio que não venderam no período, em ordem alfabética. */
export function semVenda(produtos: Produto[], vendas: ProdutoVendido[]) {
  const vendidos = new Set(vendas.map((vendido) => vendido.produtoId))
  return produtos
    .filter((produto) => produto.ativo && !vendidos.has(produto.id))
    .toSorted((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

/**
 * Adicionais e opções mais escolhidos no período, pelo texto guardado no item
 * ("Adicional: Bacon, Ovo"). Cada opção conta uma vez por unidade do item.
 */
export function opcoesMaisEscolhidas(pedidos: Pedido[], periodo: Periodo) {
  const contagem = new Map<string, { grupo: string; opcao: string; vezes: number }>()
  for (const { item } of itensDoPeriodo(pedidos, periodo)) {
    for (const linha of item.opcoes) {
      const separador = linha.indexOf(": ")
      if (separador < 0) continue
      const grupo = linha.slice(0, separador)
      for (const opcao of linha.slice(separador + 2).split(", ")) {
        const chave = `${grupo}\u0000${opcao}`
        const atual = contagem.get(chave) ?? { grupo, opcao, vezes: 0 }
        contagem.set(chave, { ...atual, vezes: atual.vezes + item.quantidade })
      }
    }
  }
  return [...contagem.values()].sort(
    (a, b) =>
      b.vezes - a.vezes ||
      a.grupo.localeCompare(b.grupo, "pt-BR") ||
      a.opcao.localeCompare(b.opcao, "pt-BR"),
  )
}

type Margem = { receita: number; custo: number; margem: number; percentual: number }

const margemDe = (receita: number, custo: number): Margem => ({
  receita: reais(receita),
  custo: reais(custo),
  margem: reais(receita - custo),
  percentual: receita ? reais(((receita - custo) / receita) * 100) : 0,
})

/** Custo do item vendido: o custo copiado na venda vezes a quantidade (no quilo, o peso). */
const custoDoItem = (item: ItemPedido, custoUnitario: number) =>
  custoUnitario * (kgDoItem(item) ?? item.quantidade)

/**
 * Margem do período, só com os itens que têm custo. A receita é o total do item (com os
 * adicionais, que não têm custo próprio); a cobertura diz quanto do faturamento tem custo.
 */
export function margemDoPeriodo(pedidos: Pedido[], periodo: Periodo) {
  const porProduto = new Map<
    string,
    { chave: string; nome: string; receita: number; custo: number }
  >()
  const semCusto = new Set<string>()
  let faturamento = 0
  let faturamentoSemCusto = 0
  for (const { item } of itensDoPeriodo(pedidos, periodo)) {
    faturamento += item.total
    const chave = chaveDoItem(item)
    if (item.custoUnitario === undefined) {
      semCusto.add(chave)
      faturamentoSemCusto += item.total
      continue
    }
    const atual = porProduto.get(chave) ?? { chave, nome: item.nome, receita: 0, custo: 0 }
    porProduto.set(chave, {
      ...atual,
      receita: atual.receita + item.total,
      custo: atual.custo + custoDoItem(item, item.custoUnitario),
    })
  }
  const produtos = [...porProduto.values()]
    .map(({ chave, nome, receita, custo }) => ({ chave, nome, ...margemDe(receita, custo) }))
    .sort((a, b) => b.margem - a.margem)
  const receita = produtos.reduce((soma, produto) => soma + produto.receita, 0)
  const custo = produtos.reduce((soma, produto) => soma + produto.custo, 0)
  return {
    total: margemDe(receita, custo),
    cobertura: faturamento ? (receita / faturamento) * 100 : 0,
    semCusto: { produtos: semCusto.size, faturamento: reais(faturamentoSemCusto) },
    porProduto: produtos,
  }
}

/**
 * Cobertura do estoque: em quantos dias cada produto controlado acaba, pelo consumo médio
 * por dia no período (com os combos). Sem venda no período, não há previsão (`null`).
 * Do que acaba antes para o que dura mais.
 */
export function coberturaDoEstoque(produtos: Produto[], pedidos: Pedido[], periodo: Periodo) {
  const consumo = new Map<string, number>()
  for (const pedido of noPeriodo(pedidos, periodo).filter(ehValido)) {
    for (const [id, quantidade] of consumoDoPedido(pedido, produtos)) {
      consumo.set(id, (consumo.get(id) ?? 0) + quantidade)
    }
  }
  const dias = diasNoPeriodo(periodo)
  return produtos
    .filter((produto) => produto.estoque?.controlar)
    .map((produto) => {
      const saldo = Math.max(produto.estoque?.quantidade ?? 0, 0)
      const porDia = gramas((consumo.get(produto.id) ?? 0) / dias)
      return {
        id: produto.id,
        nome: produto.nome,
        unidade: produto.unidade,
        saldo,
        porDia,
        dias: porDia > 0 ? Math.floor(saldo / porDia) : null,
      }
    })
    .sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity))
}
