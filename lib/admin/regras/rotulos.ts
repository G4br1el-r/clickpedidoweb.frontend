import type {
  FormaPagamento,
  MotivoCancelamento,
  OrigemPedido,
  PagamentoConta,
  Pedido,
  TipoPedido,
} from "../dados/tipos"
import { formasDoPedido } from "./conta"

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

export const rotuloCanal = (tipo: TipoPedido) => CANAIS[tipo]
export const rotuloPagamento = (forma: FormaPagamento) => PAGAMENTOS[forma]
/** Um pagamento da conta da mesa: no cartão, diz se foi crédito ou débito. */
export function rotuloDoPagamento({
  forma,
  cartao,
}: Pick<PagamentoConta, "cartao"> & { forma: FormaPagamento }) {
  if (forma === "cartao-na-entrega" && cartao) {
    return cartao === "credito" ? "Cartão de crédito" : "Cartão de débito"
  }
  return PAGAMENTOS[forma]
}
/**
 * A forma do pedido: "Misto" quando a conta foi paga em mais de uma forma; com uma só, ela (a
 * comanda aberta que pagou parte em Pix diz Pix, e não a forma provisória do pedido).
 */
export function rotuloPagamentoDoPedido(pedido: Pick<Pedido, "pagamento" | "pagamentos">) {
  const formas = formasDoPedido(pedido)
  return formas.length > 1 ? "Misto" : PAGAMENTOS[formas[0]]
}
export const rotuloOrigem = (origem: OrigemPedido) => ORIGENS[origem]
export const rotuloMotivo = (motivo: MotivoCancelamento | undefined) =>
  motivo ? MOTIVOS[motivo] : "Não informado"
