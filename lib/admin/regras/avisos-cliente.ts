import type { ConfigLoja, Pedido } from "../dados/tipos"
import { textoDoMotivo } from "./aceite"
import { reaisEmTexto } from "./mensagens"

/** As etapas em que a loja avisa o cliente sozinha. */
export const ETAPAS_DO_AVISO = ["aceito", "saiu", "pronto", "recusado", "pesado", "retirada"] as const
export type EtapaDoAviso = (typeof ETAPAS_DO_AVISO)[number]

/** Os textos de fábrica; a loja edita em Configurações → Fila e pedidos. */
export const AVISOS_DE_FABRICA: Record<EtapaDoAviso, string> = {
  aceito:
    "Olá, {nome}! Seu pedido #{numero} na {loja} foi aceito e já vai para o preparo. Acompanhe: {link}",
  saiu: "Olá, {nome}! Seu pedido #{numero} saiu para entrega. Acompanhe: {link}",
  pronto: "Olá, {nome}! Seu pedido #{numero} está pronto para retirar na {loja}.",
  recusado: "Olá, {nome}. Não conseguimos aceitar seu pedido #{numero}: {motivo}. Desculpe!",
  pesado: "Olá, {nome}! Seu pedido #{numero} foi pesado e o total ficou {total}.",
  retirada:
    "Olá, {nome}! Seu pedido #{numero} tem remédio controlado, que só sai no balcão com a receita retida. Ele fica para retirar na {loja}.",
}

/** O que a loja configurou, com os textos de fábrica no que faltar. Sem configuração, liga. */
export function avisosDaLoja(loja: Pick<ConfigLoja, "avisosCliente">) {
  return {
    ligado: loja.avisosCliente?.ligado ?? true,
    textos: { ...AVISOS_DE_FABRICA, ...loja.avisosCliente?.textos },
  }
}

/** Que aviso a mudança do pedido pede, se pede algum. */
export function avisoDaMudanca(antes: Pedido, depois: Pedido): EtapaDoAviso | null {
  if (depois.status === "cancelado" && antes.status !== "cancelado") {
    return depois.cancelamento?.tipo === "recusa" ? "recusado" : null
  }
  if (antes.esperaAceite && depois.esperaAceite === false) return "aceito"
  // Farmácia: o controlado não sai para entrega.
  if (antes.tipo === "entrega" && depois.tipo === "retirada") return "retirada"
  // Açougue: a balança mudou o total.
  if (depois.pesagem && depois.pesagem.pesadoEm !== antes.pesagem?.pesadoEm) {
    return depois.total === antes.total ? null : "pesado"
  }
  if (depois.status === antes.status) return null
  if (depois.status === "saiu-para-entrega") return "saiu"
  if (depois.status === "pronto" && depois.tipo === "retirada") return "pronto"
  return null
}

/**
 * O texto com os marcadores trocados: {nome} (primeiro nome), {numero}, {loja}, {link},
 * {motivo} e {total}.
 */
export function textoDoAviso(
  modelo: string,
  pedido: Pedido,
  { loja, endereco }: { loja: string; endereco: string },
): string {
  const valores: Record<string, string> = {
    nome: pedido.cliente.nome.split(" ")[0],
    numero: String(pedido.numero),
    loja,
    link: `${endereco}/pedido/${pedido.token}`,
    motivo: pedido.cancelamento ? textoDoMotivo(pedido.cancelamento, pedido.tipo) : "",
    total: reaisEmTexto(pedido.total),
  }
  return modelo.replace(/\{(\w+)\}/g, (marcador, chave: string) => valores[chave] ?? marcador)
}
