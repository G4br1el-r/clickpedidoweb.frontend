"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { usePreferenciasFila } from "@/lib/admin/preferencias-fila"
import {
  type AlertaDaFila,
  alertasDaFila,
  type ChaveDoAlerta,
} from "@/lib/admin/regras/alertas-fila"
import type { TemposDaLoja } from "@/lib/admin/regras/prazo"
import { tocarAviso } from "@/lib/admin/som"

/** Quando vários do mesmo alerta chegam juntos, um aviso só. */
const VARIOS: Record<ChaveDoAlerta, string> = {
  parado: "pedidos prontos parados",
  atraso: "pedidos perto de atrasar",
  pago: "pagamentos online confirmados",
  cancelou: "pedidos cancelados pelo cliente",
}

/**
 * Os alertas secundários da fila: cada um avisa uma vez por pedido, com um aviso na tela e,
 * com o alerta sonoro do aparelho ligado, o som suave dele. Cada um tem a chave no Este aparelho.
 */
export function useAlertasSecundarios({
  fila,
  criadosHoje,
  agora,
  tempos,
}: {
  fila: Pedido[] | undefined
  criadosHoje: Pedido[]
  agora: Date | null
  tempos: TemposDaLoja
}) {
  const alertas = usePreferenciasFila((estado) => estado.alertas)
  const paradoMin = usePreferenciasFila((estado) => estado.paradoMin)
  const somLigado = usePreferenciasFila((estado) => estado.somLigado)
  const desde = useRef(new Date().toISOString())
  const anteriores = useRef<Pedido[]>([])
  const avisados = useRef(new Set<string>())

  useEffect(() => {
    if (!fila || !agora) return
    const cancelados = criadosHoje.filter((pedido) => pedido.status === "cancelado")
    const agoraValem = alertasDaFila({
      todos: [...fila, ...cancelados],
      anteriores: anteriores.current,
      agora,
      tempos,
      paradoMin,
      desde: desde.current,
    })
    anteriores.current = fila
    const novos = agoraValem.filter(
      (alerta) => alertas[alerta.chave] && !avisados.current.has(alerta.id),
    )
    for (const alerta of novos) avisados.current.add(alerta.id)

    const porChave = new Map<ChaveDoAlerta, AlertaDaFila[]>()
    for (const alerta of novos)
      porChave.set(alerta.chave, [...(porChave.get(alerta.chave) ?? []), alerta])
    for (const [chave, lista] of porChave) {
      if (somLigado) tocarAviso(chave)
      toast(lista.length === 1 ? lista[0].texto : `${lista.length} ${VARIOS[chave]}`)
    }
  }, [fila, criadosHoje, agora, tempos, paradoMin, alertas, somLigado])
}
