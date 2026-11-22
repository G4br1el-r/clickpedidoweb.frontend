"use client"

import { useEffect, useEffectEvent } from "react"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { acaoDaTecla, type Seta, vizinho } from "@/lib/admin/regras/atalhos-fila"

type Acoes = {
  avancar: (pedido: Pedido) => void
  aceitar: (pedido: Pedido) => void
  imprimir: (pedido: Pedido) => void
  ajuda: () => void
}

/** O alvo é um campo de texto (ou está numa janela): a tecla é da pessoa digitando, não da fila. */
function digitando(alvo: EventTarget | null) {
  if (!(alvo instanceof HTMLElement)) return false
  return Boolean(
    alvo.closest(
      "input, textarea, select, [contenteditable=true], [role=dialog], [role=alertdialog]",
    ),
  )
}

const cartaoDe = (elemento: Element | null) =>
  elemento?.closest<HTMLElement>("[data-pedido-id]") ?? null

/**
 * Atalhos de teclado da fila, no computador: setas andam pelos cartões, Enter avança, A aceita,
 * R recusa (abre os motivos), P imprime, / busca e ? abre a ajuda.
 */
export function useAtalhosDaFila({
  ativo,
  colunas,
  pedidos,
  acoes,
}: {
  ativo: boolean
  /** Ids dos cartões de cada coluna, na ordem da tela. */
  colunas: number[][]
  pedidos: Pedido[]
  acoes: Acoes
}) {
  const aoTeclar = useEffectEvent((evento: KeyboardEvent) => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey || digitando(evento.target)) return
    const acao = acaoDaTecla(evento.key)
    if (!acao) return
    const emFoco = cartaoDe(document.activeElement)
    const pedido = pedidos.find((item) => item.id === Number(emFoco?.dataset.pedidoId))

    switch (acao) {
      case "mover": {
        const destino = vizinho(colunas, pedido?.id ?? null, evento.key as Seta)
        const cartao = document.querySelector<HTMLElement>(`[data-pedido-id="${destino}"]`)
        if (!cartao) return
        evento.preventDefault()
        cartao.focus()
        return
      }
      case "buscar": {
        evento.preventDefault()
        document.querySelector<HTMLInputElement>('input[aria-label="Buscar pedido"]')?.focus()
        return
      }
      case "ajuda":
        evento.preventDefault()
        acoes.ajuda()
        return
    }
    // As outras ações valem para o cartão em foco (e não para um botão dentro dele, no Enter).
    if (!pedido || !emFoco) return
    if (acao === "avancar") {
      if (document.activeElement !== emFoco || pedido.esperaAceite) return
      evento.preventDefault()
      acoes.avancar(pedido)
    } else if (acao === "aceitar" && pedido.esperaAceite) {
      acoes.aceitar(pedido)
    } else if (acao === "recusar" && pedido.esperaAceite) {
      // O mesmo botão do cartão: abre os motivos.
      emFoco.querySelector<HTMLButtonElement>("[data-acao=recusar]")?.click()
    } else if (acao === "imprimir") {
      acoes.imprimir(pedido)
    }
  })

  useEffect(() => {
    if (!ativo) return
    const ouvir = (evento: KeyboardEvent) => aoTeclar(evento)
    window.addEventListener("keydown", ouvir)
    return () => window.removeEventListener("keydown", ouvir)
  }, [ativo])
}
