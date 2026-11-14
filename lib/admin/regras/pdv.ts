import type { GrupoOpcao, Produto } from "../dados/tipos"
import { type SegmentoPainelId, temRecurso } from "../segmentos-painel"

/** Escolhas de uma janela de opções: ids dos itens marcados em cada grupo. */
export type Escolhas = Record<string, string[]>

export type ItemVenda = {
  /** Identifica a linha: itens iguais (produto, opções, observação e preço) se juntam. */
  chave: string
  /** `null` para item avulso. */
  produtoId: string | null
  nome: string
  quantidade: number
  precoUnitario: number
  opcoes: string[]
  observacao?: string
}

export type Desconto = { modo: "reais" | "porcento"; valor: number }

const reais = (valor: number) => Math.round(valor * 100) / 100
const plural = (quantidade: number) => (quantidade === 1 ? "opção" : "opções")
const ativos = (grupos: GrupoOpcao[]) =>
  grupos.filter((grupo) => grupo.ativo).toSorted((a, b) => a.ordem - b.ordem)

/** No balcão vale o preço de balcão, quando o segmento usa e o produto tem. */
export function precoDeBalcao(produto: Produto, segmento: SegmentoPainelId): number {
  return temRecurso(segmento, "precoBalcao") && (produto.precoBalcao ?? 0) > 0
    ? (produto.precoBalcao as number)
    : produto.preco
}

/** Preço com os adicionais; em cada grupo, os N mais baratos do "grátis até" não são cobrados. */
export function precoComOpcoes(base: number, grupos: GrupoOpcao[], escolhas: Escolhas): number {
  let total = base
  for (const grupo of ativos(grupos)) {
    const precos = grupo.itens
      .filter((item) => item.ativo && escolhas[grupo.id]?.includes(item.id))
      .map((item) => item.precoAdicional)
      .toSorted((a, b) => a - b)
    total += precos.slice(grupo.gratisAte).reduce((soma, preco) => soma + preco, 0)
  }
  return reais(total)
}

/** Mensagem por grupo que não respeita o mínimo ou o máximo. */
export function errosDasEscolhas(grupos: GrupoOpcao[], escolhas: Escolhas): Record<string, string> {
  const erros: Record<string, string> = {}
  for (const grupo of ativos(grupos)) {
    const marcados = escolhas[grupo.id]?.length ?? 0
    if (marcados < grupo.minimo) {
      erros[grupo.id] =
        grupo.minimo === grupo.maximo
          ? `Escolha ${grupo.minimo} ${plural(grupo.minimo)}.`
          : `Escolha pelo menos ${grupo.minimo} ${plural(grupo.minimo)}.`
    } else if (marcados > grupo.maximo) {
      erros[grupo.id] = `No máximo ${grupo.maximo} ${plural(grupo.maximo)}.`
    }
  }
  return erros
}

/** Texto das opções, na ordem dos grupos e dos itens: "Borda: Catupiry". */
export function resumoDasOpcoes(grupos: GrupoOpcao[], escolhas: Escolhas): string[] {
  return ativos(grupos).flatMap((grupo) => {
    const nomes = grupo.itens
      .filter((item) => escolhas[grupo.id]?.includes(item.id))
      .toSorted((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"))
      .map((item) => item.nome)
    return nomes.length > 0 ? [`${grupo.nome}: ${nomes.join(", ")}`] : []
  })
}

const chaveDe = (item: Omit<ItemVenda, "chave">) =>
  [
    item.produtoId ?? `avulso:${item.nome}`,
    item.opcoes.join(";"),
    item.observacao ?? "",
    item.precoUnitario,
  ].join("|")

/**
 * Item igual soma a quantidade; diferente entra como outra linha. Campos a mais
 * do item (as escolhas, no Garçom) seguem junto.
 */
export function adicionarItem(itens: ItemVenda[], novo: Omit<ItemVenda, "chave">): ItemVenda[]
export function adicionarItem<T extends ItemVenda>(itens: T[], novo: Omit<T, "chave">): T[]
export function adicionarItem(itens: ItemVenda[], novo: Omit<ItemVenda, "chave">): ItemVenda[] {
  const chave = chaveDe(novo)
  const existente = itens.find((item) => item.chave === chave)
  if (existente) {
    return itens.map((item) =>
      item.chave === chave ? { ...item, quantidade: item.quantidade + novo.quantidade } : item,
    )
  }
  return [...itens, { ...novo, chave }]
}

/** Subtotal, desconto (em R$ ou %, sem passar do subtotal) e total da venda. */
export function totaisDaVenda(itens: ItemVenda[], desconto: Desconto) {
  const subtotal = reais(
    itens.reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0),
  )
  // Campo apagado ou valor estranho: sem desconto.
  const valor = Number.isFinite(desconto.valor) ? Math.max(desconto.valor, 0) : 0
  const pedido = desconto.modo === "porcento" ? (subtotal * Math.min(valor, 100)) / 100 : valor
  const valorDesconto = reais(Math.min(pedido, subtotal))
  return {
    quantidade: itens.reduce((soma, item) => soma + item.quantidade, 0),
    subtotal,
    desconto: valorDesconto,
    total: reais(subtotal - valorDesconto),
  }
}

export function troco(total: number, recebido: number) {
  return {
    troco: reais(Math.max(recebido - total, 0)),
    falta: reais(Math.max(total - recebido, 0)),
  }
}

/** Desconto pedido acima do subtotal (em R$) ou de 100% (em %). O servidor recusa igual. */
export function descontoPassaDoSubtotal(subtotal: number, desconto: Desconto): boolean {
  return desconto.modo === "porcento" ? desconto.valor > 100 : desconto.valor > subtotal
}

/** O que impede de finalizar a venda do PDV, ou `null` quando ela pode fechar. */
export function bloqueioDaVenda(venda: {
  itens: ItemVenda[]
  desconto: Desconto
  pagamento: string | null
  /** Dinheiro: quanto o cliente entregou. Sem valor, vale o total. */
  recebido: number | undefined
}): string | null {
  if (venda.itens.length === 0) return "Inclua um item."
  const { subtotal, total } = totaisDaVenda(venda.itens, venda.desconto)
  if (descontoPassaDoSubtotal(subtotal, venda.desconto)) return "O desconto passa do subtotal."
  if (!venda.pagamento) return "Escolha a forma de pagamento."
  if (venda.pagamento === "dinheiro" && (venda.recebido ?? total) < total) return "Falta dinheiro."
  return null
}
