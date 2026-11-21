import { addHours, format, startOfDay, subDays } from "date-fns"
import { saldoDepois } from "../regras/estoque"
import { SEGMENTOS_PAINEL, type SegmentoPainelId } from "../segmentos-painel"
import { sorteadorDaSemente } from "./gerar-pedidos"
import type { CatalogoLoja, ControleEstoque, MovimentoEstoque, Produto } from "./tipos"

/** Revenda nas lojas de comida: o que sai pronto da prateleira. */
const REVENDA = /bebida|sobremesa/i

/** O que cada loja controla: tudo na adega, no açougue e na farmácia; revenda na comida. */
function controla(segmento: SegmentoPainelId, produto: Produto, categoria: string | undefined) {
  if (!produto.ativo) return false
  if (segmento === "salao") return false
  if (segmento === "pizzaria" || segmento === "lanchonete") return REVENDA.test(categoria ?? "")
  return true
}

const reais = (valor: number) => Math.round(valor * 100) / 100

/**
 * Estoque de demonstração: saldos, mínimos e custos plausíveis, alguns itens baixos e
 * um zerado (já esgotado), com o histórico que leva a cada saldo: o estoque inicial de
 * uma semana atrás, uma compra, uma perda. Sempre igual para o mesmo dia e loja.
 * O controle começa hoje: os pedidos antigos não entram no histórico.
 */
export function semearEstoque({
  catalogo,
  segmento,
  agora,
}: {
  catalogo: CatalogoLoja
  segmento: SegmentoPainelId
  agora: Date
}): { produtos: Produto[]; movimentos: MovimentoEstoque[] } {
  const indice = SEGMENTOS_PAINEL.findIndex((item) => item.id === segmento)
  const sorte = sorteadorDaSemente(Number(format(agora, "yyyyMMdd")) * 10 + indice + 7)
  const categorias = new Map(catalogo.categorias.map((item) => [item.id, item.nome]))
  const hoje = startOfDay(agora)
  const semanaPassada = addHours(subDays(hoje, 7), 9)
  const anteontem = addHours(subDays(hoje, 2), 10)
  const ontem = addHours(subDays(hoje, 1), 18)

  const escolhidos = catalogo.produtos
    .map((produto, posicao) => ({ produto, posicao }))
    .filter(
      ({ produto }) =>
        !produto.estoque && controla(segmento, produto, categorias.get(produto.categoriaId)),
    )
  // Poucos produtos (a revenda da pizzaria): garante um baixo e um zerado mesmo assim.
  const zerado = escolhidos.length < 24 ? escolhidos.length - 1 : -1
  const baixo = escolhidos.length < 10 ? 0 : -1

  const novos = new Map<number, Produto>()
  const movimentos: MovimentoEstoque[] = []

  escolhidos.forEach(({ produto, posicao }, ordem) => {
    const quilo = produto.unidade === "kg"
    const minimo = quilo ? sorte.inteiro(3, 8) : sorte.inteiro(4, 12)
    // O sorteio acontece sempre, para os outros não mudarem quando o produto já tem custo.
    const sorteado = reais((produto.preco * sorte.inteiro(40, 65)) / 100)
    const custo = produto.custo ?? sorteado
    const ehZerado = ordem % 23 === 11 || ordem === zerado
    const ehBaixo = !ehZerado && (ordem % 9 === 4 || ordem === baixo)
    let quantidade = quilo
      ? sorte.inteiro(minimo * 10 + 30, 400) / 10
      : sorte.inteiro(minimo + 3, minimo + 60)
    if (ehBaixo) quantidade = quilo ? Math.max(0.5, minimo / 2) : Math.max(1, minimo - 1)
    if (ehZerado) quantidade = 0

    // História que leva ao saldo: inicial, compra (um terço dos itens) e uma perda.
    const passos: Omit<MovimentoEstoque, "id" | "produtoId" | "saldo">[] = []
    if (ehZerado) {
      const inicial = quilo ? 5 : sorte.inteiro(6, 12)
      passos.push(
        {
          tipo: "entrada",
          quantidade: inicial,
          observacao: "Estoque inicial",
          custoUnitario: custo,
          criadoEm: semanaPassada.toISOString(),
        },
        {
          tipo: "saida",
          quantidade: -inicial,
          motivo: "Vencimento",
          criadoEm: ontem.toISOString(),
        },
      )
    } else {
      const compra =
        ordem % 3 === 0 ? (quilo ? Math.round(quantidade * 5) / 10 : Math.floor(quantidade / 2)) : 0
      const perda = ordem % 13 === 6 ? (quilo ? 0.5 : 1) : 0
      const inicial = saldoDepois(saldoDepois(quantidade, -compra), perda)
      passos.push({
        tipo: "entrada",
        quantidade: inicial,
        observacao: "Estoque inicial",
        custoUnitario: custo,
        criadoEm: semanaPassada.toISOString(),
      })
      if (compra > 0) {
        passos.push({
          tipo: "entrada",
          quantidade: compra,
          observacao: "Compra do fornecedor",
          custoUnitario: custo,
          criadoEm: anteontem.toISOString(),
        })
      }
      if (perda > 0) {
        passos.push({
          tipo: "saida",
          quantidade: -perda,
          motivo: "Quebra",
          criadoEm: ontem.toISOString(),
        })
      }
    }
    let saldo = 0
    passos.forEach((passo, numero) => {
      saldo = saldoDepois(saldo, passo.quantidade)
      movimentos.push({
        ...passo,
        id: `mov-${produto.id}-${numero + 1}`,
        produtoId: produto.id,
        saldo,
      })
    })

    const estoque: ControleEstoque = {
      controlar: true,
      quantidade,
      minimo,
      esgotarAoZerar: true,
      ...(ehZerado ? { esgotadoPeloEstoque: true } : {}),
    }
    novos.set(posicao, {
      ...produto,
      custo,
      estoque,
      ...(ehZerado ? { disponivel: false } : {}),
    })
  })

  return {
    produtos: catalogo.produtos.map((produto, posicao) => novos.get(posicao) ?? produto),
    // Do mais antigo para o mais novo, como o histórico da base.
    movimentos: movimentos.toSorted((a, b) => Date.parse(a.criadoEm) - Date.parse(b.criadoEm)),
  }
}
