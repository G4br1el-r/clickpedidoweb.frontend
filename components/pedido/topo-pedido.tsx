"use client"

import { ArrowLeftIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { AlternarTema } from "@/components/alternar-tema"
import { Dica } from "@/components/dica"
import { Button } from "@/components/ui/button"
import { useLoja } from "@/lib/loja-atual"

/**
 * Topo das telas do pedido: voltar, a marca da loja e, do lado, o que a tela precisar dizer.
 * Plano, no fundo da loja, com um fio embaixo; a atenção fica no conteúdo.
 */
export function TopoPedido({ children }: { children?: ReactNode }) {
  const loja = useLoja()

  return (
    <header className="border-b border-border/70">
      <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-1 px-2 md:h-16 md:px-6">
        <Dica texto="Voltar ao cardápio">
          <Button asChild variant="ghost" size="toque" className="rounded-full">
            <Link href="/" aria-label="Voltar ao cardápio">
              <ArrowLeftIcon />
            </Link>
          </Button>
        </Dica>
        <span className="relative ml-1 size-8 shrink-0 overflow-hidden rounded-[10px] bg-white ring-1 ring-border/70">
          <Image src={loja.logo} alt="" fill sizes="32px" />
        </span>
        <p className="ml-2 min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em]">
          {loja.nome}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {children}
          <AlternarTema />
        </div>
      </div>
    </header>
  )
}
