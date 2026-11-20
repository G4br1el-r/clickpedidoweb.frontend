"use client"

import { useEffect } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useLoja } from "./dados/consultas"
import type { SomAlerta } from "./dados/tipos"

/** Os eventos da cozinha que tocam som, cada um com a sua chave. */
export type EventoDeSom = "novo" | "cancelado" | "atrasado" | "repetirNovo"

type Preferencias = {
  somLigado: boolean
  /** Cozinha: que eventos tocam, com o "Alerta sonoro" ligado. */
  sons: Record<EventoDeSom, boolean>
  /** Cozinha: a praça deste aparelho, ou "todas" (a expedição). */
  praca: string
  /** Cozinha: este aparelho imprime as vias da cozinha. */
  imprimirVias: boolean
  /** `null`: segue o som padrão da loja, escolhido nas configurações. */
  tipoSom: SomAlerta | null
  /** Demonstração: chega um pedido novo a cada minuto, mais ou menos. */
  simular: boolean
  ligarSom: (ligado: boolean) => void
  escolherSom: (tipo: SomAlerta | null) => void
  ligarSimulacao: (ligada: boolean) => void
  ligarSomDoEvento: (evento: EventoDeSom, ligado: boolean) => void
  escolherPraca: (praca: string) => void
  ligarVias: (ligadas: boolean) => void
}

/** Preferências da fila neste aparelho: cada caixa ou cozinha escolhe o seu som. */
export const usePreferenciasFila = create<Preferencias>()(
  persist(
    (set) => ({
      somLigado: false,
      tipoSom: null,
      simular: true,
      sons: { novo: true, cancelado: true, atrasado: true, repetirNovo: false },
      praca: "todas",
      imprimirVias: false,
      ligarSom: (somLigado) => set({ somLigado }),
      escolherSom: (tipoSom) => set({ tipoSom }),
      ligarSimulacao: (simular) => set({ simular }),
      ligarSomDoEvento: (evento, ligado) =>
        set((estado) => ({ sons: { ...estado.sons, [evento]: ligado } })),
      escolherPraca: (praca) => set({ praca }),
      ligarVias: (imprimirVias) => set({ imprimirVias }),
    }),
    {
      name: "clickpedido-admin-fila",
      version: 1,
      skipHydration: true,
      partialize: ({ somLigado, tipoSom, simular, sons, praca, imprimirVias }) => ({
        somLigado,
        tipoSom,
        simular,
        sons,
        praca,
        imprimirVias,
      }),
    },
  ),
)

export function usePreferenciasCarregadas() {
  useEffect(() => {
    if (!usePreferenciasFila.persist.hasHydrated()) void usePreferenciasFila.persist.rehydrate()
  }, [])
}

/** O som deste aparelho: o que ele escolheu ou, sem escolha, o padrão da loja. */
export function useSomDoAparelho(): SomAlerta {
  const escolhido = usePreferenciasFila((estado) => estado.tipoSom)
  const { data: loja } = useLoja()
  return escolhido ?? loja?.som ?? "alto"
}
