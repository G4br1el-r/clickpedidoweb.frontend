import type { Produto } from "./tipos"

/**
 * O que a etiqueta do produto diz na vitrine. É o único detalhe marcado do card,
 * e cada segmento escreve nela o que importa: o quilo no açougue, a embalagem na
 * farmácia, a duração no salão, o "a partir de" de quem monta com opções pagas.
 */
export type Etiqueta = {
  preco: number
  precoAntigo?: number
  aPartirDe?: true
  porKg?: true
  detalhe?: string
}

function duracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas}h${String(resto).padStart(2, "0")}`
}

/** Unidades que a etiqueta reconhece no texto do produto, na grafia da etiqueta. */
const UNIDADES: [RegExp, (numero: string) => string][] = [
  [/(\d+(?:[.,]\d+)?)\s?ml\b/i, (n) => `${n} ml`],
  [/(\d+(?:[.,]\d+)?)\s?(?:l|litros?)\b/i, (n) => `${n} L`],
  [/(\d+(?:[.,]\d+)?)\s?kg\b/i, (n) => `${n} kg`],
  [/(\d+(?:[.,]\d+)?)\s?g\b/i, (n) => `${n} g`],
  [/(\d+)\s?fatias\b/i, (n) => `${n} fatias`],
  [/(\d+)\s?unidades\b/i, (n) => `${n} unidades`],
]

/** A medida que o próprio lojista já escreveu no nome ou na descrição, quando há uma. */
function medidaDoTexto(produto: Produto): string | undefined {
  for (const texto of [produto.nome, produto.descricao]) {
    for (const [padrao, escrever] of UNIDADES) {
      const achado = texto.match(padrao)
      if (achado) return escrever(achado[1])
    }
  }
  return undefined
}

export function etiquetaDoProduto(produto: Produto): Etiqueta {
  const etiqueta: Etiqueta = { preco: produto.preco }
  if (produto.precoOriginal) etiqueta.precoAntigo = produto.precoOriginal
  if (produto.grupos?.some((grupo) => grupo.itens.some((item) => item.extra > 0)))
    etiqueta.aPartirDe = true
  if (produto.unidade === "kg") etiqueta.porKg = true
  const detalhe =
    produto.medicamento?.apresentacao ??
    (produto.duracaoMin ? duracao(produto.duracaoMin) : undefined) ??
    produto.medida ??
    medidaDoTexto(produto)
  if (detalhe) etiqueta.detalhe = detalhe
  return etiqueta
}
