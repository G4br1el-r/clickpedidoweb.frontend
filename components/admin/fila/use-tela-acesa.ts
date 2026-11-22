"use client"

import { useEffect } from "react"

type Trava = { release: () => Promise<void> }

/**
 * Segura a tela acesa enquanto a fila está aberta (Wake Lock). O navegador solta a trava
 * quando a aba some; ao voltar, a fila pede de novo. Sair da fila solta.
 */
export function useTelaAcesa(ligada: boolean) {
  useEffect(() => {
    if (!ligada || !("wakeLock" in navigator)) return
    let trava: Trava | null = null
    let saiu = false
    const pedir = async () => {
      try {
        const nova = (await navigator.wakeLock.request("screen")) as Trava
        if (saiu) void nova.release()
        else trava = nova
      } catch {
        // Bateria fraca ou aba escondida: o navegador recusa; tenta de novo ao voltar.
      }
    }
    const voltou = () => {
      if (!document.hidden) void pedir()
    }
    void pedir()
    document.addEventListener("visibilitychange", voltou)
    return () => {
      saiu = true
      document.removeEventListener("visibilitychange", voltou)
      void trava?.release()
    }
  }, [ligada])
}
