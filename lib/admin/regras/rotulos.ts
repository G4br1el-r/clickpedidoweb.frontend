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
  "cliente-desistiu": "Cliente desistiu",
  "sem-estoque": "Sem estoque",
  "fora-da-area": "Fora da área de entrega",
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
