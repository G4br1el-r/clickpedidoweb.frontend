"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type DecisaoReceita =
  | { situacao: "aprovada"; em: string; retida: boolean }
  | { situacao: "recusada"; em: string; motivo: string }

type EstadoFarmacia = {
  /** Conferência do farmacêutico, por receita. Sem decisão: aguardando. */
  decisoes: Record<string, DecisaoReceita>
  aprovar: (id: string, opcoes: { retida: boolean }) => void
  recusar: (id: string, motivo: string) => void
  desfazer: (id: string) => void
}

/** O que a farmácia decidiu nas receitas da demonstração. Fica salvo neste navegador. */
export const useFarmacia = create<EstadoFarmacia>()(
  persist(
    (set) => ({
      decisoes: {},
      aprovar: (id, { retida }) =>
        set((estado) => ({
          decisoes: {
            ...estado.decisoes,
            [id]: { situacao: "aprovada", em: new Date().toISOString(), retida },
          },
        })),
      recusar: (id, motivo) =>
        set((estado) => ({
          decisoes: {
            ...estado.decisoes,
            [id]: { situacao: "recusada", em: new Date().toISOString(), motivo },
          },
        })),
      desfazer: (id) =>
        set((estado) => {
          const { [id]: _removida, ...resto } = estado.decisoes
          return { decisoes: resto }
        }),
    }),
    {
      name: "clickpedido-admin-farmacia",
      version: 1,
      partialize: ({ decisoes }) => ({ decisoes }),
    },
  ),
)
