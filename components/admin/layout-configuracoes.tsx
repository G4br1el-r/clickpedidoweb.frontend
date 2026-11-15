"use client"

import { EyeIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { VARIAVEIS_FONTES } from "@/lib/admin/fontes"
import { buscarSecao } from "@/lib/admin/secoes"
import { cn } from "@/lib/utils"
import { BarraAcoes } from "./barra-acoes"
import { CabecalhoAdmin, type Trilha } from "./cabecalho-admin"
import { usePrevia } from "./previa/estado"
import { Previa } from "./previa/previa"
import { SacolaAdmin } from "./sacola-admin"

/**
 * Estrutura das configurações: ajustes à esquerda, com a barra de aplicar presa
 * embaixo, e a prévia ao vivo à direita. Em telas menores, a prévia abre num
 * painel lateral pelo botão "Prévia".
 */
export function LayoutConfiguracoes({ children }: { children: ReactNode }) {
  const caminho = usePathname()
  const previaAberta = usePrevia((estado) => estado.folhaAberta)
  const setPreviaAberta = usePrevia((estado) => estado.abrirFolha)
  const secao = buscarSecao(caminho.split("/")[3] ?? "")
  const trilha: Trilha = [
    { titulo: "Painel", href: "/admin" },
    { titulo: "Configurações", href: "/admin/configuracoes" },
    ...(secao ? [{ titulo: secao.titulo }] : []),
  ]

  return (
    <>
      <CabecalhoAdmin
        trilha={trilha}
        acoes={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="xl:hidden"
            onClick={() => setPreviaAberta(true)}
          >
            <EyeIcon data-icon="inline-start" />
            Prévia
          </Button>
        }
      />
      <div className="grid flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
        <div className="@container/conteudo flex min-w-0 flex-col px-4 pt-4 md:px-6 md:pt-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">{children}</div>
          <BarraAcoes />
        </div>
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] border-l border-border/70 bg-foreground/[0.02] p-4 xl:flex">
          <Previa className="w-full" />
        </aside>
      </div>
      <Sheet open={previaAberta} onOpenChange={setPreviaAberta}>
        <SheetContent
          side="right"
          className={cn("flex w-full flex-col gap-0 p-0 sm:max-w-[480px]", VARIAVEIS_FONTES)}
        >
          <SheetHeader>
            <SheetTitle>Prévia da loja</SheetTitle>
            <SheetDescription>As mudanças aparecem aqui na hora.</SheetDescription>
          </SheetHeader>
          <Previa className="flex-1 px-4 pb-4" />
        </SheetContent>
      </Sheet>
      <SacolaAdmin />
    </>
  )
}
