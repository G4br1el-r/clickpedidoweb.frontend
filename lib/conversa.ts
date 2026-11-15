import type { Pedido } from "./sacola"
import { textosDoSegmento } from "./segmentos"
import type { Loja } from "./tipos"

/**
 * Regras da conversa simulada no WhatsApp da loja: o que a loja responde ao pedido.
 * Nada aqui fala com o WhatsApp; serve para mostrar ao dono o fluxo completo.
 */
const relogio = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" })

/** A hora que aparece no canto do balão, `minutosDepois` do pedido feito. */
export function horaDaMensagem(criadoEm: number | undefined, minutosDepois = 0) {
  if (criadoEm === undefined) return undefined
  return relogio.format(criadoEm + minutosDepois * 60_000)
}

/** Um instante da conversa: o pedido já foi lido, quantas respostas aparecem, se a loja digita. */
export type MarcoConversa = { em: number; lida: boolean; visiveis: number; digitando: boolean }

const LEITURA_MS = 500
const ATE_DIGITAR_MS = 300
const PAUSA_MS = 400
const MS_POR_LETRA = 18
const DIGITACAO_MIN_MS = 700
const DIGITACAO_MAX_MS = 1400

/** Quanto a loja fica digitando: mais o texto longo, dentro de um limite para não arrastar. */
function tempoDigitando(texto: string) {
  return Math.min(DIGITACAO_MAX_MS, Math.max(DIGITACAO_MIN_MS, texto.length * MS_POR_LETRA))
}

/**
 * O roteiro da conversa no tempo, em ms desde a abertura: a loja lê o pedido, digita e
 * responde uma mensagem por vez, com uma pausa entre elas, como uma pessoa faria.
 */
export function roteiroDaConversa(mensagens: string[]): MarcoConversa[] {
  const marcos: MarcoConversa[] = [
    { em: 0, lida: false, visiveis: 0, digitando: false },
    { em: LEITURA_MS, lida: true, visiveis: 0, digitando: false },
  ]
  let agora = LEITURA_MS + ATE_DIGITAR_MS
  mensagens.forEach((texto, indice) => {
    marcos.push({ em: agora, lida: true, visiveis: indice, digitando: true })
    agora += tempoDigitando(texto)
    marcos.push({ em: agora, lida: true, visiveis: indice + 1, digitando: false })
    agora += PAUSA_MS
  })
  return marcos
}

export function mensagensDaLoja(pedido: Pedido, loja: Loja): string[] {
  return [
    `Recebemos seu pedido nº ${pedido.numero}. Obrigado por escolher a ${loja.nome}!`,
    textosDoSegmento(loja.segmento).preparoConversa,
    pedido.tipo === "retirada"
      ? `Fica pronto em ${loja.retirada.tempo}. Avisamos por aqui quando puder buscar.`
      : `A previsão de entrega é de ${loja.entrega.tempo}. Avisamos por aqui quando sair.`,
  ]
}
