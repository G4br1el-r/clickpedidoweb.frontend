import type { ItemPedido, Pedido, StatusPedido } from "../dados/tipos"
import type { Urgencia } from "./fila"

export type FiltroCozinha = "todos" | "mesas" | "entrega" | "retirada"

export type ColunaCozinha = {
  id: "afazer" | "preparando" | "prontos"
  titulo: string
  status: StatusPedido
  pedidos: Pedido[]
}

/** Quanto tempo um pedido pronto continua na tela da cozinha. */
const PRONTO_FICA_MINUTOS = 15

const rodadaDo = (item: ItemPedido) => item.rodada ?? 1

/**
 * O que a cozinha prepara. Na comanda, só a última rodada enviada é nova; as
 * anteriores já foram servidas e aparecem apagadas. Item sem cozinha (bebida
 * lançada direto na mesa) não aparece.
 */
export function itensDaCozinha(pedido: Pedido): { atuais: ItemPedido[]; anteriores: ItemPedido[] } {
  // O item que veio de outra mesa não é rodada desta cozinha.
  const daCozinha = pedido.itens.filter(
    (item) => !item.transferido && (item.vaiParaCozinha ?? pedido.enviarParaCozinha),
  )
  const ultima = Math.max(0, ...daCozinha.map(rodadaDo))
  return {
    atuais: daCozinha.filter((item) => rodadaDo(item) === ultima),
    anteriores: daCozinha.filter((item) => rodadaDo(item) !== ultima),
  }
}

/**
 * A cozinha já preparou (ou está preparando) o item: ele foi para a cozinha e é de uma rodada
 * anterior à última (que a cozinha mostra como servida), ou é da última com a comanda em
 * preparo ou pronta. O item sem cozinha nunca conta. Tirar esse item exige motivo.
 */
export function cozinhaJaPreparou(comanda: Pedido, item: ItemPedido): boolean {
  // Veio de outra mesa: vale o que a cozinha de lá já tinha feito.
  if (item.transferido) return item.transferido.preparado
  if (!(item.vaiParaCozinha ?? comanda.enviarParaCozinha)) return false
  const [atual] = itensDaCozinha(comanda).atuais
  if (atual && rodadaDo(item) < rodadaDo(atual)) return true
  return comanda.status === "em-preparo" || comanda.status === "pronto"
}

/** "Mesa 3", ou "Mesa 15 + 16" com as mesas juntadas. */
export function rotuloDaMesa({ mesa }: Pick<Pedido, "mesa">): string {
  return [
    "Mesa",
    [mesa?.numero, ...(mesa?.juntadas ?? []).map((item) => item.numero)].join(" + "),
  ].join(" ")
}

const ultimaRodada = (pedido: Pedido) => Math.max(0, ...itensDaCozinha(pedido).atuais.map(rodadaDo))

/** Há rodada pronta na mesa: uma anterior à da cozinha, ou a atual com a comanda pronta. */
function temProntoAServir(pedido: Pedido): boolean {
  const { atuais, anteriores } = itensDaCozinha(pedido)
  return anteriores.length > 0 || (atuais.length > 0 && pedido.status === "pronto")
}

/**
 * Acerta a comanda depois de tirar itens. Se saiu inteira a rodada que estava na cozinha, a
 * comanda volta a "pronto": as anteriores já foram preparadas e não voltam para "A fazer". Se
 * não sobrou nada pronto, o "Servir" sai.
 */
export function depoisDeTirar(antes: Pedido, depois: Pedido): Pedido {
  const naCozinha = depois.status === "recebido" || depois.status === "em-preparo"
  const acertado: Pedido =
    naCozinha && ultimaRodada(depois) < ultimaRodada(antes)
      ? { ...depois, status: "pronto" }
      : depois
  if (!acertado.servirDesde || temProntoAServir(acertado)) return acertado
  const { servirDesde: _servirDesde, ...semServir } = acertado
  return semServir
}

/** "id:rodada" da rodada que a cozinha tem de cada pedido. */
function chaveDaRodada(pedido: Pedido): string | null {
  const [primeiro] = itensDaCozinha(pedido).atuais
  return primeiro ? `${pedido.id}:${rodadaDo(primeiro)}` : null
}

export const rodadasNaCozinha = (pedidos: Pedido[]): Set<string> =>
  new Set(pedidos.map(chaveDaRodada).filter((chave) => chave !== null))

/** Rodadas que chegaram desde a última leitura: pedido novo ou mais itens numa comanda. */
export function rodadasNovas(conhecidas: ReadonlySet<string>, pedidos: Pedido[]): string[] {
  return pedidos
    .filter((pedido) => pedido.status === "recebido")
    .map(chaveDaRodada)
    .filter((chave) => chave !== null && !conhecidas.has(chave)) as string[]
}

/** Quando a rodada atual chegou à cozinha: o lançamento do garçom ou a criação do pedido. */
function chegada(pedido: Pedido): number {
  const lancado = itensDaCozinha(pedido).atuais.find((item) => item.lancadoEm)?.lancadoEm
  return Date.parse(lancado ?? pedido.criadoEm)
}

export const minutosNaCozinha = (pedido: Pedido, agora: Date) =>
  Math.floor((agora.getTime() - chegada(pedido)) / 60_000)

/** Âmbar a partir de 15 minutos e vermelho a partir de 25, contando da chegada da rodada. */
export function urgenciaNaCozinha(pedido: Pedido, agora: Date): Urgencia {
  const minutos = minutosNaCozinha(pedido, agora)
  if (minutos >= 25) return "atrasado"
  if (minutos >= 15) return "atencao"
  return "normal"
}

const PASSA_NO_FILTRO: Record<FiltroCozinha, (pedido: Pedido) => boolean> = {
  todos: () => true,
  mesas: (pedido) => pedido.tipo === "mesa",
  entrega: (pedido) => pedido.tipo === "entrega",
  retirada: (pedido) => pedido.tipo === "retirada",
}

/**
 * Quadro da cozinha. Fica de fora o salão (atendimento), o que não tem nada a
 * preparar e o pronto há mais de 15 minutos: dali em diante, entrega e retirada
 * seguem pela Fila e a mesa fecha em Mesas.
 */
export function colunasDaCozinha(
  pedidos: Pedido[],
  filtro: FiltroCozinha,
  agora: Date,
): ColunaCozinha[] {
  const naCozinha = pedidos.filter(
    (pedido) =>
      pedido.tipo !== "atendimento" &&
      PASSA_NO_FILTRO[filtro](pedido) &&
      itensDaCozinha(pedido).atuais.length > 0,
  )
  const com = (status: StatusPedido) =>
    naCozinha.filter((pedido) => pedido.status === status).sort((a, b) => chegada(a) - chegada(b))
  // Na comanda, conta da hora em que a cozinha terminou: servir, pedir a conta ou tirar a
  // rodada seguinte mudam a comanda, mas não a põem de novo em "Prontos".
  const prontoEm = (pedido: Pedido) =>
    pedido.eventos?.findLast((evento) => evento.tipo === "pronta")?.em ?? pedido.atualizadoEm
  const recente = (pedido: Pedido) =>
    agora.getTime() - Date.parse(prontoEm(pedido)) < PRONTO_FICA_MINUTOS * 60_000

  return [
    { id: "afazer", titulo: "A fazer", status: "recebido", pedidos: com("recebido") },
    { id: "preparando", titulo: "Preparando", status: "em-preparo", pedidos: com("em-preparo") },
    { id: "prontos", titulo: "Prontos", status: "pronto", pedidos: com("pronto").filter(recente) },
  ]
}
