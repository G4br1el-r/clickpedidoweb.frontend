"use client"

import { useEffect } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"

type PreferenciasMesas = {
  /** Atalhos de uma tecla (`/`, `N`, `?` e o número com Enter). Desligáveis pela WCAG 2.1.4. */
  atalhosLigados: boolean
  ligarAtalhos: (ligados: boolean) => void
}

/** Preferências da tela de mesas neste aparelho. */
export const usePreferenciasMesas = create<PreferenciasMesas>()(
  persist(
    (set) => ({
      atalhosLigados: true,
      ligarAtalhos: (atalhosLigados) => set({ atalhosLigados }),
    }),
    {
      name: "clickpedido-admin-mesas",
      version: 1,
      skipHydration: true,
      partialize: ({ atalhosLigados }) => ({ atalhosLigados }),
    },
  ),
)

export function usePreferenciasMesasCarregadas() {
  useEffect(() => {
    if (!usePreferenciasMesas.persist.hasHydrated()) void usePreferenciasMesas.persist.rehydrate()
  }, [])
}
