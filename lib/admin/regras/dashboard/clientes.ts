import { differenceInCalendarDays, startOfDay, subDays } from "date-fns"
import type { Pedido } from "../../dados/tipos"
import type { SegmentoPainelId } from "../../segmentos-painel"
import { ehValido, noPeriodo, reais } from "./comum"

/** Quantos dias a aba Clientes enxerga, até hoje. */
export const DIAS_DE_CLIENTES = 90

/**
 * O cliente é o telefone do pedido: só os dígitos, com DDD (10 ou 11), sem o 55 do país.
 * Sem DDD não dá para saber quem é: `null`.
 */
export function telefoneDoCliente(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, "")
  const semPais = digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos
  return semPais.length === 10 || semPais.length === 11 ? semPais : null
}

export type Cliente = {
  telefone: string
  /** O nome do pedido mais recente. */
  nome: string
  pedidos: number
  gasto: number
  primeiro: string
  ultimo: string
}

/** Os dias que a aba Clientes enxerga: os últimos 90, até hoje. */
export const periodoDeClientes = (agora: Date) => ({
  de: startOfDay(subDays(agora, DIAS_DE_CLIENTES - 1)),
  ate: startOfDay(agora),
})

/**
 * Clientes dos últimos 90 dias, do que mais gastou ao que menos gastou. Só vendas válidas;
 * o telefone da própria loja (PDV e mesa) e o sem DDD não são cliente.
 */
export function clientesDos90Dias(
  pedidos: Pedido[],
  agora: Date,
  telefoneDaLoja: string,
): Cliente[] {
  const daLoja = telefoneDoCliente(telefoneDaLoja)
  const clientes = new Map<string, Cliente>()
  const ordenados = noPeriodo(pedidos, periodoDeClientes(agora))
    .filter(ehValido)
    .toSorted((a, b) => Date.parse(a.criadoEm) - Date.parse(b.criadoEm))
  for (const pedido of ordenados) {
    const telefone = telefoneDoCliente(pedido.cliente.telefone)
    if (!telefone || telefone === daLoja) continue
    const atual = clientes.get(telefone)
    clientes.set(telefone, {
      telefone,
      nome: pedido.cliente.nome,
      pedidos: (atual?.pedidos ?? 0) + 1,
      gasto: reais((atual?.gasto ?? 0) + pedido.total),
      primeiro: atual?.primeiro ?? pedido.criadoEm,
      ultimo: pedido.criadoEm,
    })
  }
  return [...clientes.values()].sort((a, b) => b.gasto - a.gasto || b.pedidos - a.pedidos)
}

/** Quantos dias contam como "novo": o primeiro pedido caiu nesses últimos dias. */
export const DIAS_DE_NOVO = 30

/** Régua da aba: clientes únicos, novos nos últimos 30 dias, % que voltou e pedidos por cliente. */
export function reguaDeClientes(clientes: Cliente[], agora: Date) {
  const desde = startOfDay(subDays(agora, DIAS_DE_NOVO - 1)).getTime()
  const total = clientes.reduce((soma, cliente) => soma + cliente.pedidos, 0)
  return {
    unicos: clientes.length,
    novos: clientes.filter((cliente) => Date.parse(cliente.primeiro) >= desde).length,
    recorrentes: clientes.length
      ? (clientes.filter((cliente) => cliente.pedidos >= 2).length / clientes.length) * 100
      : 0,
    pedidosPorCliente: clientes.length ? reais(total / clientes.length) : 0,
  }
}

/** Há quantos dias sem voltar o cliente que comprou mais de uma vez já conta como sumido. */
export const DIAS_DE_SUMIDO = 30

/**
 * Sumidos: compraram 2 vezes ou mais e não voltam há 30 dias ou mais. De quem mais gastou
 * para quem menos gastou, com os dias desde o último pedido.
 */
export function sumidos(clientes: Cliente[], agora: Date) {
  return clientes
    .map((cliente) => ({
      ...cliente,
      dias: differenceInCalendarDays(agora, new Date(cliente.ultimo)),
    }))
    .filter((cliente) => cliente.pedidos >= 2 && cliente.dias >= DIAS_DE_SUMIDO)
    .sort((a, b) => b.gasto - a.gasto)
}

/**
 * Mensagem para chamar o sumido de volta, pelo WhatsApp: a pessoa revisa e envia. No salão,
 * o cliente agenda em vez de pedir.
 */
export function mensagemDeVolta({
  nome,
  loja,
  link,
  segmento,
}: {
  nome: string
  loja: string
  link: string
  segmento: SegmentoPainelId
}) {
  const primeiro = nome.trim().split(/\s+/)[0]
  const verbo = segmento === "salao" ? "agenda" : "pede"
  return `Oi, ${primeiro}! Faz um tempinho que você não ${verbo} na ${loja}. Bateu saudade? Dá uma olhada no que tem hoje: ${link}`
}
