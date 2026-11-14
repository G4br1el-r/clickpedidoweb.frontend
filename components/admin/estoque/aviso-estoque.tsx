"use client"

import { SidebarMenuBadge } from "@/components/ui/sidebar"
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import { resumoDoEstoque } from "@/lib/admin/regras/estoque"
import { plural } from "@/lib/formato"

/** Número ao lado do Estoque no menu: quantos produtos pedem reposição. */
export function AvisoEstoque() {
  const { data: produtos } = useProdutos()
  if (!produtos) return null
  const { baixos, zerados } = resumoDoEstoque(produtos)
  const total = baixos + zerados
  if (total === 0) return null
  return (
    <SidebarMenuBadge>
      <span aria-hidden="true">{total}</span>
      <span className="sr-only">{plural(total, "produto", "produtos")} para repor</span>
    </SidebarMenuBadge>
  )
}
