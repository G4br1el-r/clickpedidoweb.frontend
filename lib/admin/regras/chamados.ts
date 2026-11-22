import { isSameDay } from "date-fns"
import type { Chamado, PedidoQr } from "../dados/tipos"

/** Os chamados que esperam alguém, do mais antigo para o mais novo. */
export function chamadosAbertos(chamados: Chamado[]): Chamado[] {
  return chamados
    .filter((chamado) => !chamado.atendidoEm)
    .toSorted((a, b) => Date.parse(a.criadoEm) - Date.parse(b.criadoEm))
}

const TEXTOS: Record<Chamado["tipo"], string> = {
  garcom: "Chamou o garçom",
  conta: "Chamou para a conta",
}

export function textoDoChamado(tipo: Chamado["tipo"]): string {
  return TEXTOS[tipo]
}

/** O selo do que está aberto na mesa, do mais forte ao mais fraco: pedido, conta, garçom. */
export function seloDaMesa(
  chamados: Chamado[] | undefined,
  pedidos: PedidoQr[] | undefined,
): string | null {
  if (pedidos?.length) return "Pedido pelo QR"
  const abertos = chamadosAbertos(chamados ?? [])
  if (abertos.some((chamado) => chamado.tipo === "conta")) return TEXTOS.conta
  return abertos.length > 0 ? TEXTOS.garcom : null
}

/**
 * Tempo médio entre o chamado e o "Atender", em minutos arredondados, dos chamados atendidos
 * hoje. Sem nenhum, `null` (a tela mostra "—").
 */
export function tempoMedioDeAtendimento(chamados: Chamado[], agora: Date): number | null {
  const tempos = chamados.flatMap((chamado) =>
    chamado.atendidoEm && isSameDay(new Date(chamado.atendidoEm), agora)
      ? [Date.parse(chamado.atendidoEm) - Date.parse(chamado.criadoEm)]
      : [],
  )
  if (tempos.length === 0) return null
  const media = tempos.reduce((soma, tempo) => soma + tempo, 0) / tempos.length
  return Math.round(media / 60_000)
}
