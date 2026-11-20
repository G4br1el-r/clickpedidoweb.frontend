import type { Produto } from "../dados/tipos"
import type { ColunaCozinha } from "./cozinha"

/** Uma linha do resumo de produção: quanto falta fazer de um produto, e em que tickets. */
export type LinhaDeProducao = {
  chave: string
  produtoId: string | null
  nome: string
  quantidade: number
  /** Os tickets ("pedido:rodada") que têm o produto. */
  tickets: string[]
}

/**
 * O que a cozinha tem para fazer agora, somado por produto: A fazer e Preparando, nas
 * colunas que a tela mostra (já com a praça e o filtro). Do maior para o menor.
 */
export function resumoDeProducao(colunas: ColunaCozinha[]): LinhaDeProducao[] {
  const linhas = new Map<string, LinhaDeProducao>()
  for (const coluna of colunas) {
    if (coluna.id === "prontos") continue
    for (const ticket of coluna.tickets) {
      if (ticket.pedido.status === "cancelado") continue
      for (const item of ticket.itens) {
        if (item.feitoEm) continue
        const chave = item.produtoId ?? item.nome
        const linha = linhas.get(chave) ?? {
          chave,
          produtoId: item.produtoId,
          nome: item.nome,
          quantidade: 0,
          tickets: [],
        }
        linha.quantidade += item.quantidade
        if (!linha.tickets.includes(ticket.id)) linha.tickets.push(ticket.id)
        linhas.set(chave, linha)
      }
    }
  }
  return [...linhas.values()].sort(
    (a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"),
  )
}

/** Os produtos à venda que estão esgotados, pelo nome: os que a cozinha pode devolver. */
export function esgotados(produtos: Produto[]): Produto[] {
  return produtos
    .filter((produto) => produto.ativo && !produto.disponivel)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}
