"use client"

import type { ReactNode } from "react"
import { Carregador } from "../movimento/carregador"

/**
 * Selo "Ao vivo" do Resumo. Parado, é o ponto verde de sempre (o painel não tem movimento
 * contínuo). Só enquanto confere os pedidos de novo, o ponto vira um radar com ondas: quem
 * olha vê que o número está sendo atualizado agora.
 */
export function AoVivoRadar({
  sincronizando,
  children,
}: {
  sincronizando: boolean
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {sincronizando ? (
        <Carregador
          variante="radar"
          rotulo="Atualizando ao vivo"
          className="size-4 text-(--tom-pronto)"
        />
      ) : (
        <span aria-hidden="true" className="grid size-4 place-items-center">
          <span className="size-2 rounded-full bg-(--tom-pronto)" />
        </span>
      )}
      {children}
    </span>
  )
}
