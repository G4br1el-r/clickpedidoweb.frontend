"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { reordenar } from "../regras/cardapio"
import { useSegmentoAtual } from "../segmento-atual"
import type { SegmentoPainelId } from "../segmentos-painel"
import { servidorDo } from "./consultas"
import type { Categoria, Produto } from "./tipos"

const chaves = {
  produtos: (segmento: SegmentoPainelId) => ["admin", segmento, "produtos"] as const,
  categorias: (segmento: SegmentoPainelId) => ["admin", segmento, "categorias"] as const,
}

const useSegmento = () => useSegmentoAtual((estado) => estado.segmento)

export function useProdutos() {
  const segmento = useSegmento()
  return useQuery({
    queryKey: chaves.produtos(segmento),
    queryFn: () => servidorDo(segmento).produtos.listar(),
  })
}

export function useCategorias() {
  const segmento = useSegmento()
  return useQuery({
    queryKey: chaves.categorias(segmento),
    queryFn: () => servidorDo(segmento).categorias.listar(),
  })
}

/**
 * Mutação numa lista (produtos ou categorias): a mudança aparece na hora,
 * volta atrás se o servidor recusar e confere com o servidor no fim.
 */
function useMutacaoNaLista<A, R, T>(
  qual: "produtos" | "categorias",
  acao: (segmento: SegmentoPainelId, argumentos: A) => Promise<R>,
  previsao?: (lista: T[], argumentos: A) => T[],
) {
  const segmento = useSegmento()
  const cliente = useQueryClient()
  const chave = chaves[qual](segmento)
  return useMutation({
    mutationFn: (argumentos: A) => acao(segmento, argumentos),
    onMutate: async (argumentos) => {
      if (!previsao) return { anterior: undefined }
      await cliente.cancelQueries({ queryKey: chave })
      const anterior = cliente.getQueryData<T[]>(chave)
      if (anterior) cliente.setQueryData(chave, previsao(anterior, argumentos))
      return { anterior }
    },
    onError: (_erro, _argumentos, contexto) => {
      if (contexto?.anterior) cliente.setQueryData(chave, contexto.anterior)
    },
    // Categorias mudam a ordem e a contagem dos produtos: as duas listas conferem.
    onSettled: () => cliente.invalidateQueries({ queryKey: ["admin", segmento] }),
  })
}

const trocar = (lista: Produto[], id: string, mudar: (produto: Produto) => Produto) =>
  lista.map((produto) => (produto.id === id ? mudar(produto) : produto))

export function useAlternarProduto() {
  return useMutacaoNaLista<
    { id: string; campo: "disponivel" | "ativo" | "destaque" },
    Produto,
    Produto
  >(
    "produtos",
    (segmento, { id, campo }) => servidorDo(segmento).produtos.alternar(id, campo),
    (lista, { id, campo }) =>
      trocar(lista, id, (produto) => ({ ...produto, [campo]: !produto[campo] })),
  )
}

export function useDefinirPreco() {
  return useMutacaoNaLista<{ id: string; preco: number }, Produto, Produto>(
    "produtos",
    (segmento, { id, preco }) => servidorDo(segmento).produtos.definirPreco(id, preco),
    (lista, { id, preco }) => trocar(lista, id, (produto) => ({ ...produto, preco })),
  )
}

export function useSalvarProduto() {
  return useMutacaoNaLista<Produto, Produto, Produto>("produtos", (segmento, produto) =>
    servidorDo(segmento).produtos.salvar(produto),
  )
}

export function useCopiarProduto() {
  return useMutacaoNaLista<string, Produto, Produto>("produtos", (segmento, id) =>
    servidorDo(segmento).produtos.copiar(id),
  )
}

export function useExcluirProduto() {
  return useMutacaoNaLista<string, void, Produto>(
    "produtos",
    (segmento, id) => servidorDo(segmento).produtos.excluir(id),
    (lista, id) => lista.filter((produto) => produto.id !== id),
  )
}

export function useReplicarOpcoes() {
  return useMutacaoNaLista<string, number, Produto>("produtos", (segmento, id) =>
    servidorDo(segmento).produtos.replicarOpcoes(id),
  )
}

export function useCriarCategoria() {
  return useMutacaoNaLista<string, Categoria, Categoria>("categorias", (segmento, nome) =>
    servidorDo(segmento).categorias.criar(nome),
  )
}

export function useSalvarCategoria() {
  return useMutacaoNaLista<Categoria, Categoria, Categoria>(
    "categorias",
    (segmento, categoria) => servidorDo(segmento).categorias.salvar(categoria),
    (lista, categoria) => lista.map((item) => (item.id === categoria.id ? categoria : item)),
  )
}

export function useReordenarCategorias() {
  return useMutacaoNaLista<{ de: string; para: string }, Categoria[], Categoria>(
    "categorias",
    (segmento, { de, para }) => servidorDo(segmento).categorias.reordenar(de, para),
    (lista, { de, para }) => reordenar(lista, de, para),
  )
}

export function useExcluirCategoria() {
  return useMutacaoNaLista<string, void, Categoria>("categorias", (segmento, id) =>
    servidorDo(segmento).categorias.excluir(id),
  )
}
