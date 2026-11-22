import type { SegmentoPainelId } from "../segmentos-painel"

/** O canal das abas do painel (e da vitrine da mesa) neste navegador. */
export const CANAL_ADMIN = "clickpedido-admin"

type Aviso = { segmento: SegmentoPainelId }

let canal: BroadcastChannel | null = null
let canalDe: typeof BroadcastChannel | undefined

/**
 * Um canal só por aba, para avisar e ouvir: o canal não recebe o que ele mesmo mandou, então a
 * aba que gravou não se avisa. Sem `BroadcastChannel` no navegador, não há canal.
 */
function oCanal(): BroadcastChannel | null {
  const Canal = globalThis.BroadcastChannel as typeof BroadcastChannel | undefined
  if (Canal !== canalDe) {
    canalDe = Canal
    canal = Canal ? new Canal(CANAL_ADMIN) : null
    // No Node (testes), o canal aberto não segura o processo.
    ;(canal as unknown as { unref?: () => void } | null)?.unref?.()
  }
  return canal
}

/** A base do segmento mudou nesta aba: as outras atualizam na hora. */
export function avisarOutrasAbas(segmento: SegmentoPainelId) {
  oCanal()?.postMessage({ segmento } satisfies Aviso)
}

/** Chama `aoMudar` a cada aviso de outra aba. Devolve a função que para de ouvir. */
export function ouvirOutrasAbas(aoMudar: (segmento: SegmentoPainelId) => void): () => void {
  const atual = oCanal()
  if (!atual) return () => {}
  const ouvir = (evento: MessageEvent<Aviso>) => aoMudar(evento.data.segmento)
  atual.addEventListener("message", ouvir)
  return () => atual.removeEventListener("message", ouvir)
}
