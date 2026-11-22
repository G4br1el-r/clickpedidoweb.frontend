import type { Pedido } from "../dados/tipos"
import type { ColunaCozinha } from "./cozinha"

/**
 * A página que a TV mostra agora: cada coluna com a sua fatia de `porColuna` tickets. O
 * total de páginas vem da coluna mais cheia; a página que passou do fim volta à primeira.
 */
export function paginaDaTv(
  colunas: ColunaCozinha[],
  pagina: number,
  porColuna: number,
): { colunas: ColunaCozinha[]; pagina: number; total: number } {
  const total = Math.max(
    1,
    ...colunas.map((coluna) => Math.ceil(coluna.tickets.length / porColuna)),
  )
  const atual = pagina % total
  return {
    pagina: atual,
    total,
    colunas: colunas.map((coluna) => ({
      ...coluna,
      tickets: coluna.tickets.slice(atual * porColuna, (atual + 1) * porColuna),
    })),
  }
}

/**
 * O painel de chamada, para o cliente da retirada: os números em preparo (pela chegada) e
 * os prontos (o mais novo primeiro). Some quando a retirada é concluída.
 */
export function numerosDaChamada(pedidos: Pedido[]): { preparando: number[]; prontos: number[] } {
  const retiradas = pedidos.filter((pedido) => pedido.tipo === "retirada")
  const preparando = retiradas
    .filter((pedido) => pedido.status === "recebido" || pedido.status === "em-preparo")
    .sort((a, b) => Date.parse(a.criadoEm) - Date.parse(b.criadoEm))
  const prontos = retiradas
    .filter((pedido) => pedido.status === "pronto")
    .sort(
      (a, b) =>
        Date.parse(b.etapas?.pronto ?? b.criadoEm) - Date.parse(a.etapas?.pronto ?? a.criadoEm),
    )
  return {
    preparando: preparando.map((pedido) => pedido.numero),
    prontos: prontos.map((pedido) => pedido.numero),
  }
}
