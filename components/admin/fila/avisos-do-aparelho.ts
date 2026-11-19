import type { Pedido } from "@/lib/admin/dados/tipos"
import type { ChaveDoAparelho } from "@/lib/admin/preferencias-fila"
import { textoDaNotificacao } from "@/lib/admin/regras/aparelho"

type Avisos = { notificar: boolean; vibrar: boolean }

/** Duas batidas curtas: dá para sentir no bolso sem confundir com ligação. */
const VIBRACAO = [200, 100, 200]

/**
 * O que este aparelho faz quando chega pedido, além do som: vibra (no celular) e manda a
 * notificação do sistema, só com a aba escondida (à vista, a fila já mostra) e com a licença
 * do navegador.
 */
export function avisarChegada(chegaram: Pedido[], { notificar, vibrar }: Avisos) {
  if (chegaram.length === 0) return
  if (vibrar && typeof navigator.vibrate === "function") navigator.vibrate(VIBRACAO)
  const podeNotificar =
    notificar &&
    document.hidden &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  if (!podeNotificar) return
  for (const pedido of chegaram) {
    const { titulo, corpo } = textoDaNotificacao(pedido)
    new Notification(titulo, { body: corpo, tag: `pedido-${pedido.id}` })
  }
}

/**
 * Pede ao navegador o que o aviso precisa para funcionar. Devolve por que não deu (para
 * mostrar embaixo da chave) ou `null` quando pode ligar.
 */
export async function pedirLicenca(chave: ChaveDoAparelho): Promise<string | null> {
  if (chave === "notificar") {
    if (typeof Notification === "undefined") return "Este navegador não mostra notificações."
    if (Notification.permission === "granted") return null
    const resposta = await Notification.requestPermission()
    return resposta === "granted"
      ? null
      : "O navegador bloqueou as notificações. Libere nas configurações do site."
  }
  return null
}
