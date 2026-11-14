"use client"

import { useEffect } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"

type EstadoGarcom = {
  /** Quem está com este aparelho: vai na comanda e aparece na cozinha. */
  nome: string
  definirNome: (nome: string) => void
}

/** Nome do garçom guardado neste aparelho, para não digitar a cada rodada. */
export const useGarcom = create<EstadoGarcom>()(
  persist(
    (set) => ({
      nome: "",
      definirNome: (nome) => set({ nome: nome.slice(0, 40) }),
    }),
    {
      name: "clickpedido-admin-garcom",
      version: 1,
      skipHydration: true,
      partialize: ({ nome }) => ({ nome }),
    },
  ),
)

export function useGarcomCarregado() {
  useEffect(() => {
    if (!useGarcom.persist.hasHydrated()) void useGarcom.persist.rehydrate()
  }, [])
}
