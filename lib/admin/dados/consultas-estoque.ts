"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSegmentoAtual } from "../segmento-atual"
import { servidorDo } from "./consultas"
import type { Servidor } from "./servidor"

const useSegmento = () => useSegmentoAtual((estado) => estado.segmento)

/** Histórico de um produto, do mais novo ao mais antigo; parado sem produto. */
export function useMovimentos(produtoId: string | null) {
  const segmento = useSegmento()
  return useQuery({
    queryKey: ["admin", segmento, "estoque", "movimentos", produtoId],
    queryFn: () => servidorDo(segmento).estoque.movimentos(produtoId ?? undefined),
    enabled: produtoId !== null,
  })
}

type ApiEstoque = Servidor["estoque"]

/**
 * Movimento ou configuração: o servidor devolve o produto já com o saldo novo;
 * no fim, tudo do segmento confere (produtos, PDV, cardápio e o histórico).
 */
function useMudancaNoEstoque<A>(acao: (estoque: ApiEstoque, argumentos: A) => Promise<unknown>) {
  const segmento = useSegmento()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (argumentos: A) => acao(servidorDo(segmento).estoque, argumentos),
    onSettled: () => cliente.invalidateQueries({ queryKey: ["admin", segmento] }),
  })
}

export const useEntradaEstoque = () =>
  useMudancaNoEstoque(
    (estoque, { id, ...dados }: { id: string } & Parameters<ApiEstoque["entrada"]>[1]) =>
      estoque.entrada(id, dados),
  )

export const useSaidaEstoque = () =>
  useMudancaNoEstoque(
    (estoque, { id, ...dados }: { id: string } & Parameters<ApiEstoque["saida"]>[1]) =>
      estoque.saida(id, dados),
  )

export const useContagemEstoque = () =>
  useMudancaNoEstoque(
    (estoque, { id, ...dados }: { id: string } & Parameters<ApiEstoque["contagem"]>[1]) =>
      estoque.contagem(id, dados),
  )

export const useConfigurarEstoque = () =>
  useMudancaNoEstoque(
    (estoque, { id, ...dados }: { id: string } & Parameters<ApiEstoque["configurar"]>[1]) =>
      estoque.configurar(id, dados),
  )
