import { emReais } from "./formato"
import { lojaAtual } from "./loja-atual"
import type { Pedido } from "./sacola"
import { textosDoSegmento } from "./segmentos"

const VALIDADE_PIX_MS = 30 * 60 * 1000

/** Protótipo: segundos até cada mudança, para o dono ver o fluxo inteiro em meio minuto. */
const SIMULACAO = {
  pagamentoPix: 14,
  pagamentoCartao: 5,
  etapas: [0, 6, 16, 28],
}

export type EtapaPedido = { titulo: string; texto: string }

export function etapasDoPedido(tipo: Pedido["tipo"]): EtapaPedido[] {
  const retirada = tipo === "retirada"
  const textos = textosDoSegmento(lojaAtual().segmento)
  return [
    { titulo: "Pedido recebido", texto: "A loja já viu seu pedido." },
    { titulo: "Em preparo", texto: textos.preparo },
    retirada
      ? { titulo: "Pronto para retirar", texto: "Pode vir buscar no balcão." }
      : { titulo: "Saiu para entrega", texto: "O entregador está a caminho." },
    {
      titulo: retirada ? "Retirado" : "Entregue",
      texto: textos.fim,
    },
  ]
}

/** Segundos que o aviso de pagamento aprovado fica na tela. */
const AVISO_APROVADO = 8

/** Hora e minuto, como "21:05". */
export const horario = (momento: number) =>
  new Date(momento).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

/** Faixa de horário em que o pedido deve chegar (ou ficar pronto), contada a partir do início. */
export function previsaoDoPedido(tipo: Pedido["tipo"], inicio: number) {
  const loja = lojaAtual()
  const tempo = tipo === "retirada" ? loja.retirada.tempo : loja.entrega.tempo
  const [minimo, maximo] = tempo.match(/\d+/g)?.map(Number) ?? [30, 45]
  return `${horario(inicio + minimo * 60_000)} – ${horario(inicio + (maximo ?? minimo) * 60_000)}`
}

/** Código fictício: tem o formato do Pix copia e cola, mas não paga nada. */
export function codigoPix(pedido: Pedido) {
  const valor = pedido.total.toFixed(2)
  return `00020126580014br.gov.bcb.pix0136demo-clickpedido-${pedido.numero}5204000053039865406${valor}5802BR5913${lojaAtual().nome.slice(0, 13)}6009SAO PAULO62070503***6304DEMO`
}

/** Quanto falta para o Pix vencer, como "mm:ss". */
export function tempoRestantePix(criadoEm: number | undefined, agora: number) {
  const restante = Math.max(0, (criadoEm ?? agora) + VALIDADE_PIX_MS - agora)
  const minutos = String(Math.floor(restante / 60_000)).padStart(2, "0")
  const segundos = String(Math.floor((restante % 60_000) / 1000)).padStart(2, "0")
  return `${minutos}:${segundos}`
}

export type SituacaoPedido = {
  pago: boolean
  /** Índice da etapa em andamento; -1 enquanto espera o pagamento. */
  atual: number
  concluido: boolean
  /** Quantas etapas a lista mostra como feitas: a última conta como feita ao concluir. */
  atualNaLista: number
  /** Quando cada etapa começa; a primeira é logo depois do pagamento confirmado. */
  momentos: number[]
  /** Pagamento online confirmado há pouco: hora de mostrar o aviso de aprovado. */
  pagamentoAcabouDeConfirmar: boolean
  criadoEm: number
}

/** Em que pé está o pedido no momento `agora` (simulação do protótipo). */
export function situacaoDoPedido(pedido: Pedido, agora: number): SituacaoPedido {
  const criadoEm = pedido.criadoEm ?? agora
  const decorrido = (agora - criadoEm) / 1000
  const online = pedido.pagamento === "pix" || pedido.pagamento === "cartao-online"
  const esperaPagamento = !online
    ? 0
    : pedido.pagamento === "pix"
      ? SIMULACAO.pagamentoPix
      : SIMULACAO.pagamentoCartao
  const pago = decorrido >= esperaPagamento
  const momentos = SIMULACAO.etapas.map(
    (segundos) => criadoEm + (esperaPagamento + segundos) * 1000,
  )
  const atual = pago ? Math.max(0, momentos.filter((momento) => agora >= momento).length - 1) : -1
  const concluido = atual === SIMULACAO.etapas.length - 1
  return {
    pago,
    atual,
    concluido,
    atualNaLista: concluido ? SIMULACAO.etapas.length : Math.max(atual, 0),
    momentos,
    pagamentoAcabouDeConfirmar: online && pago && decorrido < esperaPagamento + AVISO_APROVADO,
    criadoEm,
  }
}

/** Texto do troco no pagamento em dinheiro. */
export function descricaoDoTroco(troco: number | null | undefined, total: number) {
  return troco ? `Troco para ${emReais(troco)} (volta ${emReais(troco - total)})` : "Sem troco"
}
