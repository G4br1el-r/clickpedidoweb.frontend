import type { ItemPedido } from "../dados/tipos"
import type { SegmentoPainelId } from "../segmentos-painel"

/** Como o ticket mostra o item, do jeito que cada cozinha lê. */
export type LeituraDoItem = {
  /** Pizzaria: o tamanho, no topo. */
  tamanho: string | null
  /** Pizzaria: os sabores em frações ("½ Calabresa"). */
  fracoes: string[]
  /** Pizzaria: a borda, em destaque. */
  destaque: string | null
  /** As outras opções; na adega, os itens do combo abertos. */
  linhas: string[]
  /** Açougue: o peso pedido, da linha toda. */
  peso: string | null
}

const FRACAO: Record<number, string> = { 2: "½", 3: "⅓", 4: "¼" }

/** "Grupo: valor" → ["Grupo", "valor"]; sem os dois-pontos, o grupo fica vazio. */
function partes(opcao: string): [string, string] {
  const posicao = opcao.indexOf(": ")
  return posicao < 0 ? ["", opcao] : [opcao.slice(0, posicao), opcao.slice(posicao + 2)]
}

const pesoEmTexto = (gramas: number) =>
  gramas >= 1000
    ? `${(gramas / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`
    : `${gramas} g`

function naPizzaria(item: ItemPedido): LeituraDoItem {
  const lidas = item.opcoes.map((opcao) => ({
    opcao,
    grupo: partes(opcao)[0],
    valor: partes(opcao)[1],
  }))
  const sabores = lidas.filter(({ grupo }) => /^\dº sabor$/.test(grupo))
  const tamanho = lidas.find(({ grupo }) => /^tamanho$/i.test(grupo))
  const borda = lidas.find(
    ({ grupo, valor }) => /^borda$/i.test(grupo) && !/^(tradicional|sem)/i.test(valor),
  )
  // Um sabor só não é fração: fica nas linhas, como veio.
  const fracao = FRACAO[sabores.length]
  const separadas = new Set([tamanho, borda, ...(fracao ? sabores : [])])
  return {
    tamanho: tamanho?.valor ?? null,
    fracoes: fracao ? sabores.map(({ valor }) => `${fracao} ${valor}`) : [],
    destaque: borda?.opcao ?? null,
    linhas: lidas.filter((lida) => !separadas.has(lida)).map(({ opcao }) => opcao),
    peso: null,
  }
}

/**
 * A leitura do item no ticket: a pizzaria em frações, com a borda em destaque e o
 * tamanho no topo; a adega com o combo aberto; o açougue com o peso pedido.
 */
export function leituraDoItem(item: ItemPedido, segmento: SegmentoPainelId): LeituraDoItem {
  const vazia: LeituraDoItem = {
    tamanho: null,
    fracoes: [],
    destaque: null,
    linhas: item.opcoes,
    peso: null,
  }
  if (segmento === "pizzaria") return naPizzaria(item)
  if (segmento === "adega") {
    return {
      ...vazia,
      linhas: item.opcoes.flatMap((opcao) =>
        partes(opcao)[1]
          .split(", ")
          .map((escolha) => `${item.quantidade}× ${escolha}`),
      ),
    }
  }
  if (segmento === "acougue" && item.pesoGramas !== undefined) {
    return { ...vazia, peso: pesoEmTexto(item.pesoGramas * item.quantidade) }
  }
  return vazia
}
