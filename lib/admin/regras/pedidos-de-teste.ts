/** Pedidos montados à mão, com valores conhecidos, para testar as contas e a visão geral. */
import type { FormaPagamento, ItemPedido, Pedido, StatusPedido, TipoPedido } from "../dados/tipos"

export const AGORA_DE_TESTE = new Date(2026, 10, 13, 20, 30)
export const PERIODO_DE_TESTE = { de: new Date(2026, 10, 12), ate: new Date(2026, 10, 13) }

const item = (nome: string, quantidade: number, precoUnitario: number): ItemPedido => ({
  id: nome,
  produtoId: nome,
  nome,
  quantidade,
  precoUnitario,
  opcoes: [],
  total: quantidade * precoUnitario,
})

function pedido(
  id: number,
  criadoEm: Date,
  tipo: TipoPedido,
  status: StatusPedido,
  pagamento: FormaPagamento,
  total: number,
  itens: ItemPedido[],
): Pedido {
  return {
    id,
    numero: id,
    token: `t${id}`,
    origem: "site",
    tipo,
    status,
    cliente: { nome: `Cliente ${id}`, telefone: "12991230000" },
    itens,
    subtotal: total,
    desconto: 0,
    taxaEntrega: 0,
    total,
    pagamento,
    situacaoPagamento: "pago",
    criadoEm: criadoEm.toISOString(),
    atualizadoEm: criadoEm.toISOString(),
    historico: [{ tipo: "etapa", status, em: criadoEm.toISOString() }],
    enviarParaCozinha: true,
  }
}

/** Um pedido concluído no Pix com um item, para montar casos de teste na hora. */
export function pedidoDeTeste(
  id: number,
  criadoEm: Date,
  total: number,
  mudancas: Partial<Pedido> = {},
): Pedido {
  return {
    ...pedido(id, criadoEm, "retirada", "concluido", "pix", total, [item("Coca", 1, total)]),
    ...mudancas,
  }
}

const calabresa = item("Calabresa", 1, 40)
export const PEDIDOS_DE_TESTE: Pedido[] = [
  pedido(8, new Date(2026, 10, 10, 20), "retirada", "concluido", "dinheiro", 60, [
    item("Coca", 4, 15),
  ]),
  pedido(7, new Date(2026, 10, 11, 20), "retirada", "concluido", "pix", 100, [item("Coca", 2, 50)]),
  pedido(1, new Date(2026, 10, 12, 19), "entrega", "concluido", "pix", 50, [calabresa]),
  pedido(2, new Date(2026, 10, 12, 20), "retirada", "concluido", "dinheiro", 30, [
    item("Coca", 2, 15),
  ]),
  pedido(3, new Date(2026, 10, 12, 21), "entrega", "cancelado", "pix", 40, [calabresa]),
  pedido(4, new Date(2026, 10, 13, 19), "mesa", "concluido", "dinheiro", 70, [
    calabresa,
    item("Coca", 2, 15),
  ]),
  pedido(5, new Date(2026, 10, 13, 20), "entrega", "em-preparo", "cartao-na-entrega", 20, [
    item("Guaraná", 1, 20),
  ]),
  pedido(6, new Date(2026, 10, 13, 20, 28), "entrega", "aguardando-pagamento", "pix", 45, [
    calabresa,
  ]),
]
