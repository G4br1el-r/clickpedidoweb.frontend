import type { Pedido, Praca, Produto } from "../dados/tipos"
import { atrasadosNaCozinha, type ConfigCozinha, TEMPOS_PADRAO } from "./cozinha"
import { historicoDoDia, historicoDoPeriodo, type LinhaDoHistorico } from "./historico"
import { pracaDoItem } from "./pracas"

/** A faixa do turno, no topo do Quadro: como a cozinha está indo hoje. */
export type ResumoDoTurno = {
  /** Média, em minutos, da chegada ao pronto dos tickets que ficaram prontos hoje. */
  tempoMedioMin: number | null
  prontos: number
  atrasadosAgora: number
  maisPedido: { nome: string; quantidade: number } | null
}

const media = (valores: number[]) =>
  valores.length > 0
    ? Math.round(valores.reduce((soma, valor) => soma + valor, 0) / valores.length)
    : null

/** O que conta como trabalho da cozinha: sem cancelados e sem os refazer (são retrabalho). */
const contaComoTrabalho = (linha: LinhaDoHistorico) =>
  linha.fim !== "cancelado" && !linha.ticket.refazer

/** Os números do turno de hoje. */
export function resumoDoTurno(
  pedidos: Pedido[],
  agora: Date,
  tempos: ConfigCozinha = TEMPOS_PADRAO,
): ResumoDoTurno {
  const linhas = historicoDoDia(pedidos, agora, { agora, tempos }).filter(contaComoTrabalho)
  const prontos = linhas.flatMap((linha) =>
    linha.minutosAtePronto === null ? [] : [linha.minutosAtePronto],
  )
  const porItem = new Map<string, number>()
  for (const { ticket } of linhas) {
    for (const item of ticket.itens) {
      porItem.set(item.nome, (porItem.get(item.nome) ?? 0) + item.quantidade)
    }
  }
  const [maisPedido] = [...porItem]
    .map(([nome, quantidade]) => ({ nome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"))
  return {
    tempoMedioMin: media(prontos),
    prontos: prontos.length,
    atrasadosAgora: atrasadosNaCozinha(pedidos, agora, tempos).size,
    maisPedido: maisPedido ?? null,
  }
}

export type Periodo = { de: Date; ate: Date }
type Opcoes = { agora: Date; tempos?: ConfigCozinha }

/** As linhas do Histórico de cada dia do período. */
const linhasDoPeriodo = (pedidos: Pedido[], periodo: Periodo, { agora, tempos }: Opcoes) =>
  historicoDoPeriodo(pedidos, periodo, { agora, tempos })

const porcento = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0)

/** Os números principais do período, como a régua da aba Desempenho mostra. */
export function numerosDoPeriodo(pedidos: Pedido[], periodo: Periodo, opcoes: Opcoes) {
  const linhas = linhasDoPeriodo(pedidos, periodo, opcoes)
  const trabalho = linhas.filter(contaComoTrabalho)
  const prontos = trabalho.filter((linha) => linha.minutosAtePronto !== null)
  const refeitos = linhas.filter((linha) => linha.ticket.refazer).length
  return {
    tickets: trabalho.length,
    tempoMedioMin: media(prontos.map((linha) => linha.minutosAtePronto as number)),
    noPrazoPct: porcento(prontos.filter((linha) => !linha.atrasado).length, prontos.length),
    refeitos,
    retrabalhoPct: porcento(refeitos, trabalho.length),
    canceladosDepoisDeIniciar: linhas.filter(
      (linha) => linha.fim === "cancelado" && linha.ticket.itens.some((item) => item.iniciadoEm),
    ).length,
  }
}

/** Tickets e tempo médio até pronto por hora da chegada (só as horas com movimento). */
export function porHora(pedidos: Pedido[], periodo: Periodo, opcoes: Opcoes) {
  const grupos = new Map<number, LinhaDoHistorico[]>()
  for (const linha of linhasDoPeriodo(pedidos, periodo, opcoes).filter(contaComoTrabalho)) {
    const hora = new Date(linha.ticket.chegouEm).getHours()
    grupos.set(hora, [...(grupos.get(hora) ?? []), linha])
  }
  return [...grupos]
    .sort(([a], [b]) => a - b)
    .map(([hora, linhas]) => ({
      hora,
      tickets: linhas.length,
      tempoMedioMin: media(
        linhas.flatMap((linha) =>
          linha.minutosAtePronto === null ? [] : [linha.minutosAtePronto],
        ),
      ),
    }))
}

const minutosEntre = (de: string, ate: string) =>
  Math.round((Date.parse(ate) - Date.parse(de)) / 60_000)

const TIPOS = ["mesa", "entrega", "retirada"] as const

/** Tempo médio e tickets por tipo de pedido (mesa, entrega, retirada), só os que tiveram. */
export function porTipo(pedidos: Pedido[], periodo: Periodo, opcoes: Opcoes) {
  const linhas = linhasDoPeriodo(pedidos, periodo, opcoes).filter(contaComoTrabalho)
  return TIPOS.flatMap((tipo) => {
    const doTipo = linhas.filter((linha) => linha.ticket.pedido.tipo === tipo)
    if (doTipo.length === 0) return []
    return [
      {
        tipo,
        tickets: doTipo.length,
        tempoMedioMin: media(
          doTipo.flatMap((linha) =>
            linha.minutosAtePronto === null ? [] : [linha.minutosAtePronto],
          ),
        ),
      },
    ]
  })
}

/**
 * Tempo de cada praça: da chegada ao último item dela riscado, nos tickets em que ela
 * terminou a parte dela. A praça sem tickets no período não aparece.
 */
export function porPraca(
  pedidos: Pedido[],
  periodo: Periodo,
  opcoes: Opcoes & { produtos: Produto[]; pracas: Praca[] },
) {
  const linhas = linhasDoPeriodo(pedidos, periodo, opcoes).filter(contaComoTrabalho)
  return opcoes.pracas.flatMap((praca) => {
    const tempos = linhas.flatMap(({ ticket }) => {
      const dela = ticket.itens.filter(
        (item) => pracaDoItem(item, opcoes.produtos, opcoes.pracas) === praca.id,
      )
      if (dela.length === 0 || !dela.every((item) => item.feitoEm)) return []
      const ultimo = dela
        .map((item) => item.feitoEm as string)
        .sort()
        .at(-1) as string
      return [minutosEntre(ticket.chegouEm, ultimo)]
    })
    if (tempos.length === 0) return []
    return [
      { id: praca.id, nome: praca.nome, tickets: tempos.length, tempoMedioMin: media(tempos) },
    ]
  })
}

/** Os produtos que mais demoram: média da chegada até o item riscado, os cinco primeiros. */
export function produtosDemorados(pedidos: Pedido[], periodo: Periodo, opcoes: Opcoes) {
  const grupos = new Map<string, { produtoId: string | null; nome: string; tempos: number[] }>()
  for (const { ticket } of linhasDoPeriodo(pedidos, periodo, opcoes).filter(contaComoTrabalho)) {
    for (const item of ticket.itens) {
      if (!item.feitoEm) continue
      const chave = item.produtoId ?? item.nome
      const grupo = grupos.get(chave) ?? { produtoId: item.produtoId, nome: item.nome, tempos: [] }
      grupo.tempos.push(minutosEntre(ticket.chegouEm, item.feitoEm))
      grupos.set(chave, grupo)
    }
  }
  return [...grupos.values()]
    .map(({ produtoId, nome, tempos }) => ({
      produtoId,
      nome,
      vezes: tempos.length,
      tempoMedioMin: media(tempos) as number,
    }))
    .sort((a, b) => b.tempoMedioMin - a.tempoMedioMin || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, 5)
}
