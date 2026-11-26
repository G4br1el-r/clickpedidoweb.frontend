import type { Lote, Produto, Receita } from "../dados/tipos"
import { conferirReceita, INFO_RECEITA, situacaoDoLote, type ValidadeLote } from "./farmacia"

export type DestinoDoLote = "descarte" | "devolucao"

/** Para onde vai o lote: vencido sai para descarte; o que vence em 30 dias volta ao distribuidor. */
export function destinoDoLote(validade: ValidadeLote): DestinoDoLote | null {
  if (validade === "vencido") return "descarte"
  if (validade === "vence-em-30") return "devolucao"
  return null
}

/** Separa os lotes marcados pelo destino; quem ainda não pede nada fica como está. */
export function divisaoDosLotes(lotes: Lote[], agora: Date) {
  const descartar: Lote[] = []
  const devolver: Lote[] = []
  const semDestino: Lote[] = []
  for (const lote of lotes) {
    const destino = destinoDoLote(situacaoDoLote(lote, agora).validade)
    ;(destino === "descarte" ? descartar : destino === "devolucao" ? devolver : semDestino).push(
      lote,
    )
  }
  return { descartar, devolver, semDestino }
}

export function textoDosLotes(quantidade: number) {
  return quantidade === 1 ? "1 lote selecionado" : `${quantidade} lotes selecionados`
}

export function textoDasReceitas(quantidade: number) {
  return quantidade === 1 ? "1 receita selecionada" : `${quantidade} receitas selecionadas`
}

/**
 * Quais receitas marcadas podem ser aprovadas juntas: só as sem pendência. `comRetencao` são
 * as aprovadas que pedem a via retida, que o farmacêutico confirma uma vez para todas.
 */
export function planoDeAprovacao(receitas: Receita[], produtos: Produto[], agora: Date) {
  const aprovaveis: Receita[] = []
  const comPendencia: Receita[] = []
  for (const receita of receitas) {
    ;(conferirReceita(receita, produtos, agora).length === 0 ? aprovaveis : comPendencia).push(
      receita,
    )
  }
  return {
    aprovaveis,
    comPendencia,
    comRetencao: aprovaveis.filter((receita) => INFO_RECEITA[receita.tipo].retencao).length,
  }
}

/** A via só fica retida quando o tipo da receita pede e o farmacêutico confirmou. */
export function retidaNaAprovacao(receita: Receita, confirmou: boolean) {
  return INFO_RECEITA[receita.tipo].retencao && confirmou
}

/** "2 lotes separados para descarte." Fica no aviso depois da ação em lote. */
export function textoDoDestino(destino: DestinoDoLote, quantidade: number) {
  const lotes = quantidade === 1 ? "1 lote separado" : `${quantidade} lotes separados`
  return `${lotes} para ${destino === "descarte" ? "descarte" : "devolução"}.`
}

export function textoDaDecisao(decisao: "aprovada" | "recusada", quantidade: number) {
  const sufixo = decisao === "aprovada" ? "aprovad" : "recusad"
  return quantidade === 1 ? `1 receita ${sufixo}a.` : `${quantidade} receitas ${sufixo}as.`
}

/** O que a barra diz dos lotes marcados que ainda não pedem nada. */
export function notaDosLotes(semDestino: number) {
  if (semDestino === 0) return undefined
  return `${semDestino} sem ação: ${semDestino === 1 ? "fica como está" : "ficam como estão"}`
}

/** O que a barra diz das receitas marcadas que têm pendência e não entram na aprovação. */
export function notaDasReceitas(comPendencia: number) {
  if (comPendencia === 0) return undefined
  return `${comPendencia} com pendência: ${comPendencia === 1 ? "fica de fora" : "ficam de fora"}`
}
