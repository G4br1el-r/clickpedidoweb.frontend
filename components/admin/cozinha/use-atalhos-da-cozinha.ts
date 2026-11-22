"use client"

import { useEffect, useEffectEvent, useRef } from "react"
import { type Direcao, vizinhoNoQuadro } from "@/lib/admin/regras/atalhos"
import type { StatusTicket } from "@/lib/admin/regras/cozinha"

const SETAS: Record<string, Direcao> = {
  ArrowLeft: "esquerda",
  ArrowRight: "direita",
  ArrowUp: "cima",
  ArrowDown: "baixo",
}

/** O ticket com o foco do teclado: o `data-ticket` dele, ou nenhum. */
const ticketEmFoco = () =>
  (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-ticket]")?.dataset
    .ticket ?? null

/**
 * O ticket na tela. Ao mudar de coluna, o da coluna antiga fica um instante saindo: o
 * status diz qual dos dois é o de agora.
 */
const doTicket = (id: string, status?: StatusTicket) =>
  document.querySelector<HTMLElement>(
    `[data-ticket="${CSS.escape(id)}"]${status ? `[data-status="${status}"]` : ""}`,
  )

/**
 * Atalhos do quadro, só no desktop: as setas movem o foco entre os tickets (← → colunas,
 * ↑ ↓ na coluna); Enter avança o ticket em foco, e o foco vai com ele; P liga a
 * prioridade; 1 a 9 riscam os itens; Z desfaz; ? abre a lista.
 */
export function useAtalhosDaCozinha({
  ligado,
  grade,
  aoAvancar,
  aoPriorizar,
  aoRiscar,
  aoDesfazer,
  aoAjuda,
}: {
  ligado: boolean
  grade: string[][]
  /** Avança o ticket; diz para que status ele foi, ou `null` se não andou. */
  aoAvancar: (id: string) => StatusTicket | null
  /** Liga ou desliga a prioridade. */
  aoPriorizar: (id: string) => void
  /** Risca (ou desrisca) o item da linha `posicao`, contando de 1. */
  aoRiscar: (id: string, posicao: number) => void
  /** Z: o Desfazer do último aviso que ainda está na tela. */
  aoDesfazer: () => void
  /** ?: abre a lista dos atalhos. */
  aoAjuda: () => void
}) {
  // O ticket que acabou de andar: o foco vai atrás dele na coluna nova.
  const seguir = useRef<{ id: string; status: StatusTicket } | null>(null)
  useEffect(() => {
    if (!seguir.current) return
    const novo = doTicket(seguir.current.id, seguir.current.status)
    if (!novo) return
    novo.focus()
    seguir.current = null
  })

  const aoTeclar = useEffectEvent((evento: KeyboardEvent) => {
    const atual = ticketEmFoco()
    const direcao = SETAS[evento.key]
    if (direcao) {
      const destino = vizinhoNoQuadro(grade, atual, direcao)
      if (!destino) return
      evento.preventDefault()
      doTicket(destino)?.focus()
      return
    }
    if (evento.key === "?") {
      aoAjuda()
      return
    }
    if (evento.key.toLowerCase() === "z") {
      aoDesfazer()
      return
    }
    // Só com o foco no próprio ticket: num botão dele, o Enter é do botão.
    if (!atual || (document.activeElement as HTMLElement).dataset.ticket !== atual) return
    if (evento.key === "Enter") {
      evento.preventDefault()
      const para = aoAvancar(atual)
      if (para) seguir.current = { id: atual, status: para }
    } else if (evento.key.toLowerCase() === "p") {
      aoPriorizar(atual)
    } else if (/^[1-9]$/.test(evento.key)) {
      aoRiscar(atual, Number(evento.key))
    }
  })
  useEffect(() => {
    if (!ligado) return
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [ligado])
}
