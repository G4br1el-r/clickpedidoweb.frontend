"use client"

import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { proximoStatus } from "../regras/status"
import { useSegmentoAtual } from "../segmento-atual"
import type { SegmentoPainelId } from "../segmentos-painel"
import { avisarOutrasAbas, ouvirOutrasAbas } from "./ao-vivo"
import { carregarCatalogo } from "./catalogos"
import { criarServidor, type FiltroPedidos, type Servidor, type VendaPdv } from "./servidor"
import type { ConfigLoja, MotivoCancelamento, Pedido, StatusPedido } from "./tipos"

/** Espera de rede simulada: dá para ver os estados de carregamento; zero nos testes. */
const ESPERA = process.env.NODE_ENV === "test" ? 0 : 250

const servidores = new Map<SegmentoPainelId, Servidor>()

/** Servidor de demonstração do segmento, um só por segmento enquanto a página está aberta. */
export function servidorDo(segmento: SegmentoPainelId): Servidor {
  let servidor = servidores.get(segmento)
  if (!servidor) {
    servidor = criarServidor({
      segmento,
      carregarCatalogo: () => carregarCatalogo(segmento),
      espera: ESPERA,
      aoGravar: () => avisarOutrasAbas(segmento),
    })
    servidores.set(segmento, servidor)
  }
  return servidor
}

/**
 * Ao vivo entre abas (Q43): quando outra aba grava, esquece a cópia em memória daquele segmento
 * e confere de novo as consultas dele.
 */
export function useAoVivo() {
  const cliente = useQueryClient()
  useEffect(
    () =>
      ouvirOutrasAbas((segmento) => {
        servidores.get(segmento)?.esquecer()
        void cliente.invalidateQueries({ queryKey: chaves.tudo(segmento) })
      }),
    [cliente],
  )
}

/** Esquece as bases já abertas; a próxima leitura volta ao IndexedDB. */
export function reiniciarServidores() {
  servidores.clear()
}

export const chaves = {
  tudo: (segmento: SegmentoPainelId) => ["admin", segmento] as const,
  loja: (segmento: SegmentoPainelId) => ["admin", segmento, "loja"] as const,
  pedidos: (segmento: SegmentoPainelId, filtro?: FiltroPedidos) =>
    filtro
      ? (["admin", segmento, "pedidos", filtro] as const)
      : (["admin", segmento, "pedidos"] as const),
  /** Um pedido só, aberto nos detalhes. Fora de "pedidos", que guarda listas. */
  pedido: (segmento: SegmentoPainelId, id: number) => ["admin", segmento, "pedido", id] as const,
}

const useSegmento = () => useSegmentoAtual((estado) => estado.segmento)

export function useLoja() {
  const segmento = useSegmento()
  return useQuery({ queryKey: chaves.loja(segmento), queryFn: () => servidorDo(segmento).loja() })
}

export function usePedidos(
  filtro?: FiltroPedidos,
  { ativo = true, atualizarACada }: { ativo?: boolean; atualizarACada?: number } = {},
) {
  const segmento = useSegmento()
  return useQuery({
    queryKey: chaves.pedidos(segmento, filtro),
    queryFn: () => servidorDo(segmento).pedidos.listar(filtro),
    enabled: ativo,
    ...(atualizarACada ? { refetchInterval: atualizarACada, refetchOnWindowFocus: true } : {}),
    // Trocando o filtro, a lista atual fica até a nova chegar; trocando de loja, não.
    placeholderData: (anterior, consultaAnterior) =>
      consultaAnterior?.queryKey[1] === segmento ? anterior : undefined,
  })
}

export function usePedido(id: number | null) {
  const segmento = useSegmento()
  return useQuery({
    queryKey: chaves.pedido(segmento, id ?? 0),
    queryFn: async () => (await servidorDo(segmento).pedidos.buscar(id ?? 0)) ?? null,
    enabled: id !== null,
  })
}

/**
 * Mutação de um pedido: aplica a mudança na hora em todas as listas (otimista),
 * desfaz se o servidor recusar e confere com o servidor no fim.
 */
function useMutacaoDePedido<A extends number | { id: number }>(
  acao: (servidor: Servidor, argumentos: A) => Promise<Pedido>,
  previsao: (pedido: Pedido, argumentos: A) => Pedido,
) {
  const segmento = useSegmento()
  const cliente = useQueryClient()
  const chave = chaves.pedidos(segmento)

  return useMutation({
    mutationFn: (argumentos: A) => acao(servidorDo(segmento), argumentos),
    onMutate: async (argumentos) => {
      const id = typeof argumentos === "number" ? argumentos : argumentos.id
      await cliente.cancelQueries({ queryKey: chave })
      const chaveDoPedido = chaves.pedido(segmento, id)
      await cliente.cancelQueries({ queryKey: chaveDoPedido })
      const anteriores = cliente.getQueriesData<Pedido[] | Pedido | null>({ queryKey: chave })
      const pedidoAnterior = cliente.getQueryData<Pedido | null>(chaveDoPedido)
      cliente.setQueriesData<Pedido[]>({ queryKey: chave }, (lista) =>
        lista?.map((pedido) => (pedido.id === id ? previsao(pedido, argumentos) : pedido)),
      )
      if (pedidoAnterior) cliente.setQueryData(chaveDoPedido, previsao(pedidoAnterior, argumentos))
      return { anteriores: [...anteriores, [chaveDoPedido, pedidoAnterior] as const] }
    },
    onError: (_erro, _argumentos, contexto) => {
      for (const [chaveDaLista, valor] of contexto?.anteriores ?? []) {
        cliente.setQueryData(chaveDaLista as QueryKey, valor)
      }
    },
    onSuccess: (pedido) => cliente.setQueryData(chaves.pedido(segmento, pedido.id), pedido),
    onSettled: () => cliente.invalidateQueries({ queryKey: chave }),
  })
}

/** `de`: a etapa que a tela mostrava. Se outra aba já mudou o pedido, o servidor recusa. */
type MudancaDeEtapa = { id: number; de: StatusPedido }

export function useAvancarPedido() {
  return useMutacaoDePedido<MudancaDeEtapa>(
    (servidor, { id, de }) => servidor.pedidos.avancar(id, de),
    (pedido, { de }) => {
      const proximo = pedido.status === de && proximoStatus(pedido.tipo, pedido.status)
      return proximo ? { ...pedido, status: proximo } : pedido
    },
  )
}

export function useCancelarPedido() {
  return useMutacaoDePedido<MudancaDeEtapa & { motivo?: MotivoCancelamento }>(
    (servidor, { id, de, motivo }) => servidor.pedidos.cancelar(id, de, motivo),
    (pedido, { de, motivo }) =>
      pedido.status === "concluido" || pedido.status !== de
        ? pedido
        : { ...pedido, status: "cancelado", ...(motivo ? { motivoCancelamento: motivo } : {}) },
  )
}

export function useMarcarPago() {
  return useMutacaoDePedido<number>(
    (servidor, id) => servidor.pedidos.marcarPago(id),
    (pedido) => ({ ...pedido, situacaoPagamento: "pago" }),
  )
}

export function useAtribuirMotoboy() {
  return useMutacaoDePedido<{ id: number; motoboyId: string }>(
    (servidor, { id, motoboyId }) => servidor.pedidos.atribuirMotoboy(id, motoboyId),
    (pedido, { motoboyId }) => ({ ...pedido, motoboyId }),
  )
}

export function useMotoboys() {
  const segmento = useSegmento()
  return useQuery({
    queryKey: ["admin", segmento, "motoboys"],
    queryFn: () => servidorDo(segmento).motoboys.listar(),
  })
}

/** Status que ficam na fila: tudo o que ainda não terminou. */
export const STATUS_DA_FILA: StatusPedido[] = [
  "aguardando-pagamento",
  "recebido",
  "em-preparo",
  "pronto",
  "saiu-para-entrega",
]

/** Fila ao vivo: o que está em aberto, de qualquer dia, conferido a cada 5 s. */
export function useFila() {
  return usePedidos({ status: STATUS_DA_FILA }, { atualizarACada: 5_000 })
}

/** O que a cozinha acompanha: novos, em preparo e prontos, conferido a cada 4 s. */
export function useCozinha(intervalo = 4_000) {
  return usePedidos({ status: ["recebido", "em-preparo", "pronto"] }, { atualizarACada: intervalo })
}

function useMudancaNaLoja(acao: (servidor: Servidor, valor: boolean) => Promise<ConfigLoja>) {
  const segmento = useSegmento()
  const cliente = useQueryClient()
  const chave = chaves.loja(segmento)
  return useMutation({
    mutationFn: (valor: boolean) => acao(servidorDo(segmento), valor),
    onSuccess: (loja) => cliente.setQueryData(chave, loja),
  })
}

export function useDefinirAberta() {
  return useMudancaNaLoja((servidor, aberta) => servidor.definirAberta(aberta))
}

export function useDefinirEntrega() {
  return useMudancaNaLoja((servidor, entrega) => servidor.definirEntrega(entrega))
}

/** Demonstração: um pedido novo chega agora. */
export function useSimularPedido() {
  const segmento = useSegmento()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: () => servidorDo(segmento).pedidos.simular(),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.pedidos(segmento) }),
  })
}

export function useUltimasVendas() {
  const segmento = useSegmento()
  return useQuery({
    queryKey: ["admin", segmento, "pdv", "ultimas"],
    queryFn: () => servidorDo(segmento).pdv.ultimasVendas(),
  })
}

/** Fecha a venda do PDV; a fila, os pedidos e as últimas vendas conferem depois. */
export function useFinalizarVenda() {
  const segmento = useSegmento()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (venda: VendaPdv) => servidorDo(segmento).pdv.finalizar(venda),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.tudo(segmento) }),
  })
}

/** Açougue: o peso da balança refaz os valores; o pedido aberto atualiza com a resposta. */
export function useRegistrarPesagem() {
  return useMutacaoDePedido<{ id: number; pesos: Record<string, number> }>(
    (servidor, { id, pesos }) => servidor.pedidos.registrarPesagem(id, pesos),
    (pedido) => pedido,
  )
}
