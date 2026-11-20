"use client"

import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  avancarRodada,
  avisarSobreRodada,
  darCiente,
  prontoNaPraca,
  riscarItem,
  type StatusTicket,
  servirRodada,
  verMensagem,
  voltarRodada,
} from "../regras/cozinha"
import type { VisaoDePraca } from "../regras/pracas"
import { proximoStatus } from "../regras/status"
import { useSegmentoAtual } from "../segmento-atual"
import type { SegmentoPainelId } from "../segmentos-painel"
import { carregarCatalogo } from "./catalogos"
import { criarServidor, type FiltroPedidos, type Servidor, type VendaPdv } from "./servidor"
import type { ConfigLoja, Pedido, StatusPedido, TipoMensagemCozinha } from "./tipos"

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
    })
    servidores.set(segmento, servidor)
  }
  return servidor
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
  return useMutacaoDePedido<MudancaDeEtapa>(
    (servidor, { id, de }) => servidor.pedidos.cancelar(id, de),
    (pedido, { de }) =>
      pedido.status === "concluido" || pedido.status !== de
        ? pedido
        : { ...pedido, status: "cancelado" },
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
export function useFila(intervalo = 5_000) {
  return usePedidos({ status: STATUS_DA_FILA }, { atualizarACada: intervalo })
}

/**
 * O que a cozinha acompanha, conferido a cada 4 s: novos, em preparo, prontos e o
 * cancelado de que ela ainda não deu ciente.
 */
export function useCozinha(intervalo = 4_000) {
  return usePedidos({ naCozinha: true }, { atualizarACada: intervalo })
}

/** A previsão usa a mesma regra do servidor; se ela recusar, a tela fica como está. */
const ouIgual =
  <A>(mudar: (pedido: Pedido, argumentos: A) => Pedido) =>
  (pedido: Pedido, argumentos: A) => {
    try {
      return mudar(pedido, argumentos)
    } catch {
      return pedido
    }
  }

/** `de`: a etapa que o ticket mostrava. Se outra tela já mudou, o servidor recusa. */
type MudancaDeTicket = { id: number; rodada: number; de: StatusTicket }

export function useAvancarTicket() {
  return useMutacaoDePedido<MudancaDeTicket>(
    (servidor, { id, rodada, de }) => servidor.cozinha.avancar(id, rodada, de),
    ouIgual((pedido, { rodada, de }) =>
      avancarRodada(pedido, rodada, de, new Date().toISOString()),
    ),
  )
}

export function useVoltarTicket() {
  return useMutacaoDePedido<MudancaDeTicket>(
    (servidor, { id, rodada, de }) => servidor.cozinha.voltar(id, rodada, de),
    ouIgual((pedido, { rodada, de }) => voltarRodada(pedido, rodada, de)),
  )
}

export function useRiscarItem() {
  return useMutacaoDePedido<{ id: number; itemId: string; feito: boolean }>(
    (servidor, { id, itemId, feito }) => servidor.cozinha.riscar(id, itemId, feito),
    ouIgual((pedido, { itemId, feito }) =>
      riscarItem(pedido, itemId, feito, new Date().toISOString()),
    ),
  )
}

/** A praça terminou a parte dela na rodada; com a última, a rodada fica pronta. */
export function useProntoNaPraca() {
  return useMutacaoDePedido<{ id: number; rodada: number; visao: VisaoDePraca }>(
    (servidor, { id, rodada, visao }) => servidor.cozinha.prontoNaPraca(id, rodada, visao.pracaId),
    ouIgual((pedido, { rodada, visao }) =>
      prontoNaPraca(pedido, rodada, visao, new Date().toISOString()),
    ),
  )
}

/** A cozinha viu o cancelamento ou a alteração: o aviso sai de todas as telas. */
export function useDarCiente() {
  return useMutacaoDePedido<{ id: number; avisoId: string }>(
    (servidor, { id, avisoId }) => servidor.cozinha.ciente(id, avisoId),
    ouIgual((pedido, { avisoId }) => darCiente(pedido, avisoId, new Date().toISOString())),
  )
}

/** O garçom levou a rodada pronta à mesa: ela sai da cozinha e do salão. */
export function useServirRodada() {
  return useMutacaoDePedido<{ id: number; rodada: number }>(
    (servidor, { id, rodada }) => servidor.cozinha.servir(id, rodada),
    ouIgual((pedido, { rodada }) => servirRodada(pedido, rodada, new Date().toISOString())),
  )
}

/** Mensagem rápida da cozinha sobre a rodada, para o salão ou o caixa. */
export function useAvisarSobreRodada() {
  return useMutacaoDePedido<{ id: number; rodada: number; tipo: TipoMensagemCozinha }>(
    (servidor, { id, rodada, tipo }) => servidor.cozinha.avisar(id, rodada, tipo),
    // A previsão usa um id provisório; o do servidor chega quando a lista recarrega.
    ouIgual((pedido, { rodada, tipo }) =>
      avisarSobreRodada(pedido, rodada, tipo, "previsto", new Date().toISOString()),
    ),
  )
}

/** Ok na mensagem da cozinha: ela sai de todas as telas. */
export function useVerMensagem() {
  return useMutacaoDePedido<{ id: number; mensagemId: string }>(
    (servidor, { id, mensagemId }) => servidor.pedidos.verMensagem(id, mensagemId),
    ouIgual((pedido, { mensagemId }) => verMensagem(pedido, mensagemId, new Date().toISOString())),
  )
}

export function usePriorizarPedido() {
  return useMutacaoDePedido<{ id: number; prioridade: boolean }>(
    (servidor, { id, prioridade }) => servidor.pedidos.priorizar(id, prioridade),
    (pedido, { prioridade }) => ({ ...pedido, prioridade }),
  )
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

/**
 * Marca a via da cozinha como impressa. `nova` diz se este aparelho foi o primeiro: só
 * ele imprime.
 */
export function useMarcarVia() {
  const segmento = useSegmento()
  return useMutation({
    mutationFn: ({ id, via }: { id: number; via: string }) =>
      servidorDo(segmento).cozinha.marcarVia(id, via),
  })
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
