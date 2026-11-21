"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Meta } from "./regras/dashboard/metas"
import type { SegmentoPainelId } from "./segmentos-painel"

type EstadoMetas = {
  metas: Partial<Record<SegmentoPainelId, Meta>>
  definir: (segmento: SegmentoPainelId, meta: Meta) => void
  apagar: (segmento: SegmentoPainelId) => void
}

/** Meta do mês de cada segmento. Fica salva neste navegador. */
export const useMetas = create<EstadoMetas>()(
  persist(
    (set) => ({
      metas: {},
      definir: (segmento, meta) => set(({ metas }) => ({ metas: { ...metas, [segmento]: meta } })),
      apagar: (segmento) =>
        set(({ metas }) => {
          const { [segmento]: _apagada, ...outras } = metas
          return { metas: outras }
        }),
    }),
    {
      name: "clickpedido-admin-metas",
      version: 1,
      partialize: ({ metas }) => ({ metas }),
    },
  ),
)
