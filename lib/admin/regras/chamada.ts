import type { Pedido } from "../dados/tipos"
import { ficouPronto } from "./alertas-fila"
import { CLIENTE_DO_BALCAO } from "./pdv"

/** O que a TV mostra de um pedido: o número e, quando houver, só o primeiro nome. */
export type PedidoNaChamada = { id: number; numero: number; nome?: string }

export type QuadroDeChamada = {
  preparando: PedidoNaChamada[]
  prontos: PedidoNaChamada[]
}

/** Só o primeiro nome, com a inicial maiúscula: a TV fica de frente para o salão inteiro. */
function primeiroNome(nome: string): string | undefined {
  if (nome.trim() === CLIENTE_DO_BALCAO) return undefined
  const [primeiro] = nome.trim().split(/\s+/)
  if (!primeiro) return undefined
  return (
    primeiro.charAt(0).toLocaleUpperCase("pt-BR") + primeiro.slice(1).toLocaleLowerCase("pt-BR")
  )
}

const naTela = (pedido: Pedido): PedidoNaChamada => {
  const nome = primeiroNome(pedido.cliente.nome)
  return { id: pedido.id, numero: pedido.numero, ...(nome ? { nome } : {}) }
}

/** Pronto há mais que isso sai da TV: alguém esqueceu de dar Retirado. */
const PRONTO_FICA_MINUTOS = 20

/** Quem espera no balcão: retirada (a venda do PDV também é retirada) já aceita pela loja. */
const esperaNoBalcao = (pedido: Pedido) => pedido.tipo === "retirada" && !pedido.esperaAceite

/**
 * Painel de chamada da TV virada ao cliente: quem espera no balcão vê o número em
 * "Preparando" e, pronto, em "Pronto, pode retirar".
 */
export function quadroDeChamada(pedidos: Pedido[], agora: Date): QuadroDeChamada {
  const doBalcao = pedidos.filter(esperaNoBalcao)
  const limite = agora.getTime() - PRONTO_FICA_MINUTOS * 60_000
  return {
    preparando: doBalcao
      .filter((pedido) => pedido.status === "recebido" || pedido.status === "em-preparo")
      .sort((a, b) => Date.parse(a.criadoEm) - Date.parse(b.criadoEm))
      .map(naTela),
    prontos: doBalcao
      .filter((pedido) => pedido.status === "pronto" && ficouPronto(pedido) >= limite)
      .sort((a, b) => ficouPronto(b) - ficouPronto(a))
      .map(naTela),
  }
}

/** Os prontos que a TV ainda não chamou: cada um toca o som uma vez. */
export const chamadasNovas = (
  chamados: ReadonlySet<number>,
  prontos: PedidoNaChamada[],
): PedidoNaChamada[] => prontos.filter((pedido) => !chamados.has(pedido.id))
