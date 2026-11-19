"use client"

import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSegmentoAtual } from "../segmento-atual"
import type { SegmentoPainelId } from "../segmentos-painel"
import { chaves, servidorDo } from "./consultas"
import type { LancamentoMesa, PagamentoMesa, Servidor } from "./servidor"
import type { ConfigSalao, Pedido } from "./tipos"

const chaveMesas = (segmento: SegmentoPainelId) => ["admin", segmento, "mesas"] as const
const chaveSalao = (segmento: SegmentoPainelId) => ["admin", segmento, "salao"] as const

const useSegmento = () => useSegmentoAtual((estado) => estado.segmento)

/** Mesas da loja, conferidas de tempos em tempos: o garçom lança de outro aparelho. */
export function useMesas(intervalo = 10_000, { ativo = true }: { ativo?: boolean } = {}) {
  const segmento = useSegmento()
  return useQuery({
    queryKey: chaveMesas(segmento),
    queryFn: () => servidorDo(segmento).mesas.listar(),
    refetchInterval: intervalo,
    enabled: ativo,
  })
}

/**
 * Mudança em mesa ou comanda. Com previsão, a comanda aberta muda na hora e volta
 * atrás se o servidor recusar; `aoSucesso` guarda a resposta onde a tela lê; no fim,
 * mesas, fila e cozinha conferem com o servidor.
 */
function useMudancaNasMesas<A, R>(
  acao: (servidor: Servidor, argumentos: A) => Promise<R>,
  {
    previsao,
    aoSucesso,
  }: {
    previsao?: {
      pedidoId: (argumentos: A) => number
      mudar: (pedido: Pedido, argumentos: A) => Pedido
    }
    aoSucesso?: (cliente: QueryClient, segmento: SegmentoPainelId, resultado: R) => void
  } = {},
) {
  const segmento = useSegmento()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (argumentos: A) => acao(servidorDo(segmento), argumentos),
    onMutate: async (argumentos) => {
      if (!previsao) return undefined
      const chave = chaves.pedido(segmento, previsao.pedidoId(argumentos))
      await cliente.cancelQueries({ queryKey: chave })
      const anterior = cliente.getQueryData<Pedido | null>(chave)
      if (anterior) cliente.setQueryData(chave, previsao.mudar(anterior, argumentos))
      return { chave, anterior }
    },
    onError: (_erro, _argumentos, contexto) => {
      if (contexto?.anterior) cliente.setQueryData(contexto.chave, contexto.anterior)
    },
    onSuccess: (resultado) => aoSucesso?.(cliente, segmento, resultado),
    onSettled: () => cliente.invalidateQueries({ queryKey: chaves.tudo(segmento) }),
  })
}

/** A comanda volta inteira: atualiza na hora quem está com ela aberta. */
const guardarComanda = (cliente: QueryClient, segmento: SegmentoPainelId, comanda: Pedido) =>
  cliente.setQueryData(chaves.pedido(segmento, comanda.id), comanda)

const totalDe = (itens: Pedido["itens"]) =>
  Math.round(itens.reduce((soma, item) => soma + item.total, 0) * 100) / 100

export function useCriarMesa() {
  return useMudancaNasMesas((servidor, mesa: { numero: number; nome?: string }) =>
    servidor.mesas.criar(mesa),
  )
}

export function useExcluirMesa() {
  return useMudancaNasMesas((servidor, id: string) => servidor.mesas.excluir(id))
}

export function useLancarNaMesa() {
  return useMudancaNasMesas(
    (servidor, lancamento: LancamentoMesa) => servidor.mesas.lancar(lancamento),
    { aoSucesso: guardarComanda },
  )
}

export function useAlterarQuantidade() {
  return useMudancaNasMesas(
    (
      servidor,
      { pedidoId, itemId, quantidade }: { pedidoId: number; itemId: string; quantidade: number },
    ) => servidor.mesas.alterarQuantidade(pedidoId, itemId, quantidade),
    {
      previsao: {
        pedidoId: ({ pedidoId }) => pedidoId,
        mudar: (pedido, { itemId, quantidade }) => {
          const itens = pedido.itens.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  quantidade,
                  total: Math.round(item.precoUnitario * quantidade * 100) / 100,
                }
              : item,
          )
          return { ...pedido, itens, subtotal: totalDe(itens), total: totalDe(itens) }
        },
      },
      aoSucesso: guardarComanda,
    },
  )
}

export function useRemoverItem() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, itemId }: { pedidoId: number; itemId: string }) =>
      servidor.mesas.removerItem(pedidoId, itemId),
    {
      previsao: {
        pedidoId: ({ pedidoId }) => pedidoId,
        mudar: (pedido, { itemId }) => {
          const itens = pedido.itens.filter((item) => item.id !== itemId)
          return { ...pedido, itens, subtotal: totalDe(itens), total: totalDe(itens) }
        },
      },
      aoSucesso: guardarComanda,
    },
  )
}

export function useFecharConta() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, pagamento }: { pedidoId: number; pagamento: PagamentoMesa }) =>
      servidor.mesas.fecharConta(pedidoId, pagamento),
    { aoSucesso: guardarComanda },
  )
}

export function useLiberarMesa() {
  return useMudancaNasMesas((servidor, mesaId: string) => servidor.mesas.liberar(mesaId))
}

/** Configuração do salão: áreas, garçons, taxas e alertas. */
export function useConfigSalao() {
  const segmento = useSegmento()
  return useQuery({
    queryKey: chaveSalao(segmento),
    queryFn: () => servidorDo(segmento).salao.config(),
  })
}

export function useSalvarConfigSalao() {
  return useMudancaNasMesas((servidor, config: ConfigSalao) => servidor.salao.salvar(config))
}
