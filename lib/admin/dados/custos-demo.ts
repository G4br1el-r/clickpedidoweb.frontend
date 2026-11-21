import type { SegmentoPainelId } from "../segmentos-painel"
import { sorteadorDaSemente } from "./gerar-pedidos"
import type { Produto } from "./tipos"

const reais = (valor: number) => Math.round(valor * 100) / 100

/** Semente do produto pelo id: o custo dele não muda se o cardápio mudar de ordem. */
const sementeDo = (id: string) =>
  [...id].reduce((soma, letra) => (soma * 31 + (letra.codePointAt(0) ?? 0)) | 0, 7)

/**
 * Custos de demonstração: uma parte plausível do preço (no salão, só o material, menor).
 * Cerca de 1 em 12 fica sem custo, para a tela mostrar o aviso de cobertura da margem.
 * Quem já tem custo fica com o dele.
 */
export function semearCustos(produtos: Produto[], segmento: SegmentoPainelId): Produto[] {
  const [de, ate] = segmento === "salao" ? [16, 34] : [31, 59]
  return produtos.map((produto) => {
    if (produto.custo !== undefined) return produto
    const sorte = sorteadorDaSemente(sementeDo(produto.id))
    if (sorte.inteiro(1, 12) === 1) return produto
    return { ...produto, custo: reais((produto.preco * sorte.inteiro(de, ate)) / 100) }
  })
}
