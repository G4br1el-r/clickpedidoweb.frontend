/**
 * Turnos de caixa da demonstração: um por dia anterior a hoje que teve venda do
 * PDV, com sangrias, suprimentos e algumas faltas justificadas. Sempre iguais
 * para os mesmos pedidos.
 */

import { addMinutes, format, isBefore, startOfDay } from "date-fns"
import { conferir, resumoDoTurno } from "@/lib/admin/regras/caixa"
import { sorteadorDaSemente } from "./gerar-pedidos"
import type { MovimentoCaixa, Pedido, TurnoCaixa } from "./tipos"

const FUNDO = 100
const LIMITE_GAVETA = 500
const GERENTE = "eq-gerente"

/** Número do dia no calendário, para alternar operador e sortear eventos. */
const numeroDoDia = (dia: Date) =>
  Math.round(Date.UTC(dia.getFullYear(), dia.getMonth(), dia.getDate()) / 86_400_000)

export function gerarTurnos({ pedidos, agora }: { pedidos: Pedido[]; agora: Date }): {
  turnos: TurnoCaixa[]
  pedidos: Pedido[]
} {
  const hoje = startOfDay(agora)
  const porDia = new Map<string, Pedido[]>()
  for (const pedido of pedidos) {
    const criado = new Date(pedido.criadoEm)
    if (pedido.origem !== "pdv" || pedido.turnoId || !isBefore(criado, hoje)) continue
    const chave = format(criado, "yyyyMMdd")
    porDia.set(chave, [...(porDia.get(chave) ?? []), pedido])
  }

  const turnos: TurnoCaixa[] = []
  const doTurno = new Map<number, { turnoId: string; operadorId: string }>()
  for (const [chave, vendasDoDia] of [...porDia].sort(([a], [b]) => a.localeCompare(b))) {
    const vendas = [...vendasDoDia].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
    const primeira = new Date(vendas[0].criadoEm)
    const ultima = new Date(vendas[vendas.length - 1].criadoEm)
    const dia = numeroDoDia(primeira)
    const operador = primeira.getDate() % 2 === 0 ? "eq-marina" : "eq-joao"
    const turno: TurnoCaixa = {
      id: `turno-${chave}`,
      abertoPor: operador,
      abertoEm: addMinutes(primeira, -30).toISOString(),
      fundo: FUNDO,
      movimentos: [],
    }
    const movimento = (m: Omit<MovimentoCaixa, "id">) =>
      turno.movimentos.push({ id: `${turno.id}-m${turno.movimentos.length + 1}`, ...m })

    if (dia % 7 === 0) {
      movimento({
        tipo: "suprimento",
        valor: 50,
        motivo: "Reforço de moedas",
        feitoPor: operador,
        criadoEm: turno.abertoEm,
      })
    }

    const ate: Pedido[] = []
    for (const venda of vendas) {
      ate.push(venda)
      doTurno.set(venda.id, { turnoId: turno.id, operadorId: operador })
      const gaveta = resumoDoTurno(turno, ate.map(comTurno(turno.id))).dinheiroNaGaveta
      if (gaveta > LIMITE_GAVETA) {
        movimento({
          tipo: "sangria",
          valor: Math.floor((gaveta - FUNDO) / 10) * 10,
          motivo: "Retirada para o cofre",
          feitoPor: GERENTE,
          criadoEm: venda.criadoEm,
        })
      }
    }

    const resumo = resumoDoTurno(turno, ate.map(comTurno(turno.id)))
    const falta = dia % 6 === 0 ? sorteadorDaSemente(dia).inteiro(2, 10) : 0
    turnos.push({
      ...turno,
      fechadoPor: operador,
      fechadoEm: addMinutes(ultima, 20).toISOString(),
      conferencia: conferir(
        resumo,
        resumo.dinheiroNaGaveta - falta,
        falta ? "Troco dado a mais" : undefined,
      ),
    })
  }

  return {
    turnos,
    pedidos: pedidos.map((pedido) => {
      const turno = doTurno.get(pedido.id)
      return turno ? { ...pedido, ...turno } : pedido
    }),
  }
}

const comTurno = (turnoId: string) => (pedido: Pedido) => ({ ...pedido, turnoId })
