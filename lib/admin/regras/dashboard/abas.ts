import { type SegmentoPainelId, temModulo, temRecurso } from "../../segmentos-painel"

export type AbaId =
  | "resumo"
  | "vendas"
  | "produtos"
  | "clientes"
  | "operacao"
  | "entrega"
  | "financeiro"
  | "agenda"
  | "farmacia"
  | "pesagem"
export type InfoAba = { id: AbaId; titulo: string }

/** Cada aba com o que o segmento precisa ter para vê-la; sem condição, todos veem. */
const ABAS: readonly (InfoAba & { so?: (segmento: SegmentoPainelId) => boolean })[] = [
  { id: "resumo", titulo: "Resumo" },
  { id: "vendas", titulo: "Vendas" },
  { id: "produtos", titulo: "Produtos" },
  { id: "clientes", titulo: "Clientes" },
  { id: "operacao", titulo: "Operação" },
  { id: "entrega", titulo: "Entrega", so: (segmento) => temModulo(segmento, "motoboys") },
  { id: "financeiro", titulo: "Financeiro" },
  // A aba do segmento, sempre no fim.
  { id: "agenda", titulo: "Agenda", so: (segmento) => temModulo(segmento, "agendamentos") },
  { id: "farmacia", titulo: "Farmácia", so: (segmento) => temModulo(segmento, "receitas") },
  { id: "pesagem", titulo: "Pesagem", so: (segmento) => temRecurso(segmento, "pagarAposPesagem") },
]

/** Abas do dashboard que o segmento vê, na ordem da barra. */
export function abasDo(segmento: SegmentoPainelId): readonly InfoAba[] {
  return ABAS.filter((aba) => !aba.so || aba.so(segmento)).map(({ id, titulo }) => ({
    id,
    titulo,
  }))
}

/** A aba pedida na URL, ou o Resumo quando ela não existe no segmento. */
export function abaEscolhida(valor: string | null, segmento: SegmentoPainelId): AbaId {
  return abasDo(segmento).find((aba) => aba.id === valor)?.id ?? "resumo"
}
