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
  // Sem o aceite da loja, a rodada ainda não chegou na cozinha.
  if (pedido.esperaAceite) return null
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
      // A cozinha só começa o que a loja aceitou.
      !pedido.esperaAceite &&
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
