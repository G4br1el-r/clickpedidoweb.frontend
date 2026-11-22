import type { ConfigLoja, Pedido } from "../dados/tipos"
import { textoDoMotivo } from "./aceite"

/** As etapas em que a loja avisa o cliente sozinha. */
export const ETAPAS_DO_AVISO = ["aceito", "saiu", "pronto", "recusado"] as const
export type EtapaDoAviso = (typeof ETAPAS_DO_AVISO)[number]

/** Os textos de fábrica; a loja edita em Configurações → Fila e pedidos. */
export const AVISOS_DE_FABRICA: Record<EtapaDoAviso, string> = {
  aceito:
    "Olá, {nome}! Seu pedido #{numero} na {loja} foi aceito e já vai para o preparo. Acompanhe: {link}",
  saiu: "Olá, {nome}! Seu pedido #{numero} saiu para entrega. Acompanhe: {link}",
  pronto: "Olá, {nome}! Seu pedido #{numero} está pronto para retirar na {loja}.",
  recusado: "Olá, {nome}. Não conseguimos aceitar seu pedido #{numero}: {motivo}. Desculpe!",
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
  if (depois.status === antes.status) return null
  if (depois.status === "saiu-para-entrega") return "saiu"
  if (depois.status === "pronto" && depois.tipo === "retirada") return "pronto"
  return null
}

/** O texto com os marcadores trocados: {nome} (primeiro nome), {numero}, {loja}, {link}, {motivo}. */
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
  }
  return modelo.replace(/\{(\w+)\}/g, (marcador, chave: string) => valores[chave] ?? marcador)
}
