import type { AbaId } from "./dashboard/abas"

/** De que peças é feito o esqueleto de uma aba: réguas de números, gráfico e listas. */
export type FormaDoEsqueleto = { reguas: number; grafico: boolean; listas: number }

const FORMAS: Record<AbaId, FormaDoEsqueleto> = {
  resumo: { reguas: 2, grafico: true, listas: 2 },
  vendas: { reguas: 1, grafico: true, listas: 2 },
  produtos: { reguas: 1, grafico: false, listas: 2 },
  clientes: { reguas: 1, grafico: false, listas: 2 },
  operacao: { reguas: 2, grafico: false, listas: 2 },
  entrega: { reguas: 1, grafico: false, listas: 2 },
  financeiro: { reguas: 2, grafico: false, listas: 2 },
  agenda: { reguas: 1, grafico: false, listas: 1 },
  farmacia: { reguas: 1, grafico: false, listas: 2 },
  pesagem: { reguas: 1, grafico: false, listas: 1 },
}

/** O esqueleto de cada aba imita o formato real dela: quem espera já vê onde as coisas vão cair. */
export function formaDoEsqueleto(aba: AbaId): FormaDoEsqueleto {
  return FORMAS[aba]
}
