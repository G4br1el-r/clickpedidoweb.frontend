"use client"

import { useCallback, useEffect, useState } from "react"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { textoDaAba } from "@/lib/admin/regras/aparelho"

/** Um segundo aceso, um apagado: dá para ver de canto de olho na barra de abas. */
const PISCA_MS = 1_000

/**
 * Com a aba escondida, o título pisca com a contagem do que espera a loja: pedidos esperando
 * aceite e os que chegaram enquanto ninguém olhava. Ao voltar para a aba, para e zera.
 * Devolve o que avisar quando chega pedido.
 */
export function useTituloDaAba(fila: Pedido[] | undefined, ligado: boolean) {
  const [escondida, setEscondida] = useState(false)
  const [chegaramEscondida, setChegaramEscondida] = useState<ReadonlySet<number>>(new Set())

  useEffect(() => {
    const mudou = () => {
      setEscondida(document.hidden)
      if (!document.hidden) setChegaramEscondida(new Set())
    }
    mudou()
    document.addEventListener("visibilitychange", mudou)
    return () => document.removeEventListener("visibilitychange", mudou)
  }, [])

  const esperando = (fila ?? []).filter((pedido) => pedido.esperaAceite).map((pedido) => pedido.id)
  const quantos = new Set([...esperando, ...chegaramEscondida]).size

  useEffect(() => {
    if (!ligado || !escondida || quantos === 0) return
    const original = document.title
    let aceso = true
    document.title = textoDaAba(original, quantos, aceso)
    const relogio = setInterval(() => {
      aceso = !aceso
      document.title = textoDaAba(original, quantos, aceso)
    }, PISCA_MS)
    return () => {
      clearInterval(relogio)
      document.title = original
    }
  }, [ligado, escondida, quantos])

  return useCallback((chegaram: Pedido[]) => {
    if (!document.hidden) return
    setChegaramEscondida((atuais) => new Set([...atuais, ...chegaram.map((pedido) => pedido.id)]))
  }, [])
}
