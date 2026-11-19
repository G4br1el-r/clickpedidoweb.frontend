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
  const daCozinha = pedido.itens.filter((item) => item.vaiParaCozinha ?? pedido.enviarParaCozinha)
  const ultima = Math.max(0, ...daCozinha.map(rodadaDo))
  return {
    atuais: daCozinha.filter((item) => rodadaDo(item) === ultima),
    anteriores: daCozinha.filter((item) => rodadaDo(item) !== ultima),
  }
}

/**
 * A cozinha já preparou (ou está preparando) o item: ele foi para a cozinha e a comanda
 * está em preparo ou pronta. Tirar ou diminuir esse item pede confirmação.
 */
export const cozinhaJaPreparou = (comanda: Pedido, item: ItemPedido) =>
  (item.vaiParaCozinha ?? comanda.enviarParaCozinha) &&
  (comanda.status === "em-preparo" || comanda.status === "pronto")

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

export type StatusTicket = "recebido" | "em-preparo" | "pronto"

/** Os status em que o pedido está na mão da cozinha. */
const NA_COZINHA: StatusPedido[] = ["recebido", "em-preparo", "pronto"]

/** Uma rodada de um pedido, como a cozinha a vê. */
export type TicketCozinha = {
  /** "pedido:rodada". */
  id: string
  pedido: Pedido
  rodada: number
  status: StatusTicket
  itens: ItemPedido[]
  /** Quando a rodada chegou: o lançamento do garçom ou a criação do pedido. */
  chegouEm: string
}

/** O estado da rodada sai dos itens: nenhum iniciado, algum iniciado, todos riscados. */
function statusDaRodada(itens: ItemPedido[]): StatusTicket {
  if (itens.every((item) => item.feitoEm)) return "pronto"
  return itens.some((item) => item.iniciadoEm) ? "em-preparo" : "recebido"
}

/** Os tickets da cozinha: um por rodada de cada pedido, só com o que vai para a cozinha. */
export function ticketsDaCozinha(pedidos: Pedido[]): TicketCozinha[] {
  const naCozinha = pedidos.filter(
    (pedido) => pedido.tipo !== "atendimento" && NA_COZINHA.includes(pedido.status),
  )
  return naCozinha.flatMap((pedido) => {
    const daCozinha = pedido.itens.filter((item) => item.vaiParaCozinha ?? pedido.enviarParaCozinha)
    const rodadas = [...new Set(daCozinha.map(rodadaDo))].sort((a, b) => a - b)
    return rodadas.map((rodada) => {
      const itens = daCozinha.filter((item) => rodadaDo(item) === rodada)
      return {
        id: `${pedido.id}:${rodada}`,
        pedido,
        rodada,
        status: statusDaRodada(itens),
        itens,
        chegouEm: itens.find((item) => item.lancadoEm)?.lancadoEm ?? pedido.criadoEm,
      }
    })
  })
}

const ORDEM_DO_TICKET: StatusTicket[] = ["recebido", "em-preparo", "pronto"]

/**
 * O status do pedido na cozinha é o da rodada mais atrás: uma rodada nova põe a comanda
 * em Novo, e ela só fica pronta quando todas as rodadas estão prontas.
 */
export function statusPelasRodadas(pedido: Pedido): StatusTicket | null {
  const status = ticketsDaCozinha([pedido]).map((ticket) => ORDEM_DO_TICKET.indexOf(ticket.status))
  return status.length > 0 ? ORDEM_DO_TICKET[Math.min(...status)] : null
}

/** O ticket da rodada, na etapa que a tela mostrava; se outra aba mudou, recusa. */
function ticketDo(pedido: Pedido, rodada: number, de: StatusTicket) {
  const ticket = ticketsDaCozinha([pedido]).find((item) => item.rodada === rodada)
  if (!ticket) throw new Error("Esta rodada não está na cozinha.")
  if (ticket.status !== de) throw new Error("Este ticket já mudou de etapa. Atualize a tela.")
  return ticket
}

/** Muda os itens da rodada e põe o pedido no status da rodada mais atrás. */
function mudarItensDaRodada(
  pedido: Pedido,
  daRodada: ItemPedido[],
  mudar: (item: ItemPedido) => ItemPedido,
): Pedido {
  const ids = new Set(daRodada.map((item) => item.id))
  const mudado = {
    ...pedido,
    itens: pedido.itens.map((item) => (ids.has(item.id) ? mudar(item) : item)),
  }
  return { ...mudado, status: statusPelasRodadas(mudado) ?? pedido.status }
}

/** A rodada passa para a próxima etapa: A fazer → Preparando → Pronto. */
export function avancarRodada(
  pedido: Pedido,
  rodada: number,
  de: StatusTicket,
  agora: string,
): Pedido {
  const ticket = ticketDo(pedido, rodada, de)
  if (de === "pronto") throw new Error("Este ticket não tem próxima etapa")
  return mudarItensDaRodada(pedido, ticket.itens, (item) =>
    de === "recebido"
      ? { ...item, iniciadoEm: agora }
      : { ...item, feitoEm: item.feitoEm ?? agora },
  )
}

/** A rodada volta uma etapa: o pronto volta a preparar, o preparo volta a fazer. */
export function voltarRodada(pedido: Pedido, rodada: number, de: StatusTicket): Pedido {
  const ticket = ticketDo(pedido, rodada, de)
  if (de === "recebido") throw new Error("Este ticket não tem etapa anterior")
  return mudarItensDaRodada(pedido, ticket.itens, ({ feitoEm, iniciadoEm, ...item }) =>
    de === "pronto" ? { ...item, iniciadoEm } : item,
  )
}

/** Risca (ou desrisca) um item. Riscar num ticket de A fazer já começa a rodada. */
export function riscarItem(pedido: Pedido, itemId: string, feito: boolean, agora: string): Pedido {
  const ticket = ticketsDaCozinha([pedido]).find((item) =>
    item.itens.some((doTicket) => doTicket.id === itemId),
  )
  if (!ticket) throw new Error("Este item não está na cozinha.")
  return mudarItensDaRodada(pedido, ticket.itens, ({ feitoEm, ...item }) => {
    const iniciado = { ...item, iniciadoEm: item.iniciadoEm ?? agora }
    if (item.id !== itemId) return feitoEm ? { ...iniciado, feitoEm } : iniciado
    return feito ? { ...iniciado, feitoEm: feitoEm ?? agora } : iniciado
  })
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
  const recente = (pedido: Pedido) =>
    agora.getTime() - Date.parse(pedido.atualizadoEm) < PRONTO_FICA_MINUTOS * 60_000

  return [
    { id: "afazer", titulo: "A fazer", status: "recebido", pedidos: com("recebido") },
    { id: "preparando", titulo: "Preparando", status: "em-preparo", pedidos: com("em-preparo") },
    { id: "prontos", titulo: "Prontos", status: "pronto", pedidos: com("pronto").filter(recente) },
  ]
}
