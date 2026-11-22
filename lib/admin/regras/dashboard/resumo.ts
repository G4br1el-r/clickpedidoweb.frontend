import { addDays, endOfDay, format, isSameDay, startOfDay } from "date-fns"
import type { FormaPagamento, Pedido, StatusPedido, TipoPedido } from "../../dados/tipos"
import { emCentavos, resumoDaConta } from "../conta"
import { diasNoPeriodo, type Periodo, periodoAnterior } from "../periodo"
import { ehValido, fatias, noPeriodo, reais, soma, ticket } from "./comum"

export type DiaDaSerie = {
  data: Date
  faturamento: number
  pedidos: number
  hoje: boolean
  pico: boolean
}
export type Fatia<T> = { pedidos: number; total: number; percentual: number } & T
export type ProdutoVendido = { nome: string; quantidade: number; total: number }

export type Resumo = {
  hoje: {
    pedidos: number
    faturamento: number
    ticket: number
    emAndamento: number
    aguardandoPagamento: number
    cancelados: number
  }
  periodo: {
    faturamento: number
    pedidos: number
    ticket: number
    cancelados: number
    mediaPorDia: number
    faturamentoAnterior: number
    /** Variação % do faturamento sobre o período anterior; `null` sem vendas antes. */
    variacao: number | null
    melhorDia: { data: Date; faturamento: number; pedidos: number } | null
  }
  serie: DiaDaSerie[]
  /** Cada parte paga na sua forma: o pedido misto conta nas duas. */
  pagamentos: Fatia<{ forma: FormaPagamento }>[]
  /** A taxa de serviço do período, à parte: é dos garçons, não da casa. */
  taxaServico: number
  canais: Fatia<{ tipo: TipoPedido }>[]
  maisVendidos: { periodo: ProdutoVendido[]; hoje: ProdutoVendido[] }
  recentes: Pedido[]
}

const EM_ANDAMENTO: readonly StatusPedido[] = [
  "recebido",
  "em-preparo",
  "pronto",
  "saiu-para-entrega",
]

const chaveDoDia = (data: Date) => format(data, "yyyy-MM-dd")

function maisVendidos(pedidos: Pedido[], limite: number): ProdutoVendido[] {
  const produtos = new Map<string, ProdutoVendido>()
  for (const item of pedidos.flatMap((pedido) => pedido.itens)) {
    const atual = produtos.get(item.nome) ?? { nome: item.nome, quantidade: 0, total: 0 }
    produtos.set(item.nome, {
      ...atual,
      quantidade: atual.quantidade + item.quantidade,
      total: reais(atual.total + item.total),
    })
  }
  return [...produtos.values()]
    .sort((a, b) => b.quantidade - a.quantidade || b.total - a.total)
    .slice(0, limite)
}

/**
 * As partes do pedido por forma: os pagamentos da conta (e o que falta, na forma do pedido) ou,
 * sem eles, o total na forma do pedido.
 */
function partes(pedido: Pedido): { forma: FormaPagamento; valor: number }[] {
  if (!pedido.pagamentos?.length) return [{ forma: pedido.pagamento, valor: pedido.total }]
  const pago = pedido.pagamentos.reduce((soma, parte) => soma + emCentavos(parte.valor), 0)
  const falta = emCentavos(pedido.total) - pago
  return [
    ...pedido.pagamentos,
    ...(falta > 0 ? [{ forma: pedido.pagamento, valor: falta / 100 }] : []),
  ]
}

/** Soma as partes por forma, do maior total para o menor (empate: mais pedidos). */
function porForma(pedidos: Pedido[]): Fatia<{ forma: FormaPagamento }>[] {
  const grupos = new Map<FormaPagamento, { centavos: number; pedidos: Set<number> }>()
  for (const pedido of pedidos) {
    for (const { forma, valor } of partes(pedido)) {
      const grupo = grupos.get(forma) ?? { centavos: 0, pedidos: new Set<number>() }
      grupo.centavos += emCentavos(valor)
      grupo.pedidos.add(pedido.id)
      grupos.set(forma, grupo)
    }
  }
  const total = [...grupos.values()].reduce((soma, grupo) => soma + grupo.centavos, 0)
  return [...grupos.entries()]
    .map(([forma, grupo]) => ({
      forma,
      pedidos: grupo.pedidos.size,
      total: grupo.centavos / 100,
      percentual: total ? (grupo.centavos / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total || b.pedidos - a.pedidos)
}

/** A conta foi paga (e a taxa entrou para o garçom) dentro do período, pelo dia do pagamento. */
function taxaPagaNoPeriodo(pedido: Pedido, { de, ate }: Periodo) {
  if (pedido.situacaoPagamento !== "pago" || !pedido.pagoEm || !ehValido(pedido)) return false
  const pago = Date.parse(pedido.pagoEm)
  return pago >= startOfDay(de).getTime() && pago <= endOfDay(ate).getTime()
}

/** Tudo o que a visão geral mostra, a partir dos pedidos do período e do anterior. */
export function resumir(pedidos: Pedido[], periodo: Periodo, agora: Date): Resumo {
  const doPeriodo = noPeriodo(pedidos, periodo)
  const validos = doPeriodo.filter(ehValido)
  const anteriores = noPeriodo(pedidos, periodoAnterior(periodo)).filter(ehValido)
  const deHoje = noPeriodo(pedidos, { de: agora, ate: agora })
  const validosHoje = deHoje.filter(ehValido)

  const faturamento = soma(validos)
  const faturamentoAnterior = soma(anteriores)

  const porDia = new Map<string, Pedido[]>()
  for (const pedido of validos) {
    const chave = chaveDoDia(new Date(pedido.criadoEm))
    porDia.set(chave, [...(porDia.get(chave) ?? []), pedido])
  }
  const dias = Array.from({ length: diasNoPeriodo(periodo) }, (_, indice) => {
    const data = addDays(startOfDay(periodo.de), indice)
    const lista = porDia.get(chaveDoDia(data)) ?? []
    return { data, faturamento: soma(lista), pedidos: lista.length }
  })
  const melhor = dias.reduce<(typeof dias)[number] | null>(
    (atual, dia) =>
      dia.faturamento > 0 &&
      (!atual ||
        dia.faturamento > atual.faturamento ||
        (dia.faturamento === atual.faturamento && dia.pedidos > atual.pedidos))
        ? dia
        : atual,
    null,
  )

  return {
    hoje: {
      pedidos: validosHoje.length,
      faturamento: soma(validosHoje),
      ticket: ticket(validosHoje),
      // Agendamento marcado para depois ainda não começou.
      emAndamento: pedidos.filter(
        (pedido) =>
          EM_ANDAMENTO.includes(pedido.status) &&
          !(pedido.agendamento && Date.parse(pedido.agendamento.inicio) > agora.getTime()),
      ).length,
      aguardandoPagamento: deHoje.filter((pedido) => pedido.status === "aguardando-pagamento")
        .length,
      cancelados: deHoje.filter((pedido) => pedido.status === "cancelado").length,
    },
    periodo: {
      faturamento,
      pedidos: validos.length,
      ticket: ticket(validos),
      cancelados: doPeriodo.filter((pedido) => pedido.status === "cancelado").length,
      mediaPorDia: validos.length / diasNoPeriodo(periodo),
      faturamentoAnterior,
      variacao:
        faturamentoAnterior > 0
          ? ((faturamento - faturamentoAnterior) / faturamentoAnterior) * 100
          : null,
      melhorDia: melhor,
    },
    serie: dias.map((dia) => ({ ...dia, hoje: isSameDay(dia.data, agora), pico: dia === melhor })),
    pagamentos: porForma(validos),
    taxaServico:
      pedidos
        .filter((pedido) => taxaPagaNoPeriodo(pedido, periodo))
        .reduce((soma, pedido) => soma + emCentavos(resumoDaConta(pedido).taxa), 0) / 100,
    canais: fatias(validos, (pedido) => pedido.tipo).map(({ valor, ...resto }) => ({
      tipo: valor,
      ...resto,
    })),
    maisVendidos: { periodo: maisVendidos(validos, 8), hoje: maisVendidos(validosHoje, 6) },
    recentes: doPeriodo
      .toSorted((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm))
      .slice(0, 10),
  }
}
