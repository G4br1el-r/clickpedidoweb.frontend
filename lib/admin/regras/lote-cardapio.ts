import type { Produto } from "../dados/tipos"

/** O que a barra de lote do cardápio faz com os produtos marcados. */
export type AcaoDoLote = "disponivel" | "indisponivel" | "visivel" | "oculto" | "excluir"

/** Campo do produto que a ação troca; `null` quando a ação não é uma troca (excluir). */
export function campoDaAcao(acao: AcaoDoLote): "disponivel" | "ativo" | null {
  if (acao === "disponivel" || acao === "indisponivel") return "disponivel"
  if (acao === "visivel" || acao === "oculto") return "ativo"
  return null
}

const PRECISA_MUDAR: Record<AcaoDoLote, (produto: Produto) => boolean> = {
  disponivel: (produto) => !produto.disponivel,
  indisponivel: (produto) => produto.disponivel,
  visivel: (produto) => !produto.ativo,
  oculto: (produto) => produto.ativo,
  excluir: () => true,
}

/**
 * Dos produtos marcados, quem de fato muda com a ação. Quem já está no estado pedido
 * fica de fora: a troca do servidor inverte o campo, então mexer nele desfaria o pedido.
 */
export function produtosQueMudam(produtos: Produto[], acao: AcaoDoLote) {
  return produtos.filter(PRECISA_MUDAR[acao])
}

export function textoDoLoteDeProdutos(quantidade: number) {
  return quantidade === 1 ? "1 produto selecionado" : `${quantidade} produtos selecionados`
}

/** Marca ou desmarca um produto, sem mexer no conjunto de origem. */
export function alternarMarca(marcados: ReadonlySet<string>, id: string) {
  const novo = new Set(marcados)
  if (novo.has(id)) novo.delete(id)
  else novo.add(id)
  return novo
}

/** Marca ou desmarca vários de uma vez (os produtos que aparecem na lista). */
export function marcarVarios(marcados: ReadonlySet<string>, ids: string[], marcar: boolean) {
  const novo = new Set(marcados)
  for (const id of ids) {
    if (marcar) novo.add(id)
    else novo.delete(id)
  }
  return novo
}

/** Estado da caixa "marcar todos os visíveis": vazia, parcial ou cheia. */
export function estadoDaMarcaGeral(
  marcados: ReadonlySet<string>,
  visiveis: string[],
): boolean | "indeterminate" {
  const quantos = visiveis.filter((id) => marcados.has(id)).length
  if (quantos === 0) return false
  return quantos === visiveis.length ? true : "indeterminate"
}

/**
 * Só conta quem está marcado e ainda aparece na lista: um filtro novo não deixa
 * produto escondido marcado, nem a barra age sobre o que a pessoa não vê.
 */
export function marcadosVisiveis(marcados: ReadonlySet<string>, visiveis: Produto[]) {
  return visiveis.filter((produto) => marcados.has(produto.id))
}

const FRASE_DO_RESULTADO: Record<AcaoDoLote, { um: string; varios: string }> = {
  disponivel: { um: "ficou disponível", varios: "ficaram disponíveis" },
  indisponivel: { um: "ficou indisponível", varios: "ficaram indisponíveis" },
  visivel: { um: "ficou visível", varios: "ficaram visíveis" },
  oculto: { um: "ficou oculto", varios: "ficaram ocultos" },
  excluir: { um: "foi excluído", varios: "foram excluídos" },
}

/** Avisos depois do lote: o que deu certo e, à parte, o que falhou (cada um só se houver). */
export function textoDoResultado(acao: AcaoDoLote, feitos: number, falhas: number) {
  const frase = FRASE_DO_RESULTADO[acao]
  const texto: { sucesso?: string; erro?: string } = {}
  if (feitos > 0) {
    texto.sucesso = `${feitos} ${feitos === 1 ? `produto ${frase.um}` : `produtos ${frase.varios}`}.`
  }
  if (falhas > 0) {
    const falha =
      acao === "excluir"
        ? falhas === 1
          ? "produto não foi excluído"
          : "produtos não foram excluídos"
        : falhas === 1
          ? "produto não mudou"
          : "produtos não mudaram"
    texto.erro = `${falhas} ${falha}. Confira e tente de novo.`
  }
  return texto
}

/** Título e aviso do diálogo de confirmação ao excluir os marcados. */
export function textoDaConfirmacaoDeExclusao(produtos: Produto[]) {
  if (produtos.length === 1) {
    return {
      titulo: `Excluir ${produtos[0].nome}?`,
      descricao: "Ele sai do cardápio. Os pedidos antigos continuam com o nome do item.",
    }
  }
  return {
    titulo: `Excluir ${produtos.length} produtos?`,
    descricao: "Eles saem do cardápio. Os pedidos antigos continuam com o nome dos itens.",
  }
}
