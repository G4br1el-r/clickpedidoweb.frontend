import { format } from "date-fns"
import type { ConfigLoja, PausaPedidos } from "../dados/tipos"
import { lojaAbertaAgora } from "./loja"

/** A pausa que vale agora. Passou da hora, a loja volta sozinha. */
export function pausaAtiva(loja: Pick<ConfigLoja, "pausa">, agora: Date): PausaPedidos | undefined {
  return loja.pausa && Date.parse(loja.pausa.ate) > agora.getTime() ? loja.pausa : undefined
}

/** "Loja pausada até 20:45 · 15 min": o estado na barra da fila. */
export function textoDaPausa(pausa: PausaPedidos, agora: Date): string {
  const faltam = Math.max(1, Math.ceil((Date.parse(pausa.ate) - agora.getTime()) / 60_000))
  const oque = pausa.so === "loja" ? "Loja" : "Entrega"
  return `${oque} pausada até ${format(new Date(pausa.ate), "HH:mm")} · ${faltam} min`
}

/** O que o cliente vê no topo da loja. A pausa da loja toda fecha os pedidos até a hora. */
export function textoDaVitrine(loja: ConfigLoja, agora: Date): { aberta: boolean; texto: string } {
  if (!lojaAbertaAgora(loja, agora)) return { aberta: false, texto: "Fechado agora" }
  const pausa = pausaAtiva(loja, agora)
  const volta = pausa && format(new Date(pausa.ate), "HH:mm")
  if (pausa?.so === "loja") return { aberta: false, texto: `Loja ocupada, volte às ${volta}` }
  if (pausa?.so === "entrega")
    return { aberta: true, texto: `Aberto agora · entrega volta às ${volta}` }
  return { aberta: true, texto: "Aberto agora" }
}
