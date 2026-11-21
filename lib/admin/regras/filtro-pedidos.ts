import type {
  FormaPagamento,
  MotivoCancelamento,
  OrigemPedido,
  Pedido,
  StatusPedido,
  TipoPedido,
} from "../dados/tipos"
import { telefoneDoCliente } from "./dashboard/clientes"
import { ehValido } from "./dashboard/comum"

/** O motivo no filtro: o cancelado sem motivo aparece como "Não informado". */
export type MotivoDoFiltro = MotivoCancelamento | "nao-informado"

/** O motivo do pedido cancelado, ou "nao-informado"; o que não foi cancelado não tem. */
export const motivoDoPedido = (pedido: Pedido): MotivoDoFiltro | undefined =>
  pedido.status === "cancelado" ? (pedido.cancelamento?.motivo ?? "nao-informado") : undefined

export type FiltrosLista = {
  busca?: string
  status?: StatusPedido[]
  tipos?: TipoPedido[]
  pagamentos?: FormaPagamento[]
  origens?: OrigemPedido[]
  /** Telefones do cliente, só os dígitos com DDD. */
  clientes?: string[]
  motivos?: MotivoDoFiltro[]
}

/** Minúsculas e sem acento: "João" acha "joao". */
export const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

function combinaBusca(pedido: Pedido, busca: string) {
  const texto = normalizar(busca).trim()
  if (!texto) return true
  const digitos = busca.replace(/\D/g, "")
  if (digitos && String(pedido.numero) === digitos.replace(/^0+/, "")) return true
  // Telefone a partir de 4 dígitos, para "12" não achar todo mundo.
  if (digitos.length >= 4 && pedido.cliente.telefone.includes(digitos)) return true
  return (
    normalizar(pedido.cliente.nome).includes(texto) ||
    pedido.itens.some((item) => normalizar(item.nome).includes(texto))
  )
}

const aceita = <T>(lista: T[] | undefined, valor: T) => !lista?.length || lista.includes(valor)

/**
 * Busca (número, cliente, telefone ou item) combinada com os filtros de status, canal,
 * pagamento, origem, cliente e motivo do cancelamento.
 */
export function filtrarPedidos(
  pedidos: Pedido[],
  { busca = "", status, tipos, pagamentos, origens, clientes, motivos }: FiltrosLista,
) {
  return pedidos.filter(
    (pedido) =>
      aceita(status, pedido.status) &&
      aceita(tipos, pedido.tipo) &&
      aceita(pagamentos, pedido.pagamento) &&
      aceita(origens, pedido.origem) &&
      (!clientes?.length || clientes.includes(telefoneDoCliente(pedido.cliente.telefone) ?? "")) &&
      (!motivos?.length || motivos.includes(motivoDoPedido(pedido) as MotivoDoFiltro)) &&
      combinaBusca(pedido, busca),
  )
}

/** Quantos pedidos a lista tem e quanto somam as vendas válidas. */
export function totaisDaLista(pedidos: Pedido[]) {
  const validos = pedidos.filter(ehValido)
  return {
    pedidos: pedidos.length,
    validos: validos.length,
    faturamento: Math.round(validos.reduce((soma, pedido) => soma + pedido.total, 0) * 100) / 100,
  }
}

/** Contagem por valor de um campo, para mostrar ao lado de cada opção dos filtros. */
export function contarPor<K extends "status" | "tipo" | "pagamento">(pedidos: Pedido[], campo: K) {
  const contagem = new Map<Pedido[K], number>()
  for (const pedido of pedidos) contagem.set(pedido[campo], (contagem.get(pedido[campo]) ?? 0) + 1)
  return contagem
}
