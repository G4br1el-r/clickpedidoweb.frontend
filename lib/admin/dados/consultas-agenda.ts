"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { useSegmentoAtual } from "../segmento-atual"
import { chaves, servidorDo, usePedidos } from "./consultas"
import type { NovoAgendamento } from "./servidor"

const useSegmento = () => useSegmentoAtual((estado) => estado.segmento)

/** Todos os atendimentos do salão: a agenda filtra pelo dia do atendimento, não do pedido. */
export function useAgenda() {
  return usePedidos({}, { atualizarACada: 30_000 })
}

/** Horários livres do dia para os serviços escolhidos. */
export function useHorariosLivres(dia: Date | null, servicos: string[], ignorarId?: number) {
  const segmento = useSegmento()
  return useQuery({
    queryKey: [
      ...chaves.tudo(segmento),
      "horarios",
      dia ? format(dia, "yyyy-MM-dd") : null,
      servicos,
      ignorarId ?? null,
    ],
    queryFn: () =>
      servidorDo(segmento).agendamentos.horarios({
        dia: dia as Date,
        servicos,
        ...(ignorarId ? { ignorarId } : {}),
      }),
    enabled: dia !== null && servicos.length > 0,
  })
}

/** Agenda, fila, pedidos e horários conferem com o servidor depois de marcar ou remarcar. */
function useMudancaNaAgenda<A, R>(acao: (argumentos: A) => Promise<R>) {
  const segmento = useSegmento()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: acao,
    onSettled: () => cliente.invalidateQueries({ queryKey: chaves.tudo(segmento) }),
  })
}

export function useCriarAgendamento() {
  const segmento = useSegmento()
  return useMudancaNaAgenda((novo: NovoAgendamento) =>
    servidorDo(segmento).agendamentos.criar(novo),
  )
}

export function useRemarcar() {
  const segmento = useSegmento()
  return useMudancaNaAgenda(({ id, inicio }: { id: number; inicio: string }) =>
    servidorDo(segmento).agendamentos.remarcar(id, inicio),
  )
}
