import { precoDoPeso, rotuloDoPeso } from "./acougue"
import { comoVender } from "./farmacia"
import type { ItemSacola } from "./sacola"
import type { GrupoOpcao, ItemOpcao, Produto } from "./tipos"

export type Escolhido = { grupo: GrupoOpcao; item: ItemOpcao }

/**
 * O que foi marcado em cada grupo: um id, ou uma lista nos grupos de várias escolhas
 * (adicionais do quiosque, gelos dos combos da adega), na ordem em que foram marcados.
 */
export type Selecoes = Record<string, string | string[]>

const idsDo = (selecoes: Selecoes, grupo: GrupoOpcao) => {
  const escolha = selecoes[grupo.id]
  return Array.isArray(escolha) ? escolha : escolha ? [escolha] : []
}

/** Os itens escolhidos, na ordem dos grupos e, dentro do grupo, na ordem em que foram marcados. */
export function escolhidosDe(grupos: GrupoOpcao[], selecoes: Selecoes): Escolhido[] {
  return grupos.flatMap((grupo) =>
    idsDo(selecoes, grupo).flatMap((id) => {
      const item = grupo.itens.find((opcao) => opcao.id === id)
      return item ? [{ grupo, item }] : []
    }),
  )
}

/** Grupos obrigatórios que ainda não têm escolha. */
export function gruposFaltantes(grupos: GrupoOpcao[], selecoes: Selecoes) {
  return grupos.filter((grupo) => grupo.obrigatorio && idsDo(selecoes, grupo).length === 0)
}

/** Aviso mostrado quando a pessoa tenta adicionar sem fazer as escolhas obrigatórias. */
export function avisoDeFaltantes(faltantes: GrupoOpcao[]) {
  return faltantes.length === 1
    ? `${faltantes[0].titulo} para continuar`
    : `Faltam ${faltantes.length} escolhas: ${faltantes.map((grupo) => grupo.nome).join(", ")}`
}

/**
 * Preço de uma unidade: o do produto mais o extra de cada escolha. As primeiras escolhas de
 * cada grupo, até o "grátis até" dele, não cobram.
 */
export function precoComExtras(produto: Produto, escolhidos: Escolhido[]) {
  const vistos = new Map<string, number>()
  return escolhidos.reduce((soma, { grupo, item }) => {
    const posicao = vistos.get(grupo.id) ?? 0
    vistos.set(grupo.id, posicao + 1)
    return posicao < (grupo.gratisAte ?? 0) ? soma : soma + item.extra
  }, produto.preco)
}

/**
 * Item que vai para a sacola. A borda aparece como "Borda catupiry" no resumo.
 * Açougue: com `pesoGramas`, o preço é o estimado do peso e o peso abre o resumo.
 */
export function montarItemSacola(
  produto: Produto,
  escolhidos: Escolhido[],
  quantidade: number,
  observacao: string,
  pesoGramas?: number,
): Omit<ItemSacola, "chave"> {
  const porPeso = produto.unidade === "kg" && pesoGramas !== undefined
  return {
    produtoId: produto.id,
    nome: produto.nome,
    imagem: produto.imagem,
    precoUnitario: porPeso
      ? precoDoPeso(precoComExtras(produto, escolhidos), pesoGramas)
      : precoComExtras(produto, escolhidos),
    quantidade,
    resumo: [
      ...(porPeso ? [rotuloDoPeso(pesoGramas)] : []),
      ...escolhidos.map(({ grupo, item }) =>
        grupo.tipo === "borda" ? `Borda ${item.nome.toLowerCase()}` : item.nome,
      ),
    ],
    ...(porPeso ? { pesoGramas } : {}),
    ...(produto.duracaoMin ? { duracaoMin: produto.duracaoMin } : {}),
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
