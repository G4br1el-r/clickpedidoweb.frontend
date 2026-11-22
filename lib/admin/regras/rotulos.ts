import type {
  FormaPagamento,
  MotivoCancelamento,
  OrigemPedido,
  TaxasPagamento,
  TipoPedido,
} from "../dados/tipos"

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

const MOTIVOS: Record<MotivoCancelamento, string> = {
  "cliente-pediu": "Cliente pediu para cancelar",
  "sem-estoque": "Sem estoque",
  "fora-da-area": "Fora da área de entrega",
  "loja-cheia": "Loja cheia",
  "endereco-invalido": "Endereço inválido",
  "cliente-nao-veio": "Cliente não veio",
  "receita-invalida": "Receita inválida",
  fraude: "Suspeita de fraude",
  "pagamento-nao-aprovado": "Pagamento não aprovado",
  demora: "Demora",
  "loja-fechou": "Loja fechou",
  outro: "Outro",
}

/** Os motivos de cancelamento, na ordem em que a tela mostra. */
export const MOTIVOS_CANCELAMENTO = Object.keys(MOTIVOS) as MotivoCancelamento[]

const TAXAS: Record<keyof TaxasPagamento, string> = {
  pixOnline: "Pix online",
  cartaoOnline: "Cartão online",
  maquininha: "Cartão na maquininha",
}

export const rotuloCanal = (tipo: TipoPedido) => CANAIS[tipo]
export const rotuloPagamento = (forma: FormaPagamento) => PAGAMENTOS[forma]
export const rotuloOrigem = (origem: OrigemPedido) => ORIGENS[origem]
export const rotuloMotivo = (motivo: MotivoCancelamento | undefined) =>
  motivo ? MOTIVOS[motivo] : "Não informado"
export const rotuloTaxa = (forma: keyof TaxasPagamento) => TAXAS[forma]

const SELOS_DA_ORIGEM: Record<OrigemPedido, string> = {
  site: "Site",
  pdv: "PDV",
  garcom: "Garçom",
  painel: "Painel",
}

/** De onde o pedido veio, curto, no selo do cartão da fila. */
export const seloDaOrigem = (origem: OrigemPedido) => SELOS_DA_ORIGEM[origem]
