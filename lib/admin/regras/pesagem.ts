import type { ItemPedido, Pedido } from "../dados/tipos"
import { reaisEmTexto } from "./mensagens"

const reais = (valor: number) => Math.round(valor * 100) / 100

/** Itens vendidos por quilo: são os que vão para a balança. */
export const itensParaPesar = (pedido: Pedido) =>
  pedido.itens.filter((item) => item.pesoGramas !== undefined && item.precoKg !== undefined)

/** Tem item por quilo e ainda não foi pesado: não fica pronto enquanto não pesar. */
export const pesagemPendente = (pedido: Pedido) =>
  !pedido.pesagem && itensParaPesar(pedido).length > 0

/** Pago depois da pesagem: enquanto não pesa, o valor não é final e o pedido não recebe. */
export const faltaPesar = (pedido: Pedido) =>
  pedido.pagamento === "pagar-apos-pesagem" && !pedido.pesagem && itensParaPesar(pedido).length > 0

/**
 * Valores do pedido com o peso da balança (em gramas, da linha toda). A diferença de
 * cada item vem só do peso: preço do quilo × (peso real − peso pedido). Opções e o
 * resto do pedido não mudam. Pesar de novo parte sempre da estimativa original.
 */
export function calcularPesagem(pedido: Pedido, pesos: Record<string, number>) {
  if (pedido.situacaoPagamento === "pago") {
    throw new Error("Pedido já pago: a pesagem não muda o valor.")
  }
  const paraPesar = new Set(itensParaPesar(pedido).map((item) => item.id))
  const itens: ItemPedido[] = pedido.itens.map((item) => {
    if (!paraPesar.has(item.id)) return item
    const pesoReal = pesos[item.id]
    if (!(pesoReal > 0 && pesoReal <= 99_999)) throw new Error(`Informe o peso de ${item.nome}.`)
    const estimado = item.totalEstimado ?? item.total
    const pedidoGramas = (item.pesoGramas as number) * item.quantidade
    const total = reais(estimado + ((item.precoKg as number) * (pesoReal - pedidoGramas)) / 1000)
    return {
      ...item,
      pesoReal,
      totalEstimado: estimado,
      total,
      precoUnitario: reais(total / item.quantidade),
    }
  })
  const subtotal = reais(itens.reduce((soma, item) => soma + item.total, 0))
  const novoTotal = reais(subtotal - pedido.desconto + pedido.taxaEntrega)
  const totalEstimado = pedido.pesagem?.totalEstimado ?? pedido.total
  return { itens, subtotal, novoTotal, totalEstimado, diferenca: reais(novoTotal - totalEstimado) }
}

/**
 * Depois de pesar: o valor final e o link de pagamento, pelo token e não pelo número. O
 * token do pedido criado pelo servidor é um UUID aleatório (128 bits); o dos pedidos de
 * demonstração vem do sorteador do dia, para os mesmos dias gerarem os mesmos pedidos.
 */
export function mensagemLinkPagamento(
  pedido: Pedido,
  { loja, endereco }: { loja: string; endereco: string },
) {
  const nome = pedido.cliente.nome.split(" ")[0]
  return (
    `Olá, ${nome}! Seu pedido #${pedido.numero} na ${loja} foi pesado: ${reaisEmTexto(pedido.total)}.\n` +
    `Pague por aqui: ${endereco}/checkout/${pedido.token}`
  )
}
