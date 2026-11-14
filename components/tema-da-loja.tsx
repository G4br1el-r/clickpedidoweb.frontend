"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { LOJAS, useLojaAtual } from "@/lib/loja-atual"

/** Troca o nome de outra loja pelo da escolhida no título da aba. */
function ajustarTitulo(nome: string) {
  for (const { loja } of LOJAS) {
    if (loja.nome !== nome && document.title.includes(loja.nome)) {
      document.title = document.title.replace(loja.nome, nome)
    }
  }
}

/**
 * Mantém a raiz com a loja escolhida (as cores vêm de `cssDasLojas`) e o título da aba com o
 * nome dela. Antes de ler a loja salva não mexe em nada: quem pinta primeiro é o SCRIPT_LOJA.
 * No painel (/admin), as cores são as do painel.
 */
export function TemaDaLoja() {
  const id = useLojaAtual((estado) => estado.id)
  const hidratada = useLojaAtual((estado) => estado.hidratada)
  const caminho = usePathname()

  useEffect(() => {
    if (!hidratada) return
    const raiz = document.documentElement
    const noPainel = caminho.startsWith("/admin")
    if (noPainel || id === LOJAS[0].loja.id) delete raiz.dataset.loja
    else raiz.dataset.loja = id
    if (noPainel) return

    const nome = LOJAS.find(({ loja }) => loja.id === id)?.loja.nome ?? LOJAS[0].loja.nome
    ajustarTitulo(nome)
    // O Next escreve o título da página quando ela chega (e a cada navegação): reaplica.
    const observador = new MutationObserver(() => ajustarTitulo(nome))
    observador.observe(document.head, { subtree: true, childList: true, characterData: true })
    return () => observador.disconnect()
  }, [id, hidratada, caminho])

  return null
}
