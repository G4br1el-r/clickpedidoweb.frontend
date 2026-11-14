"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { menuDo } from "@/lib/admin/segmentos-painel"
import { AvisoEstoque } from "./estoque/aviso-estoque"

/** A visão geral só fica ativa na raiz; os outros módulos também nas subpáginas. */
function estaEm(caminho: string, href: string) {
  return href === "/admin" ? caminho === href : caminho === href || caminho.startsWith(`${href}/`)
}

/** Módulos do painel agrupados, só os do segmento escolhido no topo. */
export function MenuModulos() {
  const caminho = usePathname()
  const segmento = useSegmentoAtual((estado) => estado.segmento)

  return menuDo(segmento).map(({ grupo, itens }) => (
    <SidebarGroup key={grupo}>
      <SidebarGroupLabel>{grupo}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {itens.map(({ id, titulo, href, icone: Icone }) => {
            const ativo = estaEm(caminho, href)
            return (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton asChild isActive={ativo} tooltip={titulo}>
                  <Link href={href} aria-current={ativo ? "page" : undefined}>
                    <Icone />
                    <span>{titulo}</span>
                  </Link>
                </SidebarMenuButton>
                {id === "estoque" && <AvisoEstoque />}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ))
}
