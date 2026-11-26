"use client"

import type { ReactNode } from "react"
import { Sequencia } from "../secoes/sequencia"

/**
 * Troca de aba: a nova ocupa o lugar da antiga no mesmo instante e as seções dela (`Etapa`)
 * sobem uma depois da outra. Não espera a saída da antiga (um `AnimatePresence` em modo
 * "wait" deixava o conteúdo novo preso enquanto a animação anterior não terminava). A chave
 * também muda quando o esqueleto dá lugar ao conteúdo.
 */
export function TrocaDeAba({ chave, children }: { chave: string; children: ReactNode }) {
  return <Sequencia key={chave}>{children}</Sequencia>
}
