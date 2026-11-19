"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSegmentoAtual } from "../segmento-atual"
import type { SegmentoPainelId } from "../segmentos-painel"
import { useUsuarioSalvo } from "../usuario-atual"
import { chaves, servidorDo } from "./consultas"
import { useUsuarioAtual } from "./consultas-equipe"
import type { Servidor } from "./servidor"

const useSegmento = () => useSegmentoAtual((estado) => estado.segmento)

export const chavesCaixa = {
  tudo: (segmento: SegmentoPainelId) => ["admin", segmento, "caixa"] as const,
  atual: (segmento: SegmentoPainelId) => ["admin", segmento, "caixa", "atual"] as const,
  resumo: (segmento: SegmentoPainelId, turnoId?: string) =>
    ["admin", segmento, "caixa", "resumo", turnoId] as const,
  historico: (segmento: SegmentoPainelId) => ["admin", segmento, "caixa", "historico"] as const,
  vendas: (segmento: SegmentoPainelId, turnoId: string) =>
    ["admin", segmento, "caixa", "vendas", turnoId] as const,
}

type ApiCaixa = Servidor["caixa"]

/** O turno aberto, ou `null` com o caixa fechado. */
export function useCaixaAtual() {
  const segmento = useSegmento()
  return useQuery({
    queryKey: chavesCaixa.atual(segmento),
    queryFn: () => servidorDo(segmento).caixa.atual(),
  })
}

export function useResumoTurno(turnoId?: string) {
  const segmento = useSegmento()
  return useQuery({
    queryKey: chavesCaixa.resumo(segmento, turnoId),
    queryFn: () => servidorDo(segmento).caixa.resumo(turnoId ?? ""),
    enabled: Boolean(turnoId),
  })
}

export function useHistoricoCaixas() {
  const segmento = useSegmento()
  return useQuery({
    queryKey: chavesCaixa.historico(segmento),
    queryFn: () => servidorDo(segmento).caixa.historico(),
  })
}

/** Vendas de um turno, da mais nova para a mais antiga. */
export function useVendasDoTurno(turnoId: string) {
  const segmento = useSegmento()
  return useQuery({
    queryKey: chavesCaixa.vendas(segmento, turnoId),
    queryFn: () => servidorDo(segmento).caixa.vendas(turnoId),
  })
}

/** Abrir o caixa: quem deu o PIN passa a ser o usuário do painel. */
export function useAbrirCaixa() {
  const segmento = useSegmento()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (dados: Parameters<ApiCaixa["abrir"]>[0]) =>
      servidorDo(segmento).caixa.abrir(dados),
    onSuccess: (turno) => {
      useUsuarioSalvo.getState().entrar(segmento, turno.abertoPor)
      return cliente.invalidateQueries({ queryKey: chavesCaixa.tudo(segmento) })
    },
  })
}

/**
 * Ação no turno em nome do usuário atual. No fim, o caixa e os pedidos conferem
 * (o resumo do turno depende dos dois).
 */
function useAcaoNoCaixa<A, R>(
  acao: (caixa: ApiCaixa, dados: A & { operadorId: string }) => Promise<R>,
) {
  const segmento = useSegmento()
  const cliente = useQueryClient()
  const { membro } = useUsuarioAtual()
  return useMutation({
    mutationFn: (dados: A) =>
      acao(servidorDo(segmento).caixa, { ...dados, operadorId: membro?.id ?? "" }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.tudo(segmento) }),
  })
}

type SemOperador<F extends (dados: never) => unknown> = Omit<Parameters<F>[0], "operadorId">

export function useMovimentarCaixa() {
  return useAcaoNoCaixa<SemOperador<ApiCaixa["movimentar"]>, unknown>((caixa, dados) =>
    caixa.movimentar(dados),
  )
}

export function useFecharCaixa() {
  return useAcaoNoCaixa<SemOperador<ApiCaixa["fechar"]>, unknown>((caixa, dados) =>
    caixa.fechar(dados),
  )
}

export function useReabrirCaixa() {
  return useAcaoNoCaixa<SemOperador<ApiCaixa["reabrir"]>, unknown>((caixa, dados) =>
    caixa.reabrir(dados),
  )
}
