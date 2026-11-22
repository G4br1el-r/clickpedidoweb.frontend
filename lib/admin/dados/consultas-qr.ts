"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { SegmentoPainelId } from "../segmentos-painel"
import { chaves, servidorDo } from "./consultas"
import type { Chamado, ItemPedidoQr } from "./tipos"

/**
 * A vitrine da mesa: a loja e a mesa vêm do endereço (o QR), não do segmento escolhido no
 * painel. As chaves ficam sob `["admin", segmento]`, que o aviso das outras abas invalida.
 */
const chaveMesaQr = (segmento: SegmentoPainelId, mesaId: string) =>
  [...chaves.tudo(segmento), "qr", mesaId] as const

/** A mesa como o cliente vê, conferida de tempos em tempos (o garçom lança de outro aparelho). */
export function useMesaQr(segmento: SegmentoPainelId, mesaId: string, intervalo = 10_000) {
  return useQuery({
    queryKey: chaveMesaQr(segmento, mesaId),
    queryFn: () => servidorDo(segmento).qr.mesa(mesaId),
    refetchInterval: intervalo,
    retry: false,
  })
}

function useMudancaNaMesaQr<A, R>(
  segmento: SegmentoPainelId,
  mesaId: string,
  acao: (argumentos: A) => Promise<R>,
) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: acao,
    onSettled: () => cliente.invalidateQueries({ queryKey: chaveMesaQr(segmento, mesaId) }),
  })
}

export function usePedirNaMesa(segmento: SegmentoPainelId, mesaId: string) {
  return useMudancaNaMesaQr(segmento, mesaId, (itens: ItemPedidoQr[]) =>
    servidorDo(segmento).qr.pedir(mesaId, itens),
  )
}

export function useChamarNaMesa(segmento: SegmentoPainelId, mesaId: string) {
  return useMudancaNaMesaQr(segmento, mesaId, (tipo: Chamado["tipo"]) =>
    servidorDo(segmento).qr.chamar(mesaId, tipo),
  )
}
