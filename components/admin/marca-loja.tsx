"use client"

import { ExternalLinkIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { useConfig } from "@/lib/admin/config"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { buscarSegmento } from "@/lib/admin/segmentos-painel"

/**
 * Topo da barra lateral: a loja do segmento escolhido. Na pizzaria, a loja do protótipo,
 * vale o nome editado em Personalizar loja.
 */
export function MarcaLoja() {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const nomeEditado = useConfig((estado) => estado.config.identidade.nome)
  const info = buscarSegmento(segmento)
  const nome = segmento === "pizzaria" ? nomeEditado : info.loja

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild tooltip="Ver a loja">
          <Link href="/" target="_blank" rel="noopener">
            <Image
              src={info.logo}
              alt={`Logo de ${nome}`}
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-lg object-cover"
            />
            <span className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate font-semibold">{nome}</span>
              <span className="truncate text-xs text-muted-foreground">{info.nome}</span>
            </span>
            <ExternalLinkIcon className="size-4 text-muted-foreground" />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
