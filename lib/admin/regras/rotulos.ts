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

const ORIGENS: Record<OrigemPedido, string> = {
  site: "Site",
  pdv: "PDV do balcão",
  garcom: "Garçom",
  painel: "Painel da loja",
}

export const rotuloCanal = (tipo: TipoPedido) => CANAIS[tipo]
export const rotuloPagamento = (forma: FormaPagamento) => PAGAMENTOS[forma]
export const rotuloOrigem = (origem: OrigemPedido) => ORIGENS[origem]
