"use client"

import { useEffect, useRef } from "react"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { usePreferenciasFila, useSomDoAparelho } from "@/lib/admin/preferencias-fila"
import { chavesDeQuemServe, type QuemServe } from "@/lib/admin/regras/cozinha"
import { tocarAlerta } from "@/lib/admin/som"

/**
 * Toca o alerta quando fica pronto o que este lado leva adiante, ou quando a cozinha
 * manda uma mensagem. Na primeira leitura não há novidade: é o que já estava na tela.
 */
export function useAlertaDeQuemServe(pedidos: Pedido[] | undefined, quem: QuemServe) {
  const conhecidas = useRef<Set<string> | null>(null)
  const somLigado = usePreferenciasFila((estado) => estado.somLigado)
  const tipoSom = useSomDoAparelho()

  useEffect(() => {
    if (!pedidos) return
    const chaves = chavesDeQuemServe(pedidos, quem)
    const anteriores = conhecidas.current
    if (anteriores && somLigado && [...chaves].some((chave) => !anteriores.has(chave))) {
      tocarAlerta(tipoSom)
    }
    conhecidas.current = chaves
  }, [pedidos, quem, somLigado, tipoSom])
}
