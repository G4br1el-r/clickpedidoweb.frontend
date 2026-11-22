/** Onde este aparelho imprime: pelo navegador, pelo agente de impressão ou em lugar nenhum. */
export type OndeImprime = "navegador" | "agente" | "nenhuma"
export type SituacaoDaImpressora = "online" | "offline" | "sem-impressora"

/**
 * A impressora agora: o navegador está sempre pronto; o agente (simulado, até o back-end)
 * depende de estar ligado; sem impressora, nenhum cupom sai.
 */
export function situacaoDaImpressora({
  impressora,
  agenteLigado,
}: {
  impressora: OndeImprime
  agenteLigado: boolean
}): SituacaoDaImpressora {
  if (impressora === "nenhuma") return "sem-impressora"
  if (impressora === "agente" && !agenteLigado) return "offline"
  return "online"
}

const TEXTOS: Record<SituacaoDaImpressora, string> = {
  online: "Impressora online",
  offline: "Impressora offline",
  "sem-impressora": "Sem impressora",
}

/** O que a barra da fila diz da impressora. */
export const textoDaImpressora = (situacao: SituacaoDaImpressora) => TEXTOS[situacao]
