import { endOfDay, startOfDay } from "date-fns"
import type { FormaPagamento, Pedido } from "../../dados/tipos"
import { emCentavos, resumoDaConta, valorSemTaxa } from "../conta"
import type { Periodo } from "../periodo"

/** Venda que conta no faturamento: nem cancelada, nem esperando o pagamento online. */
export const ehValido = (pedido: Pedido) =>
  pedido.status !== "cancelado" && pedido.status !== "aguardando-pagamento"

export const reais = (valor: number) => Math.round(valor * 100) / 100

/** O faturamento da casa: sem a taxa de serviço das contas de mesa (é do garçom, Q34). */
export const soma = (pedidos: Pedido[]) =>
  reais(pedidos.reduce((total, pedido) => total + valorSemTaxa(pedido), 0))

export const ticket = (pedidos: Pedido[]) =>
  pedidos.length ? reais(soma(pedidos) / pedidos.length) : 0

/** Pedidos criados entre o início do primeiro dia e o fim do último. */
export function noPeriodo(pedidos: Pedido[], { de, ate }: Periodo) {
  const inicio = startOfDay(de).getTime()
  const fim = endOfDay(ate).getTime()
  return pedidos.filter((pedido) => {
    const criado = Date.parse(pedido.criadoEm)
    return criado >= inicio && criado <= fim
  })
}

/** Agrupa e ordena do maior total para o menor (empate: mais pedidos). */
export function fatias<K extends string>(pedidos: Pedido[], chave: (pedido: Pedido) => K) {
  const total = soma(pedidos)
  const grupos = new Map<K, Pedido[]>()
  for (const pedido of pedidos)
    grupos.set(chave(pedido), [...(grupos.get(chave(pedido)) ?? []), pedido])
  return [...grupos.entries()]
    .map(([valor, lista]) => ({
      valor,
      pedidos: lista.length,
      total: soma(lista),
      percentual: total ? (soma(lista) / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total || b.pedidos - a.pedidos)
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
export function porForma(
  pedidos: Pedido[],
): { forma: FormaPagamento; pedidos: number; total: number; percentual: number }[] {
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

/** A taxa de serviço das contas pagas no período, à parte: é dos garçons, não da casa (Q34). */
export const taxaDeServico = (pedidos: Pedido[], periodo: Periodo) =>
  pedidos
    .filter((pedido) => taxaPagaNoPeriodo(pedido, periodo))
    .reduce((soma, pedido) => soma + emCentavos(resumoDaConta(pedido).taxa), 0) / 100
