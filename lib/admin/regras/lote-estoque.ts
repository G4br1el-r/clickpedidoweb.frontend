import { plural } from "../../formato"
import type { Produto } from "../dados/tipos"

export function textoDosProdutos(quantidade: number) {
  return quantidade === 1 ? "1 produto selecionado" : `${quantidade} produtos selecionados`
}

export type PlanoDoMinimo = {
  /** Controlados com outro mínimo: são os que mudam. */
  alterar: Produto[]
  /** Controlados que já têm esse mínimo: nada a fazer. */
  iguais: Produto[]
  /** Sem controle de estoque: o mínimo não faz sentido, ficam como estão. */
  semControle: Produto[]
}

/** Quem muda, quem já está certo e quem fica de fora ao definir o mesmo mínimo em vários. */
export function planoDoMinimo(produtos: Produto[], minimo: number): PlanoDoMinimo {
  const plano: PlanoDoMinimo = { alterar: [], iguais: [], semControle: [] }
  for (const produto of produtos) {
    if (!produto.estoque?.controlar) plano.semControle.push(produto)
    else if (produto.estoque.minimo === minimo) plano.iguais.push(produto)
    else plano.alterar.push(produto)
  }
  return plano
}

/** Confere o mínimo digitado; `null` quando serve para todos os controlados marcados. */
export function erroDoMinimoEmLote(minimo: number | null, produtos: Produto[]): string | null {
  if (minimo === null || !Number.isFinite(minimo) || minimo < 0) {
    return "Informe um mínimo de zero ou mais."
  }
  const naUnidade = produtos.some(
    (produto) => produto.estoque?.controlar && produto.unidade === "un",
  )
  if (naUnidade && !Number.isInteger(minimo)) return "Na unidade, o mínimo é inteiro."
  return null
}

/** O que a configuração do produto recebe: o controle e o esgotar ao zerar ficam como estão. */
export function ajusteDoMinimo(produto: Produto, minimo: number) {
  return {
    id: produto.id,
    controlar: true,
    minimo,
    esgotarAoZerar: produto.estoque?.esgotarAoZerar ?? true,
  }
}

/** A frase de conferência antes de aplicar: o que muda e o que fica como está. */
export function textoDoPlanoDoMinimo({ alterar, iguais, semControle }: PlanoDoMinimo) {
  const principal =
    alterar.length === 0
      ? "Nenhum produto muda."
      : `Muda o mínimo de ${plural(alterar.length, "produto", "produtos")}.`
  const deFora: string[] = []
  if (iguais.length > 0) deFora.push(`${iguais.length} já tem esse mínimo`)
  if (semControle.length > 0) {
    deFora.push(
      semControle.length === 1 ? "1 está sem controle" : `${semControle.length} estão sem controle`,
    )
  }
  if (deFora.length === 0) return principal
  const fica = iguais.length + semControle.length === 1 ? "fica como está" : "ficam como estão"
  return `${principal} ${deFora.join(" e ")}: ${fica}.`
}
