"use client"

import Link from "next/link"
import { Fragment, type ReactNode } from "react"
import { AlternarTema } from "@/components/alternar-tema"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

export type Trilha = { titulo: string; href?: string }[]

/** Topo de cada página do painel: abre e fecha a barra lateral, mostra onde você está e as ações. */
export function CabecalhoAdmin({ trilha, acoes }: { trilha: Trilha; acoes?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {trilha.map((item, indice) => {
            const ultimo = indice === trilha.length - 1
            return (
              <Fragment key={item.titulo}>
                {indice > 0 && <BreadcrumbSeparator className="hidden sm:block" />}
                <BreadcrumbItem className={ultimo ? "min-w-0" : "hidden sm:inline-flex"}>
                  {ultimo || !item.href ? (
                    <BreadcrumbPage className="truncate">{item.titulo}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={item.href}>{item.titulo}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {acoes}
        <AlternarTema />
      </div>
    </header>
  )
}
