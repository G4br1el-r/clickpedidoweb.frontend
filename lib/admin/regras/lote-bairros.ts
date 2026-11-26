import { plural } from "../../formato"
import type { Bairro } from "../dados/tipos"

/**
 * Ids marcados que ainda estão na lista visível. Marcar um bairro e depois filtrar a lista
 * não pode deixar a ação em lote mexer no que a pessoa já não está vendo.
 */
export function idsDoLote(selecao: Record<string, boolean>, visiveis: Bairro[]) {
  return visiveis.filter((bairro) => selecao[bairro.id]).map((bairro) => bairro.id)
}

/** Quem de fato muda ao ligar ou desligar o lote: quem já está no estado pedido fica de fora. */
export function efeitoDoLoteBairros(bairros: Bairro[], ids: string[]) {
  const marcados = new Set(ids)
  const doLote = bairros.filter((bairro) => marcados.has(bairro.id))
  return {
    aAtivar: doLote.filter((bairro) => !bairro.ativo).map((bairro) => bairro.id),
    aDesativar: doLote.filter((bairro) => bairro.ativo).map((bairro) => bairro.id),
  }
}

export const textoDoLoteBairros = (quantidade: number) =>
  plural(quantidade, "bairro selecionado", "bairros selecionados")
