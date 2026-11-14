import { arrayMove } from "@dnd-kit/sortable"
import type { GrupoOpcao, ItemOpcao, Produto } from "../dados/tipos"
import { normalizar } from "./filtro-pedidos"

export type Situacao = "todos" | "disponiveis" | "esgotados" | "ocultos" | "destaques" | "ofertas"
export type FiltrosCardapio = { busca?: string; categoriaId?: string | null; situacao?: Situacao }
export type GerarId = () => string

const NOME_MAXIMO = 80

/** Desconto da oferta em %, ou `null` quando não há oferta de verdade. */
export function percentualOferta(produto: Produto): number | null {
  if (!produto.oferta || !produto.precoOriginal || produto.precoOriginal <= produto.preco)
    return null
  return Math.round((1 - produto.preco / produto.precoOriginal) * 100)
}

const NA_SITUACAO: Record<Situacao, (produto: Produto) => boolean> = {
  todos: () => true,
  disponiveis: (produto) => produto.disponivel && produto.ativo,
  esgotados: (produto) => !produto.disponivel,
  ocultos: (produto) => !produto.ativo,
  destaques: (produto) => produto.destaque,
  ofertas: (produto) => percentualOferta(produto) !== null,
}

export function filtrarProdutos(
  produtos: Produto[],
  { busca = "", categoriaId, situacao = "todos" }: FiltrosCardapio,
) {
  const termo = normalizar(busca).trim()
  return produtos.filter(
    (produto) =>
      (!categoriaId || produto.categoriaId === categoriaId) &&
      NA_SITUACAO[situacao](produto) &&
      (!termo || normalizar(`${produto.nome} ${produto.descricao}`).includes(termo)),
  )
}

export function contarSituacoes(produtos: Produto[]): Record<Situacao, number> {
  return Object.fromEntries(
    Object.entries(NA_SITUACAO).map(([situacao, aceita]) => [
      situacao,
      produtos.filter(aceita).length,
    ]),
  ) as Record<Situacao, number>
}

/** Grupos de opções com ids novos: a cópia não divide nada com o original. */
function copiarGrupos(grupos: GrupoOpcao[], gerarId: GerarId): GrupoOpcao[] {
  return grupos.map((grupo) => ({
    ...grupo,
    id: gerarId(),
    itens: grupo.itens.map((item) => ({ ...item, id: gerarId() })),
  }))
}

export function copiarProduto(produto: Produto, gerarId: GerarId): Produto {
  const sufixo = " (Cópia)"
  return {
    ...produto,
    id: gerarId(),
    nome: `${produto.nome.slice(0, NOME_MAXIMO - sufixo.length)}${sufixo}`,
    grupos: copiarGrupos(produto.grupos, gerarId),
  }
}

/** Os outros produtos da mesma categoria passam a ter as opções do produto de origem. */
export function replicarOpcoes(produtos: Produto[], origemId: string, gerarId: GerarId): Produto[] {
  const origem = produtos.find((produto) => produto.id === origemId)
  if (!origem) return produtos
  return produtos.map((produto) =>
    produto.id !== origem.id && produto.categoriaId === origem.categoriaId
      ? { ...produto, grupos: copiarGrupos(origem.grupos, gerarId) }
      : produto,
  )
}

/** Move um item para o lugar de outro (arrastando ou pelo teclado) e renumera a ordem. */
export function reordenar<T extends { id: string; ordem: number }>(
  itens: T[],
  de: string,
  para: string,
): T[] {
  const ordenados = itens.toSorted((a, b) => a.ordem - b.ordem)
  const origem = ordenados.findIndex((item) => item.id === de)
  const destino = ordenados.findIndex((item) => item.id === para)
  if (origem < 0 || destino < 0) return ordenados
  return arrayMove(ordenados, origem, destino).map((item, indice) => ({
    ...item,
    ordem: indice + 1,
  }))
}

const vendavel = (produto: Produto) => produto.ativo && produto.disponivel

/** Troca cada opção ligada ao produto `produtoId`, em todos os combos. */
function mudarOpcoesDe(
  produtos: Produto[],
  produtoId: string,
  mudar: (item: ItemOpcao) => ItemOpcao,
): Produto[] {
  return produtos.map((produto) => {
    const ligado = produto.grupos.some((grupo) =>
      grupo.itens.some((item) => item.produtoId === produtoId),
    )
    if (!ligado) return produto
    return {
      ...produto,
      grupos: produto.grupos.map((grupo) => ({
        ...grupo,
        itens: grupo.itens.map((item) => (item.produtoId === produtoId ? mudar(item) : item)),
      })),
    }
  })
}

/**
 * Combos que se ajustam sozinhos: toda opção ligada ao produto acompanha o nome dele.
 * O `ativo` da opção só muda quando o produto passa a estar (ou deixa de estar) no
 * cardápio e disponível, comparado com o `anterior`; assim a opção desligada à mão no
 * combo continua desligada quando o produto é salvo por outro motivo. Sem `anterior`
 * (produto novo), a opção segue o produto.
 */
export function sincronizarOpcoes(
  produtos: Produto[],
  alterado: Produto,
  anterior?: Produto,
): Produto[] {
  const ativa = vendavel(alterado)
  const mudou = !anterior || vendavel(anterior) !== ativa
  return mudarOpcoesDe(produtos, alterado.id, (item) => ({
    ...item,
    nome: alterado.nome,
    ...(mudou ? { ativo: ativa } : {}),
  }))
}

/** Produto excluído: as opções ligadas a ele ficam desligadas e sem a ligação. */
export function soltarOpcoesDe(produtos: Produto[], produtoId: string): Produto[] {
  return mudarOpcoesDe(produtos, produtoId, ({ produtoId: _, ...item }) => ({
    ...item,
    ativo: false,
  }))
}

/** Opção nova já ligada ao produto, com o nome e o preço de balcão (ou o do cardápio). */
export function opcaoDoProduto(produto: Produto, ordem: number, gerarId: GerarId): ItemOpcao {
  return {
    id: gerarId(),
    nome: produto.nome,
    precoAdicional: produto.precoBalcao ?? produto.preco,
    ordem,
    ativo: produto.ativo && produto.disponivel,
    produtoId: produto.id,
  }
}
