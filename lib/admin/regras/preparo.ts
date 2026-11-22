import type { ItemPedido, Produto } from "../dados/tipos"
import type { ConfigCozinha, TicketCozinha } from "./cozinha"

const preparoDo = (item: ItemPedido, produtos: Produto[]) =>
  produtos.find((produto) => produto.id === item.produtoId)?.preparoMin

/**
 * Quando começar cada item para tudo ficar pronto junto: quantos minutos ele espera, a
 * diferença para o mais demorado. Item sem tempo cadastrado começa já. Sem nenhum tempo
 * cadastrado no ticket, não há disparo (`null`).
 */
export function disparoDosItens(
  itens: ItemPedido[],
  produtos: Produto[],
): Record<string, number> | null {
  const tempos = itens.map((item) => preparoDo(item, produtos))
  if (tempos.every((tempo) => tempo === undefined)) return null
  const maior = Math.max(...tempos.map((tempo) => tempo ?? 0))
  return Object.fromEntries(
    itens.map((item, indice) => {
      const tempo = tempos[indice]
      return [item.id, tempo === undefined ? 0 : maior - tempo]
    }),
  )
}

/**
 * Os tempos de alerta do ticket: com tempo de preparo cadastrado, a atenção só começa no
 * maior tempo de preparo e o atraso vem depois, com a mesma folga da loja (atraso −
 * atenção). Preparo menor que os tempos da loja não os adianta.
 */
export function temposDoTicket(
  ticket: TicketCozinha,
  produtos: Produto[],
  tempos: ConfigCozinha,
): ConfigCozinha {
  const maior = Math.max(0, ...ticket.itens.map((item) => preparoDo(item, produtos) ?? 0))
  if (maior <= tempos.atencaoMin) return tempos
  return {
    ...tempos,
    atencaoMin: maior,
    atrasoMin: Math.max(tempos.atrasoMin, maior + (tempos.atrasoMin - tempos.atencaoMin)),
  }
}
