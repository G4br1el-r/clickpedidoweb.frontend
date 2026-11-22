import { isSameDay } from "date-fns"
import type { DescontoConta, FormaPagamento, PagamentoConta, Pedido } from "../dados/tipos"

/** Reais em centavos inteiros: o valor é arredondado antes (8,745 × 100 não vira 874,4999…). */
export const emCentavos = (reais: number) => Math.round(Number((reais * 100).toFixed(4)))

const emReais = (centavos: number) => centavos / 100

/** Percentual com até 2 casas, em centésimos de ponto (10% → 1000). */
const emCentesimos = (percentual: number) => Math.round(Number((percentual * 100).toFixed(4)))

/** `percentual` de `centavos`, meio para cima, só com inteiros. */
const percentualDe = (centavos: number, percentual: number) =>
  Math.floor((centavos * emCentesimos(percentual) + 5000) / 10_000)

/** A taxa de serviço sobre a base, em reais, arredondada meio para cima. */
export function taxaSobre(base: number, percentual: number): number {
  return emReais(percentualDe(emCentavos(base), percentual))
}

export type ResumoConta = {
  itens: number
  cortesias: number
  descontos: number
  baseDaTaxa: number
  taxa: number
  couvert: number
  total: number
  pago: number
  saldo: number
}

type ContaDaMesa = Pick<Pedido, "itens"> &
  Partial<Pick<Pedido, "mesa" | "taxaServico" | "couvert" | "descontoConta" | "pagamentos">>

const somaEmCentavos = (valores: number[]) =>
  valores.reduce((soma, valor) => soma + emCentavos(valor), 0)

/** O desconto da conta em centavos, sobre a base em centavos (itens − cortesias). */
function descontoEmCentavos(desconto: DescontoConta | undefined, base: number) {
  if (!desconto) return 0
  return desconto.modo === "percentual"
    ? percentualDe(base, desconto.valor)
    : emCentavos(desconto.valor)
}

/** A taxa congelada da conta sobre a base em centavos; 0 se tirada ou sem taxa. */
const taxaEmCentavos = (conta: ContaDaMesa, base: number) =>
  conta.taxaServico && !conta.taxaServico.removida
    ? percentualDe(base, conta.taxaServico.percentual)
    : 0

const temAteDuasCasas = (valor: number) => Number.isInteger(Number((valor * 100).toFixed(6)))

/**
 * O que está errado no desconto, ou `null`. `base` é o valor dos itens sem as cortesias: o
 * desconto nunca passa dele.
 */
export function erroDoDesconto(desconto: DescontoConta, base: number): string | null {
  const { modo, valor } = desconto
  if (!Number.isFinite(valor) || valor <= 0 || !temAteDuasCasas(valor)) {
    return "Informe um desconto válido."
  }
  if (modo === "percentual" && valor > 100) return "O desconto vai de 0,01% a 100%."
  if (!desconto.motivo.trim()) return "Diga o motivo do desconto."
  if (descontoEmCentavos(desconto, emCentavos(base)) > emCentavos(base)) {
    return "O desconto passa do valor dos itens."
  }
  return null
}

/**
 * A conta da mesa: itens − cortesias − descontos + taxa (sobre os itens já com desconto) +
 * couvert (por pessoa), o que já foi pago e o saldo. Comanda antiga, sem os campos, não tem
 * taxa, couvert nem pagamentos.
 */
export function resumoDaConta(conta: ContaDaMesa): ResumoConta {
  const itens = somaEmCentavos(conta.itens.map((item) => item.total))
  const cortesias = somaEmCentavos(
    conta.itens.filter((item) => item.cortesia).map((item) => item.total),
  )
  const descontos = descontoEmCentavos(conta.descontoConta, itens - cortesias)
  const base = itens - cortesias - descontos
  const taxa = taxaEmCentavos(conta, base)
  const couvert =
    conta.couvert && !conta.couvert.removido
      ? emCentavos(conta.couvert.porPessoa) * (conta.mesa?.pessoas ?? 1)
      : 0
  const total = base + taxa + couvert
  const pago = somaEmCentavos((conta.pagamentos ?? []).map((pagamento) => pagamento.valor))
  return {
    itens: emReais(itens),
    cortesias: emReais(cortesias),
    descontos: emReais(descontos),
    baseDaTaxa: emReais(base),
    taxa: emReais(taxa),
    couvert: emReais(couvert),
    total: emReais(total),
    pago: emReais(pago),
    saldo: emReais(Math.max(total - pago, 0)),
  }
}

/** O saldo que ficou logo depois do pagamento (para o comprovante de um pagamento antigo). */
export function saldoDepoisDe(conta: ContaDaMesa, pagamentoId: string): number {
  const pagamentos = conta.pagamentos ?? []
  const ate = pagamentos.findIndex((pagamento) => pagamento.id === pagamentoId)
  return resumoDaConta({ ...conta, pagamentos: pagamentos.slice(0, ate + 1) }).saldo
}

/** O pedido com `subtotal` (itens), `desconto` (o da conta) e `total` refeitos pela conta. */
export function comTotais(pedido: Pedido): Pedido {
  const { itens, descontos, total } = resumoDaConta(pedido)
  return { ...pedido, subtotal: itens, desconto: descontos, total }
}

/** O valor do pedido que é da casa: o total sem a taxa de serviço (que é do garçom, Q34). */
export function valorSemTaxa(pedido: Pedido): number {
  return emReais(emCentavos(pedido.total) - emCentavos(resumoDaConta(pedido).taxa))
}

/** Divide o valor em partes iguais, em centavos: o que sobra vai para a última parte. */
export function dividirIgualmente(valor: number, partes: number): number[] {
  const centavos = emCentavos(valor)
  const parte = Math.floor(centavos / partes)
  return Array.from({ length: partes }, (_, indice) =>
    emReais(indice === partes - 1 ? centavos - parte * (partes - 1) : parte),
  )
}
/**
 * O troco no dinheiro: o que o cliente entregou menos o que abate do saldo. A parte acima do
 * saldo não abate (vira troco também). A mesma conta na tela e no servidor.
 */
export function trocoDoPagamento({
  valor,
  saldo,
  recebido,
}: {
  valor: number
  saldo: number
  recebido: number
}): number {
  const abate = Math.min(emCentavos(valor), emCentavos(saldo))
  return emReais(Math.max(emCentavos(recebido) - abate, 0))
}

/** Os itens já cobertos por pagamentos por item. */
export function itensPagos(conta: Pick<ContaDaMesa, "pagamentos">): Set<string> {
  return new Set((conta.pagamentos ?? []).flatMap((pagamento) => pagamento.itens ?? []))
}

/** Pagamento por item: os itens marcados (a cortesia não conta) com a taxa deles. */
export function valorDosItens(conta: ContaDaMesa, itemIds: string[]): number {
  const marcados = somaEmCentavos(
    conta.itens
      .filter((item) => itemIds.includes(item.id) && !item.cortesia)
      .map((item) => item.total),
  )
  return emReais(marcados + taxaEmCentavos(conta, marcados))
}
export type PagamentoRecebido = Pick<PagamentoConta, "valor" | "em" | "cartao" | "troco"> & {
  forma: FormaPagamento
}

/**
 * Os pagamentos do pedido. O pago antes da Fase 4 (sem `pagamentos`) vale como um pagamento
 * único do total, na forma do pedido e no `pagoEm`.
 */
export function pagamentosDoPedido(pedido: Pedido): PagamentoRecebido[] {
  if (pedido.pagamentos) return pedido.pagamentos
  if (pedido.situacaoPagamento !== "pago" || !pedido.pagoEm) return []
  return [{ forma: pedido.pagamento, valor: pedido.total, em: pedido.pagoEm }]
}

/**
 * Quanto do pedido entrou no dia, sem a parte da taxa de serviço (que é do garçom):
 * pago no dia × (total − taxa) ÷ total, em centavos, uma vez por pedido.
 */
export function pagoNoDiaSemTaxa(pedido: Pedido, dia: Date): number {
  const pago = somaEmCentavos(
    pagamentosDoPedido(pedido)
      .filter((pagamento) => isSameDay(new Date(pagamento.em), dia))
      .map((pagamento) => pagamento.valor),
  )
  const total = emCentavos(pedido.total)
  if (pago === 0 || total === 0) return 0
  const taxa = emCentavos(resumoDaConta(pedido).taxa)
  return emReais(Math.round((pago * (total - taxa)) / total))
}
