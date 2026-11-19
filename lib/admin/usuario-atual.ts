"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { ehSegmentoPainel, type SegmentoPainelId } from "./segmentos-painel"

type EstadoUsuario = {
  /** Quem entrou em cada segmento (id da equipe). Sem nada, vale o primeiro Dono ativo. */
  porSegmento: Partial<Record<SegmentoPainelId, string>>
  entrar: (segmento: SegmentoPainelId, id: string) => void
  sair: (segmento: SegmentoPainelId) => void
}

/** Só os pares segmento → id que fazem sentido. */
function limpar(salvo: unknown): Partial<Record<SegmentoPainelId, string>> {
  if (!salvo || typeof salvo !== "object") return {}
  return Object.fromEntries(
    Object.entries(salvo).filter(
      ([segmento, id]) => ehSegmentoPainel(segmento) && typeof id === "string",
    ),
  )
}

/** Quem está usando o painel, por segmento. Fica salvo neste navegador. */
export const useUsuarioSalvo = create<EstadoUsuario>()(
  persist(
    (set) => ({
      porSegmento: {},
      entrar: (segmento, id) =>
        set((estado) => ({ porSegmento: { ...estado.porSegmento, [segmento]: id } })),
      sair: (segmento) =>
        set((estado) => {
          const { [segmento]: _saiu, ...resto } = estado.porSegmento
          return { porSegmento: resto }
        }),
    }),
    {
      name: "clickpedido-admin-usuario",
      version: 1,
      // Hidrata depois da primeira pintura, junto com o segmento.
      skipHydration: true,
      partialize: ({ porSegmento }) => ({ porSegmento }),
      merge: (salvo, atual) => ({
        ...atual,
        porSegmento: limpar((salvo as { porSegmento?: unknown } | undefined)?.porSegmento),
      }),
    },
  ),
)
