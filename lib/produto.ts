import { comoVender } from "./farmacia"
import type { ItemSacola } from "./sacola"
import type { GrupoOpcao, ItemOpcao, Produto } from "./tipos"

export type Escolhido = { grupo: GrupoOpcao; item: ItemOpcao }

/** O item escolhido em cada grupo, na ordem dos grupos. */
export function escolhidosDe(grupos: GrupoOpcao[], selecoes: Record<string, string>): Escolhido[] {
  return grupos.flatMap((grupo) => {
    const item = grupo.itens.find((opcao) => opcao.id === selecoes[grupo.id])
    return item ? [{ grupo, item }] : []
  })
}

/** Grupos obrigatórios que ainda não têm escolha. */
export function gruposFaltantes(grupos: GrupoOpcao[], selecoes: Record<string, string>) {
  return grupos.filter((grupo) => grupo.obrigatorio && !selecoes[grupo.id])
}

/** Aviso mostrado quando a pessoa tenta adicionar sem fazer as escolhas obrigatórias. */
export function avisoDeFaltantes(faltantes: GrupoOpcao[]) {
  return faltantes.length === 1
    ? `${faltantes[0].titulo} para continuar`
    : `Faltam ${faltantes.length} escolhas: ${faltantes.map((grupo) => grupo.nome).join(", ")}`
}

/** Preço de uma unidade: o do produto mais o extra de cada escolha. */
export function precoComExtras(produto: Produto, escolhidos: Escolhido[]) {
  return escolhidos.reduce((soma, { item }) => soma + item.extra, produto.preco)
}

/** Item que vai para a sacola. A borda aparece como "Borda catupiry" no resumo. */
export function montarItemSacola(
  produto: Produto,
  escolhidos: Escolhido[],
  quantidade: number,
  observacao: string,
): Omit<ItemSacola, "chave"> {
  return {
    produtoId: produto.id,
    nome: produto.nome,
    imagem: produto.imagem,
    precoUnitario: precoComExtras(produto, escolhidos),
    quantidade,
    resumo: escolhidos.map(({ grupo, item }) =>
      grupo.tipo === "borda" ? `Borda ${item.nome.toLowerCase()}` : item.nome,
    ),
    observacao: observacao.trim() || undefined,
    ...(produto.medicamento ? { venda: comoVender(produto.medicamento) } : {}),
  }
}

/** Texto em que a busca procura, sem acento e em minúsculas. Na farmácia, entra o princípio ativo. */
export function textoDeBusca(produto: Produto): string {
  const partes = [produto.nome, produto.descricao]
  if (produto.medicamento)
    partes.push(produto.medicamento.principioAtivo, produto.medicamento.laboratorio)
  return partes
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}
