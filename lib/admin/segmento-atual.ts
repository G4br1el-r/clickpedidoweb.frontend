"use client"

import { useEffect } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { ehSegmentoPainel, type SegmentoPainelId } from "./segmentos-painel"
import { useUsuarioSalvo } from "./usuario-atual"

type EstadoSegmento = {
  segmento: SegmentoPainelId
  hidratado: boolean
  escolher: (segmento: SegmentoPainelId) => void
}

const PADRAO: SegmentoPainelId = "pizzaria"

/** Segmento que o painel está mostrando (o seletor do topo). Fica salvo neste navegador. */
export const useSegmentoAtual = create<EstadoSegmento>()(
  persist(
    (set) => ({
      segmento: PADRAO,
      hidratado: false,
      escolher: (segmento) => set({ segmento }),
    }),
    {
      name: "clickpedido-admin-segmento",
      version: 1,
      // Hidrata depois da primeira pintura, para o HTML do servidor bater com o do cliente.
      skipHydration: true,
      partialize: ({ segmento }) => ({ segmento }),
      merge: (salvo, atual) => {
        const segmento = (salvo as { segmento?: unknown } | undefined)?.segmento
        return { ...atual, segmento: ehSegmentoPainel(segmento) ? segmento : PADRAO }
      },
      onRehydrateStorage: () => () => useSegmentoAtual.setState({ hidratado: true }),
    },
  ),
)

/** Carrega o segmento e o usuário salvos uma vez, no cliente. */
export function useSegmentoCarregado() {
  useEffect(() => {
    if (!useSegmentoAtual.getState().hidratado) void useSegmentoAtual.persist.rehydrate()
    if (!useUsuarioSalvo.getState().hidratado) void useUsuarioSalvo.persist.rehydrate()
  }, [])
}
