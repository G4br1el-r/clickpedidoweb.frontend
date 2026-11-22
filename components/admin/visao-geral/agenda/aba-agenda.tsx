"use client"

import { useMemo } from "react"
import type { HorarioFuncionamento, Pedido } from "@/lib/admin/dados/tipos"
import {
  cancelamentosDaAgenda,
  ocupacaoDaAgenda,
  servicosMaisAgendados,
  vagosHojeEAmanha,
} from "@/lib/admin/regras/dashboard/salao"
import type { Periodo } from "@/lib/admin/regras/periodo"
import { emReais, plural } from "@/lib/formato"
import { Indicador, Regua } from "../../regua"
import { inteiro, Numero } from "../numero"
import { ListaDeFatias, Secao } from "../partes"

const porcento = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })
const horas = (minutos: number) => `${inteiro.format(minutos / 60)} h`

/** Agenda do salão: quanto da capacidade foi usada, o que sobra e o que mais se marca. */
export function AbaAgenda({
  pedidos,
  periodo,
  agora,
  horarios,
  capacidade,
}: {
  /** Todos os atendimentos: os vagos de amanhã dependem do que já está marcado. */
  pedidos: Pedido[]
  periodo: Periodo
  agora: Date
  horarios: HorarioFuncionamento[]
  /** Quantos atendimentos cabem ao mesmo tempo. */
  capacidade: number
}) {
  const ocupacao = useMemo(
    () => ocupacaoDaAgenda(pedidos, { horarios, capacidade, periodo }),
    [pedidos, horarios, capacidade, periodo],
  )
  const vagos = useMemo(
    () => vagosHojeEAmanha(pedidos, { horarios, capacidade, agora }),
    [pedidos, horarios, capacidade, agora],
  )
  const perdas = useMemo(() => cancelamentosDaAgenda(pedidos, periodo), [pedidos, periodo])
  const servicos = useMemo(() => servicosMaisAgendados(pedidos, periodo), [pedidos, periodo])
  const vezes = servicos.reduce((soma, servico) => soma + servico.vezes, 0)

  return (
    <div className="flex flex-col gap-10">
      <Secao titulo="Agenda do período" descricao="Pelo dia do atendimento">
        <Regua>
          <Indicador
            rotulo="Ocupação"
            detalhe={`${horas(ocupacao.marcados)} marcadas de ${horas(ocupacao.disponiveis)}`}
          >
            {`${porcento.format(ocupacao.percentual)}%`}
          </Indicador>
          <Indicador rotulo="Vagos hoje" detalhe="horários de 30 min">
            <Numero valor={vagos.hoje} />
          </Indicador>
          <Indicador rotulo="Vagos amanhã" detalhe="horários de 30 min">
            <Numero valor={vagos.amanha} />
          </Indicador>
          <Indicador
            rotulo="Cancelados"
            detalhe={`${perdas.cancelados} de ${perdas.marcados} · ${emReais(perdas.perdido)}`}
          >
            {`${porcento.format(perdas.taxa)}%`}
          </Indicador>
        </Regua>
      </Secao>

      <Secao titulo="Serviços mais agendados" descricao="Sem os cancelados">
        <ListaDeFatias
          vazio="Nenhum atendimento marcado no período."
          itens={servicos.slice(0, 10).map((servico) => ({
            chave: servico.nome,
            nome: servico.nome,
            pedidos: servico.vezes,
            total: servico.total,
            percentual: vezes ? (servico.vezes / vezes) * 100 : 0,
            detalhe: plural(servico.vezes, "vez", "vezes"),
          }))}
        />
      </Secao>
    </div>
  )
}
