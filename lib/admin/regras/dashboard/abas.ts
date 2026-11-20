import type { SegmentoPainelId } from "../../segmentos-painel"

export type AbaId = "resumo" | "vendas" | "produtos" | "clientes" | "financeiro"
export type InfoAba = { id: AbaId; titulo: string }

const ABAS: readonly InfoAba[] = [
  { id: "resumo", titulo: "Resumo" },
  { id: "vendas", titulo: "Vendas" },
  { id: "produtos", titulo: "Produtos" },
  { id: "clientes", titulo: "Clientes" },
  { id: "financeiro", titulo: "Financeiro" },
]

/** Abas do dashboard que o segmento vê, na ordem da barra. */
export function abasDo(_segmento: SegmentoPainelId): readonly InfoAba[] {
  return ABAS
}

/** A aba pedida na URL, ou o Resumo quando ela não existe no segmento. */
export function abaEscolhida(valor: string | null, segmento: SegmentoPainelId): AbaId {
  return abasDo(segmento).find((aba) => aba.id === valor)?.id ?? "resumo"
}
