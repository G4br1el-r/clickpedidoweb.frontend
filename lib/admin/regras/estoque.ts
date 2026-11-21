import type { ControleEstoque, Pedido, Produto, TipoMovimento, UnidadeVenda } from "../dados/tipos"

export type SituacaoEstoque = "ok" | "baixo" | "zerado" | "negativo"

/** Quilo guarda 3 casas (gramas); a soma em ponto flutuante não acumula sobra. */
const casas = (valor: number) => Math.round(valor * 1000) / 1000

/** Baixo é chegar ao mínimo; zerado e negativo à parte (pedido do site pode passar do saldo). */
export function situacaoEstoque({ quantidade, minimo }: ControleEstoque): SituacaoEstoque {
  if (quantidade < 0) return "negativo"
  if (quantidade === 0) return "zerado"
  if (quantidade <= minimo) return "baixo"
  return "ok"
}

/** Saldo depois de um movimento com sinal (entra positivo, sai negativo). */
export const saldoDepois = (saldo: number, movimento: number) => casas(saldo + movimento)

const controlado = (produto: Produto | undefined) => Boolean(produto?.estoque?.controlar)

/**
 * Quanto o pedido tira de cada produto controlado: a quantidade na unidade; no quilo,
 * o peso pedido (ou o da balança, se já pesou); e cada opção de combo ligada a um
 * produto sai 1 por unidade do item.
 */
export function consumoDoPedido(pedido: Pedido, produtos: Produto[]): Map<string, number> {
  const porId = new Map(produtos.map((produto) => [produto.id, produto]))
  const consumo = new Map<string, number>()
  const somar = (produtoId: string, quantidade: number) => {
    if (!controlado(porId.get(produtoId))) return
    consumo.set(produtoId, casas((consumo.get(produtoId) ?? 0) + quantidade))
  }
  for (const item of pedido.itens) {
    if (item.produtoId) {
      const produto = porId.get(item.produtoId)
      if (produto?.unidade === "kg" && item.pesoGramas !== undefined) {
        somar(item.produtoId, (item.pesoReal ?? item.pesoGramas * item.quantidade) / 1000)
      } else {
        somar(item.produtoId, item.quantidade)
      }
    }
    for (const ligado of item.produtosDasOpcoes ?? []) somar(ligado, item.quantidade)
  }
  return consumo
}

/** Topo da tela: o que está controlado, o que pede reposição e o dinheiro parado. */
export function resumoDoEstoque(produtos: Produto[]) {
  const controlados = produtos.flatMap((produto) =>
    produto.estoque?.controlar ? [{ ...produto.estoque, custo: produto.custo }] : [],
  )
  const situacoes = controlados.map(situacaoEstoque)
  return {
    controlados: controlados.length,
    baixos: situacoes.filter((situacao) => situacao === "baixo").length,
    zerados: situacoes.filter((situacao) => situacao === "zerado" || situacao === "negativo")
      .length,
    valorParado:
      Math.round(
        controlados.reduce(
          (soma, estoque) => soma + Math.max(estoque.quantidade, 0) * (estoque.custo ?? 0),
          0,
        ) * 100,
      ) / 100,
  }
}

/** Confere um movimento feito à mão; `null` quando está tudo certo. */
export function errosDoMovimento({
  tipo,
  quantidade,
  unidade,
  motivo,
}: {
  tipo: Extract<TipoMovimento, "entrada" | "saida" | "contagem">
  quantidade: number
  unidade: UnidadeVenda
  motivo?: string
}): string | null {
  // A contagem pode dar zero (acabou de verdade); entrada e saída não.
  const minimo = tipo === "contagem" ? 0 : Number.MIN_VALUE
  if (!Number.isFinite(quantidade) || quantidade < minimo) {
    return "Informe uma quantidade maior que zero."
  }
  if (unidade === "un" && !Number.isInteger(quantidade))
    return "Na unidade, a quantidade é inteira."
  if (tipo === "saida" && !motivo?.trim()) return "Diga o motivo da saída."
  return null
}

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 })
/** Sinal de menos tipográfico: lê melhor que o hífen ao lado do número. */
const MENOS = "−"

/** Número com sinal: "+10", "−2", e o zero sem sinal. */
export function numeroComSinal(valor: number): string {
  if (valor === 0) return "0"
  return `${valor > 0 ? "+" : MENOS}${numero.format(Math.abs(valor))}`
}

/** Saldo na tela: "12 un", "3,5 kg"; negativo com o sinal de menos. */
export function emQuantidade(valor: number, unidade: UnidadeVenda): string {
  const texto = valor < 0 ? numeroComSinal(valor) : numero.format(valor)
  return `${texto} ${unidade}`
}

const ROTULOS_MOVIMENTO: Record<TipoMovimento, string> = {
  entrada: "Entrada",
  saida: "Saída",
  contagem: "Contagem",
  venda: "Venda",
  devolucao: "Devolução",
  pesagem: "Pesagem",
  perda: "Perda",
}

/** O nome do movimento no histórico do estoque. */
export const rotuloDoMovimento = (tipo: TipoMovimento) => ROTULOS_MOVIMENTO[tipo]
