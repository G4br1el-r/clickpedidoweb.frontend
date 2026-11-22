"use client"

import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { comTotais } from "../regras/conta"
import { useSegmentoAtual } from "../segmento-atual"
import type { SegmentoPainelId } from "../segmentos-painel"
import { chaves, servidorDo } from "./consultas"
import type {
  AberturaMesa,
  LancamentoMesa,
  Pagamento,
  PagamentoMesa,
  Retirada,
  Servidor,
} from "./servidor"
import type { ConfigSalao, DescontoConta, Pedido } from "./tipos"

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

export function useCriarMesa() {
  return useMudancaNasMesas((servidor, mesa: Parameters<Servidor["mesas"]["criar"]>[0]) =>
    servidor.mesas.criar(mesa),
  )
}

export function useEditarMesa() {
  return useMudancaNasMesas(
    (servidor, { id, dados }: { id: string; dados: Parameters<Servidor["mesas"]["editar"]>[1] }) =>
      servidor.mesas.editar(id, dados),
  )
}

export function useBloquearMesa() {
  return useMudancaNasMesas((servidor, { id, motivo }: { id: string; motivo?: string }) =>
    servidor.mesas.bloquear(id, motivo),
  )
}

export function useDesbloquearMesa() {
  return useMudancaNasMesas((servidor, id: string) => servidor.mesas.desbloquear(id))
}

export function useMarcarLimpa() {
  return useMudancaNasMesas((servidor, id: string) => servidor.mesas.marcarLimpa(id))
}

export function useExcluirMesa() {
  return useMudancaNasMesas((servidor, id: string) => servidor.mesas.excluir(id))
}

export function useAbrirMesa() {
  return useMudancaNasMesas(
    (servidor, { mesaId, ...abertura }: AberturaMesa & { mesaId: string }) =>
      servidor.mesas.abrir(mesaId, abertura),
    { aoSucesso: guardarComanda },
  )
}

export function useEditarItem() {
  return useMudancaNasMesas(
    (
      servidor,
      {
        pedidoId,
        itemId,
        ...mudanca
      }: { pedidoId: number; itemId: string } & Parameters<Servidor["mesas"]["editarItem"]>[2],
    ) => servidor.mesas.editarItem(pedidoId, itemId, mudanca),
    { aoSucesso: guardarComanda },
  )
}

export function useCancelarComanda() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, ...motivo }: { pedidoId: number; motivo: string; por?: string }) =>
      servidor.mesas.cancelarComanda(pedidoId, motivo),
    { aoSucesso: guardarComanda },
  )
}

export function useMarcarServido() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, por }: { pedidoId: number; por?: string }) =>
      servidor.mesas.marcarServido(pedidoId, por),
    { aoSucesso: guardarComanda },
  )
}

export function usePedirConta() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, por }: { pedidoId: number; por?: string }) =>
      servidor.mesas.pedirConta(pedidoId, por),
    { aoSucesso: guardarComanda },
  )
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
      {
        pedidoId,
        itemId,
        quantidade,
        ...retirada
      }: { pedidoId: number; itemId: string; quantidade: number } & Retirada,
    ) => servidor.mesas.alterarQuantidade(pedidoId, itemId, quantidade, retirada),
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
          return comTotais({ ...pedido, itens })
        },
      },
      aoSucesso: guardarComanda,
    },
  )
}

export function useRemoverItem() {
  return useMudancaNasMesas(
    (
      servidor,
      { pedidoId, itemId, ...retirada }: { pedidoId: number; itemId: string } & Retirada,
    ) => servidor.mesas.removerItem(pedidoId, itemId, retirada),
    {
      previsao: {
        pedidoId: ({ pedidoId }) => pedidoId,
        mudar: (pedido, { itemId }) => {
          return comTotais({ ...pedido, itens: pedido.itens.filter((item) => item.id !== itemId) })
        },
      },
      aoSucesso: guardarComanda,
    },
  )
}

/** Fecha a conta: recebe o saldo na forma dada ou, sem saldo, fecha sem pagamento. */
export function useFecharConta() {
  return useMudancaNasMesas(
    (
      servidor,
      { pedidoId, pagamento, por }: { pedidoId: number; pagamento?: PagamentoMesa; por?: string },
    ) => servidor.mesas.fecharConta(pedidoId, pagamento, por ? { por } : {}),
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

/** A conta fechada da mesa que ainda pode ser reaberta (a última, de hoje), ou `null`. */
export function useUltimaConta(mesaId: string | null) {
  const segmento = useSegmento()
  return useQuery({
    queryKey: [...chaveMesas(segmento), "ultima-conta", mesaId],
    queryFn: () => servidorDo(segmento).mesas.ultimaConta(mesaId as string),
    enabled: mesaId !== null,
  })
}

type ComMotivo = { pedidoId: number; motivo: string; por?: string }

export function usePagar() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, ...pagamento }: { pedidoId: number } & Pagamento) =>
      servidor.mesas.pagar(pedidoId, pagamento),
    { aoSucesso: guardarComanda },
  )
}

export function useEstornarPagamento() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, pagamentoId, ...motivo }: ComMotivo & { pagamentoId: string }) =>
      servidor.mesas.estornarPagamento(pedidoId, pagamentoId, motivo),
    { aoSucesso: guardarComanda },
  )
}

export function useDescontar() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, ...desconto }: { pedidoId: number; por?: string } & DescontoConta) =>
      servidor.mesas.descontar(pedidoId, desconto),
    { aoSucesso: guardarComanda },
  )
}

export function useDarCortesia() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, itemId, ...motivo }: ComMotivo & { itemId: string }) =>
      servidor.mesas.darCortesia(pedidoId, itemId, motivo),
    { aoSucesso: guardarComanda },
  )
}

export function useTirarTaxa() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, ...motivo }: ComMotivo) => servidor.mesas.tirarTaxa(pedidoId, motivo),
    { aoSucesso: guardarComanda },
  )
}

export function useTirarCouvert() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, ...motivo }: ComMotivo) => servidor.mesas.tirarCouvert(pedidoId, motivo),
    { aoSucesso: guardarComanda },
  )
}

export function useImprimirPreConta() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, por }: { pedidoId: number; por?: string }) =>
      servidor.mesas.imprimirPreConta(pedidoId, por),
    { aoSucesso: guardarComanda },
  )
}

/** A movimentação devolve a comanda: quem a tem aberta vê a mesa nova na hora. */
const guardarMovida = (
  cliente: QueryClient,
  segmento: SegmentoPainelId,
  { comanda, destino }: { comanda: Pedido; destino?: Pedido },
) => {
  guardarComanda(cliente, segmento, comanda)
  if (destino) guardarComanda(cliente, segmento, destino)
}

export function useTransferirMesa() {
  return useMudancaNasMesas(
    (
      servidor,
      {
        pedidoId,
        mesaDestinoId,
        ...opcoes
      }: { pedidoId: number; mesaDestinoId: string; confirmarReserva?: boolean; por?: string },
    ) => servidor.mesas.transferir(pedidoId, mesaDestinoId, opcoes),
    { aoSucesso: guardarMovida },
  )
}

export function useJuntarMesas() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, mesaIds, por }: { pedidoId: number; mesaIds: string[]; por?: string }) =>
      servidor.mesas.juntar(pedidoId, mesaIds, por ? { por } : {}),
    { aoSucesso: guardarMovida },
  )
}

export function useSepararMesas() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, por }: { pedidoId: number; por?: string }) =>
      servidor.mesas.separar(pedidoId, por ? { por } : {}),
    { aoSucesso: guardarMovida },
  )
}

export function useTransferirItens() {
  return useMudancaNasMesas(
    (
      servidor,
      {
        pedidoId,
        ...transferencia
      }: { pedidoId: number } & Parameters<Servidor["mesas"]["transferirItens"]>[1],
    ) => servidor.mesas.transferirItens(pedidoId, transferencia),
    { aoSucesso: guardarMovida },
  )
}

/** Desfaz a movimentação pela foto do servidor (10 s); no fim, tudo confere de novo. */
export function useDesfazer() {
  return useMudancaNasMesas((servidor, id: string) => servidor.mesas.desfazer(id))
}

export function useReabrirConta() {
  return useMudancaNasMesas(
    (servidor, { pedidoId, ...motivo }: ComMotivo) => servidor.mesas.reabrir(pedidoId, motivo),
    { aoSucesso: guardarComanda },
  )
}
