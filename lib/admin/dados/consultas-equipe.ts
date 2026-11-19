"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { membroPadrao } from "../regras/equipe"
import { useSegmentoAtual } from "../segmento-atual"
import type { SegmentoPainelId } from "../segmentos-painel"
import { useUsuarioSalvo } from "../usuario-atual"
import { servidorDo } from "./consultas"
import type { MembroEquipe } from "./tipos"

const useSegmento = () => useSegmentoAtual((estado) => estado.segmento)

export const chaveEquipe = (segmento: SegmentoPainelId) => ["admin", segmento, "equipe"] as const

export function useEquipe() {
  const segmento = useSegmento()
  return useQuery({
    queryKey: chaveEquipe(segmento),
    queryFn: () => servidorDo(segmento).equipe.listar(),
  })
}

/** Cria ou edita uma pessoa; a lista e o usuário atual conferem depois. */
export function useSalvarMembro() {
  const segmento = useSegmento()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (dados: Omit<MembroEquipe, "id"> & { id?: string }) =>
      servidorDo(segmento).equipe.salvar(dados),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaveEquipe(segmento) }),
  })
}

/** Confere o PIN no servidor e passa a usar o painel como essa pessoa. */
export function useEntrar() {
  const segmento = useSegmento()
  return useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) =>
      servidorDo(segmento).equipe.entrar(id, pin),
    onSuccess: (membro) => useUsuarioSalvo.getState().entrar(segmento, membro.id),
  })
}

/** Quem está usando o painel: o salvo, se continua ativo; senão, o primeiro Dono ativo. */
export function useUsuarioAtual(): { membro: MembroEquipe | undefined; carregando: boolean } {
  const segmento = useSegmento()
  const salvo = useUsuarioSalvo((estado) => estado.porSegmento[segmento])
  const { data: equipe, isPending } = useEquipe()
  if (!equipe) return { membro: undefined, carregando: isPending }
  const escolhido = equipe.find((membro) => membro.id === salvo && membro.ativo)
  return { membro: escolhido ?? membroPadrao(equipe), carregando: false }
}
