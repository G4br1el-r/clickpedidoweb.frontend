"use client"

import type { ReactNode } from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useConfigCarregada } from "@/lib/admin/config"
import { useSegmentoCarregado } from "@/lib/admin/segmento-atual"
import { cn } from "@/lib/utils"
import { BarraLateralAdmin } from "./barra-lateral-admin"

/** Estrutura do painel: barra lateral do shadcn e a área principal ao lado. */
export function ShellAdmin({ className, children }: { className?: string; children: ReactNode }) {
  useConfigCarregada()
  useSegmentoCarregado()

  return (
    <SidebarProvider className={cn("bg-background", className)}>
      <BarraLateralAdmin />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}
