"use client"

import type { ReactNode } from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useConfigCarregada } from "@/lib/admin/config"
import { useSincronizarAbas } from "@/lib/admin/dados/consultas"
import { useSegmentoCarregado } from "@/lib/admin/segmento-atual"
import { cn } from "@/lib/utils"
import { BarraLateralAdmin } from "./barra-lateral-admin"

/** Estrutura do painel: a barra lateral no fundo e a folha de trabalho ao lado. */
export function ShellAdmin({ className, children }: { className?: string; children: ReactNode }) {
  useConfigCarregada()
  useSegmentoCarregado()
  // O que muda numa aba do painel aparece nas outras abas deste navegador.
  useSincronizarAbas()

  return (
    <SidebarProvider className={cn("bg-sidebar", className)}>
      <BarraLateralAdmin />
      {/* A área de trabalho é uma folha sobre o fundo: plana, com fio, sem sombra. */}
      <SidebarInset className="min-w-0 bg-card md:peer-data-[variant=inset]:rounded-2xl md:peer-data-[variant=inset]:shadow-none md:peer-data-[variant=inset]:ring-1 md:peer-data-[variant=inset]:ring-border/70">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
