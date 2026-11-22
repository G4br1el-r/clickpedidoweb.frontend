"use client"

import { useEffect } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useLoja } from "./dados/consultas"
import type { SomAlerta } from "./dados/tipos"
import type { ChaveDoAlerta } from "./regras/alertas-fila"
import type { OndeImprime } from "./regras/impressora"

/** Avisos que se ligam e desligam no menu "Este aparelho". */
export type ChaveDoAparelho = "notificar" | "piscarAba" | "vibrar" | "telaAcesa" | "compacto"

type Preferencias = {
  somLigado: boolean
  /** `null`: segue o som padrão da loja, escolhido nas configurações. */
  tipoSom: SomAlerta | null
  /** Demonstração: chega um pedido novo a cada minuto, mais ou menos. */
  simular: boolean
  /** Notificação do sistema quando chega pedido com a aba escondida. */
  notificar: boolean
  /** O título da aba pisca com a contagem de pedidos esperando. */
  piscarAba: boolean
  /** O celular vibra quando chega pedido. */
  vibrar: boolean
  /** A tela não apaga enquanto a fila está aberta. */
  telaAcesa: boolean
  /** Cada pedido numa linha, que abre ao tocar. */
  compacto: boolean
  /** Alertas secundários, cada um com a sua chave. */
  alertas: Record<ChaveDoAlerta, boolean>
  /** Pronto parado há mais destes minutos avisa. */
  paradoMin: number
  /** Onde este aparelho imprime. */
  impressora: OndeImprime
  /** Agente de impressão ligado (simulado até o back-end). */
  agenteLigado: boolean
  escolherImpressora: (onde: OndeImprime) => void
  ligarAgente: (ligado: boolean) => void
  ligarAlerta: (chave: ChaveDoAlerta, ligado: boolean) => void
  definirParadoMin: (minutos: number) => void
  ligarSom: (ligado: boolean) => void
  escolherSom: (tipo: SomAlerta | null) => void
  ligarSimulacao: (ligada: boolean) => void
  ligar: (chave: ChaveDoAparelho, ligada: boolean) => void
}

/** Preferências da fila neste aparelho: cada caixa ou cozinha escolhe o seu som e avisos. */
export const usePreferenciasFila = create<Preferencias>()(
  persist(
    (set) => ({
      somLigado: false,
      tipoSom: null,
      simular: true,
      notificar: false,
      piscarAba: true,
      vibrar: false,
      telaAcesa: false,
      compacto: false,
      alertas: { parado: true, atraso: true, pago: true, cancelou: true, cozinha: true },
      paradoMin: 10,
      impressora: "navegador",
      agenteLigado: true,
      escolherImpressora: (impressora) => set({ impressora }),
      ligarAgente: (agenteLigado) => set({ agenteLigado }),
      ligarAlerta: (chave, ligado) =>
        set((estado) => ({ alertas: { ...estado.alertas, [chave]: ligado } })),
      definirParadoMin: (paradoMin) => set({ paradoMin }),
      ligarSom: (somLigado) => set({ somLigado }),
      escolherSom: (tipoSom) => set({ tipoSom }),
      ligarSimulacao: (simular) => set({ simular }),
      ligar: (chave, ligada) => set({ [chave]: ligada }),
    }),
    {
      name: "clickpedido-admin-fila",
      version: 1,
      skipHydration: true,
      // Os alertas salvos misturam com os de fábrica: alerta novo vem ligado.
      merge: (salvo, atual) => {
        const guardado = (salvo ?? {}) as Partial<Preferencias>
        return { ...atual, ...guardado, alertas: { ...atual.alertas, ...guardado.alertas } }
      },
      partialize: ({
        somLigado,
        tipoSom,
        simular,
        notificar,
        piscarAba,
        vibrar,
        telaAcesa,
        compacto,
        alertas,
        paradoMin,
        impressora,
        agenteLigado,
      }) => ({
        somLigado,
        tipoSom,
        simular,
        notificar,
        piscarAba,
        vibrar,
        telaAcesa,
        compacto,
        alertas,
        paradoMin,
        impressora,
        agenteLigado,
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
