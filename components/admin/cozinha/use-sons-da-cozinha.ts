"use client"

import { useEffect, useRef } from "react"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { usePreferenciasFila, useSomDoAparelho } from "@/lib/admin/preferencias-fila"
import { atrasadosNaCozinha, type ConfigCozinha, chavesDaCozinha } from "@/lib/admin/regras/cozinha"
import { tocarAlerta, tocarSom } from "@/lib/admin/som"

/** O alerta de novo repete a cada tantos tiques (30 s, com o tique de 5 s). */
const TIQUES_PARA_REPETIR = 6

const ehAviso = (chave: string) => chave.startsWith("aviso:")
const temNova = (agora: Set<string>, antes: Set<string>, aceita: (chave: string) => boolean) =>
  [...agora].some((chave) => aceita(chave) && !antes.has(chave))

/**
 * Os sons da cozinha, cada evento com a sua chave nos Ajustes:
 * - pedido ou rodada nova (e o agendado que chegou a hora de começar) toca o alerta;
 * - cancelado ou alterado toca o alarme e repete a cada tique até o Ciente;
 * - a rodada que passou do atraso toca um toque curto, uma vez;
 * - se pedido, o alerta de novo repete enquanto houver ticket em A fazer.
 *
 * Confere quando os pedidos mudam e a cada tique, porque o tempo também traz novidade.
 * Na primeira leitura não há "novo": é o que já estava na tela.
 */
export function useSonsDaCozinha(
  pedidos: Pedido[] | undefined,
  tempos: ConfigCozinha,
  tique = 5_000,
) {
  const somLigado = usePreferenciasFila((estado) => estado.somLigado)
  const sons = usePreferenciasFila((estado) => estado.sons)
  const tipoSom = useSomDoAparelho()
  const atuais = useRef({ pedidos, tempos, sons, somLigado, tipoSom })
  atuais.current = { pedidos, tempos, sons, somLigado, tipoSom }
  const vistos = useRef<{ chaves: Set<string>; atrasados: Set<string> } | null>(null)
  const tiques = useRef(0)

  const conferir = useRef((noTique: boolean) => {
    const { pedidos, tempos, sons, somLigado, tipoSom } = atuais.current
    if (!pedidos) return
    const agora = new Date()
    const chaves = chavesDaCozinha(pedidos, agora, tempos)
    const atrasados = atrasadosNaCozinha(pedidos, agora, tempos)
    const antes = vistos.current
    vistos.current = { chaves, atrasados }
    if (!antes || !somLigado) return

    const novo = temNova(chaves, antes.chaves, (chave) => !ehAviso(chave))
    const aviso = temNova(chaves, antes.chaves, ehAviso)
    if (sons.novo && novo) tocarAlerta(tipoSom)
    if (sons.cancelado && aviso) tocarSom("cancelado")
    if (sons.atrasado && temNova(atrasados, antes.atrasados, () => true)) tocarSom("atrasado")
    if (!noTique) return
    // O que insiste: o alarme até o Ciente e, se pedido, o alerta de novo.
    if (sons.cancelado && !aviso && [...chaves].some(ehAviso)) tocarSom("cancelado")
    tiques.current += 1
    const repetir = sons.repetirNovo && tiques.current % TIQUES_PARA_REPETIR === 0
    if (repetir && !novo && [...chaves].some((chave) => !ehAviso(chave))) tocarAlerta(tipoSom)
  })

  // Chegou leitura nova do servidor.
  useEffect(() => {
    if (pedidos) conferir.current(false)
  }, [pedidos])

  useEffect(() => {
    const relogio = setInterval(() => conferir.current(true), tique)
    return () => clearInterval(relogio)
  }, [tique])
}
