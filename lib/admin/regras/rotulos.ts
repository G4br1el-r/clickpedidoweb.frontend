import type { FormaPagamento, OrigemPedido, TipoPedido } from "../dados/tipos"

const CANAIS: Record<TipoPedido, string> = {
  entrega: "Entrega",
  retirada: "Retirada no balcão",
  mesa: "Mesa no salão",
  atendimento: "Atendimento no salão",
}

const PAGAMENTOS: Record<FormaPagamento, string> = {
  pix: "Pix",
  "cartao-online": "Cartão online",
  dinheiro: "Dinheiro",
  "cartao-na-entrega": "Cartão na maquininha",
  "pagar-apos-pesagem": "Após a pesagem",
}

export const rotuloCanal = (tipo: TipoPedido) => CANAIS[tipo]
export const rotuloPagamento = (forma: FormaPagamento) => PAGAMENTOS[forma]

const ORIGENS: Record<OrigemPedido, string> = {
  site: "Site",
  pdv: "PDV",
  garcom: "Garçom",
  painel: "Painel",
}

/** De onde o pedido veio, no selo do cartão da fila. */
export const rotuloOrigem = (origem: OrigemPedido) => ORIGENS[origem]
