import type { CorDePraca, ItemPedido, Pedido, Praca, Produto } from "../dados/tipos"
import {
  type ConfigCozinha,
  colunasDaCozinha,
  type StatusTicket,
  type TicketCozinha,
} from "./cozinha"

/** A praça do que não tem praça: item avulso e categoria sem praça. */
export const GERAL = "geral"

/**
 * De que praça é o item, pelo cardápio de agora: a do produto, senão a da categoria
 * dele, senão Geral. Praça que não existe mais não vale.
 */
export function pracaDoItem(item: ItemPedido, produtos: Produto[], pracas: Praca[]): string {
  const produto = produtos.find((outro) => outro.id === item.produtoId)
  if (!produto) return GERAL
  if (produto.pracaId && pracas.some((praca) => praca.id === produto.pracaId)) {
    return produto.pracaId
  }
  return pracas.find((praca) => praca.categoriaIds.includes(produto.categoriaId))?.id ?? GERAL
}

/** A praça que a tela mostra e o cardápio para saber de que praça é cada item. */
export type VisaoDePraca = { pracaId: string; produtos: Produto[]; pracas: Praca[] }

/** Outra praça do mesmo ticket, com quantos itens ela ainda não riscou. */
export type OutraPraca = { id: string; nome: string; cor: CorDePraca; faltam: number }

export const PRACA_GERAL = { id: GERAL, nome: "Geral", cor: "cinza" } as const

/** O estado dos itens: nenhum iniciado, algum iniciado, todos riscados. */
function statusDosItens(itens: ItemPedido[]): StatusTicket {
  if (itens.every((item) => item.feitoEm)) return "pronto"
  return itens.some((item) => item.iniciadoEm) ? "em-preparo" : "recebido"
}

/**
 * O ticket como a praça o vê: só os itens dela, no estado deles, e o que falta nas
 * outras. Sem itens da praça, o ticket não é dela (`null`). O ticket sem itens (só o
 * aviso de uma rodada esvaziada) aparece em todas.
 */
export function ticketNaPraca(
  ticket: TicketCozinha,
  visao: VisaoDePraca,
): (TicketCozinha & { outras: OutraPraca[] }) | null {
  if (ticket.itens.length === 0) return { ...ticket, outras: [] }
  const daPraca = (item: ItemPedido) => pracaDoItem(item, visao.produtos, visao.pracas)
  const daqui = ticket.itens.filter((item) => daPraca(item) === visao.pracaId)
  if (daqui.length === 0) return null
  const outras = [...visao.pracas, PRACA_GERAL]
    .filter((praca) => praca.id !== visao.pracaId)
    .map(({ id, nome, cor }) => ({
      id,
      nome,
      cor,
      faltam: ticket.itens.filter((item) => !item.feitoEm && daPraca(item) === id).length,
    }))
    .filter((outra) => outra.faltam > 0)
  return { ...ticket, itens: daqui, status: statusDosItens(daqui), outras }
}

/** A rodada na chave da via: "2", ou "2:r1" no refazer (que tem via própria). */
const rodadaDaVia = (ticket: TicketCozinha) =>
  ticket.refazer ? `${ticket.rodada}:r${ticket.refazer.numero}` : `${ticket.rodada}`

/** Uma via da cozinha a imprimir: a rodada de um pedido, numa praça. */
export type ViaDaCozinha = {
  /** "pedido:rodada:praça". */
  chave: string
  ticket: TicketCozinha
  praca: { id: string; nome: string }
  itens: ItemPedido[]
}

/**
 * As vias que este aparelho imprime agora: a rodada que chegou em A fazer, na praça do
 * aparelho (em "Todas", em cada praça que imprime). A via que outro aparelho já
 * imprimiu não sai de novo. Sem praças, uma via só (Geral), se a loja ligou a via.
 */
export function viasAImprimir(
  pedidos: Pedido[],
  opcoes: {
    agora: Date
    tempos?: ConfigCozinha
    produtos: Produto[]
    pracas: Praca[]
    viaDaCozinha?: boolean
    pracaDoAparelho: string
  },
): ViaDaCozinha[] {
  const { agora, tempos, produtos, pracas, pracaDoAparelho } = opcoes
  const imprimem =
    pracas.length === 0
      ? opcoes.viaDaCozinha
        ? [PRACA_GERAL]
        : []
      : pracas.filter(
          (praca) => praca.imprime && (pracaDoAparelho === "todas" || praca.id === pracaDoAparelho),
        )
  const [aFazer] = colunasDaCozinha(pedidos, "todos", agora, tempos)
  return aFazer.tickets
    .filter((ticket) => ticket.itens.length > 0 && ticket.pedido.status !== "cancelado")
    .flatMap((ticket) =>
      imprimem.flatMap((praca) => {
        const itens =
          pracas.length === 0
            ? ticket.itens
            : (ticketNaPraca(ticket, { pracaId: praca.id, produtos, pracas })?.itens ?? [])
        const impressa = `${rodadaDaVia(ticket)}:${praca.id}`
        if (itens.length === 0 || ticket.pedido.viasImpressas?.includes(impressa)) return []
        return [
          {
            chave: `${ticket.pedido.id}:${impressa}`,
            ticket,
            praca: { id: praca.id, nome: praca.nome },
            itens,
          },
        ]
      }),
    )
}

/** Marca a via como impressa ("rodada:praça"). `nova` diz se ela ainda não tinha saído. */
export function marcarVia(pedido: Pedido, via: string): { pedido: Pedido; nova: boolean } {
  if (pedido.viasImpressas?.includes(via)) return { pedido, nova: false }
  return {
    pedido: { ...pedido, viasImpressas: [...(pedido.viasImpressas ?? []), via] },
    nova: true,
  }
}

/**
 * As vias de um ticket, para reimprimir: na praça do aparelho, a dela; em "Todas", uma
 * por praça que tem itens (Geral no fim). Sem praças, uma via só, com tudo.
 */
export function viasDoTicket(
  ticket: TicketCozinha,
  opcoes: { produtos: Produto[]; pracas: Praca[]; pracaDoAparelho: string },
): ViaDaCozinha[] {
  const { produtos, pracas, pracaDoAparelho } = opcoes
  const via = (praca: { id: string; nome: string }, itens: ItemPedido[]): ViaDaCozinha => ({
    chave: `${ticket.pedido.id}:${rodadaDaVia(ticket)}:${praca.id}`,
    ticket,
    praca: { id: praca.id, nome: praca.nome },
    itens,
  })
  if (pracas.length === 0) return [via(PRACA_GERAL, ticket.itens)]
  return [...pracas, PRACA_GERAL]
    .filter((praca) => pracaDoAparelho === "todas" || praca.id === pracaDoAparelho)
    .flatMap((praca) => {
      const itens = ticketNaPraca(ticket, { pracaId: praca.id, produtos, pracas })?.itens ?? []
      return itens.length > 0 ? [via(praca, itens)] : []
    })
}
