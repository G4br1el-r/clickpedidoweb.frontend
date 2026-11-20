"use client"

import {
  type QueryClient,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useSegmentoAtual } from "../segmento-atual"
import type { SegmentoPainelId } from "../segmentos-painel"
import { chaves, servidorDo } from "./consultas"
import type { Servidor } from "./servidor"
import type { Bairro, ConfigLoja, Motoboy, Praca, TemposCozinha } from "./tipos"

const useSegmento = () => useSegmentoAtual((estado) => estado.segmento)

export function useBairros() {
  const segmento = useSegmento()
  return useQuery({
    queryKey: [...chaves.tudo(segmento), "bairros"],
    queryFn: () => servidorDo(segmento).bairros.listar(),
  })
}

/**
 * Mudança no cadastro: com previsão, a lista muda na hora e volta se o servidor recusar;
 * `aoSucesso` guarda a resposta onde a tela lê; no fim, tudo do segmento confere com o
 * servidor.
 */
function useCadastro<A, R, T = unknown>(
  acao: (servidor: Servidor, argumentos: A) => Promise<R>,
  {
    previsao,
    aoSucesso,
  }: {
    previsao?: {
      lista: (segmento: SegmentoPainelId) => QueryKey
      mudar: (lista: T[], argumentos: A) => T[]
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
      const chave = previsao.lista(segmento)
      await cliente.cancelQueries({ queryKey: chave })
      const anterior = cliente.getQueryData<T[]>(chave)
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

/** A configuração volta inteira: atualiza na hora quem lê a loja. */
const guardarLoja = (cliente: QueryClient, segmento: SegmentoPainelId, loja: ConfigLoja) =>
  cliente.setQueryData(chaves.loja(segmento), loja)

const listaDeMotoboys = (segmento: SegmentoPainelId) => ["admin", segmento, "motoboys"] as const

export const useSalvarMotoboy = () =>
  useCadastro((servidor, motoboy: Omit<Motoboy, "id"> & { id?: string }) =>
    servidor.motoboys.salvar(motoboy),
  )
export const useAlternarMotoboy = () =>
  useCadastro<string, Motoboy, Motoboy>((servidor, id) => servidor.motoboys.alternar(id), {
    previsao: {
      lista: listaDeMotoboys,
      mudar: (lista, id) =>
        lista.map((motoboy) =>
          motoboy.id === id ? { ...motoboy, ativo: !motoboy.ativo } : motoboy,
        ),
    },
  })
export const useExcluirMotoboy = () =>
  useCadastro((servidor, id: string) => servidor.motoboys.excluir(id))

export const useSalvarBairro = () =>
  useCadastro((servidor, bairro: Omit<Bairro, "id"> & { id?: string }) =>
    servidor.bairros.salvar(bairro),
  )
export const useMudarBairros = () =>
  useCadastro(
    (servidor, { ids, mudanca }: { ids: string[]; mudanca: { taxa?: number; ativo?: boolean } }) =>
      servidor.bairros.mudarVarios(ids, mudanca),
  )
export const useExcluirBairro = () =>
  useCadastro((servidor, id: string) => servidor.bairros.excluir(id))

export const useSalvarLoja = () =>
  useCadastro((servidor, loja: ConfigLoja) => servidor.salvarLoja(loja), {
    aoSucesso: guardarLoja,
  })
export const useConectarPagamento = () =>
  useCadastro((servidor, conectado: boolean) => servidor.conectarPagamentoOnline(conectado), {
    aoSucesso: guardarLoja,
  })
export const useSalvarTemposCozinha = () =>
  useCadastro((servidor, tempos: TemposCozinha) => servidor.salvarTemposCozinha(tempos), {
    aoSucesso: guardarLoja,
  })
export const useSalvarPracas = () =>
  useCadastro((servidor, pracas: Praca[]) => servidor.salvarPracas(pracas), {
    aoSucesso: guardarLoja,
  })
export const useLigarViaDaCozinha = () =>
  useCadastro((servidor, ligada: boolean) => servidor.ligarViaDaCozinha(ligada), {
    aoSucesso: guardarLoja,
  })
export const useMarcarImpresso = () =>
  useCadastro((servidor, id: number) => servidor.pedidos.marcarImpresso(id))
