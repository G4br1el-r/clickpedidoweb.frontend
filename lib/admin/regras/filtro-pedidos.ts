import type { FormaPagamento, OrigemPedido, Pedido, StatusPedido, TipoPedido } from "../dados/tipos"
import { formasDoPedido } from "./conta"
import { ehValido } from "./dashboard/comum"

export type FiltrosLista = {
  busca?: string
  status?: StatusPedido[]
  tipos?: TipoPedido[]
  pagamentos?: FormaPagamento[]
  origens?: OrigemPedido[]
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

/** Busca (número, cliente, telefone ou item) combinada com os filtros de status, canal, pagamento e origem. */
export function filtrarPedidos(
  pedidos: Pedido[],
  { busca = "", status, tipos, pagamentos, origens }: FiltrosLista,
) {
  return pedidos.filter(
    (pedido) =>
      aceita(status, pedido.status) &&
      aceita(tipos, pedido.tipo) &&
      // A conta Misto aparece em cada forma que ela tem.
      (!pagamentos?.length || formasDoPedido(pedido).some((forma) => pagamentos.includes(forma))) &&
      aceita(origens, pedido.origem) &&
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
  for (const pedido of pedidos) {
    // Na forma de pagamento, a conta Misto conta em cada forma, como no filtro.
    const valores = (
      campo === "pagamento" ? formasDoPedido(pedido) : [pedido[campo]]
    ) as Pedido[K][]
    for (const valor of valores) contagem.set(valor, (contagem.get(valor) ?? 0) + 1)
  }
  return contagem
}
