"use client"

import { ReceiptTextIcon, Share2Icon, StoreIcon } from "lucide-react"
import Link from "next/link"
import { AlternarTema } from "@/components/alternar-tema"
import { Dica } from "@/components/dica"
import { IconeSacola } from "@/components/sacola/ilha-sacola"
import { Button } from "@/components/ui/button"
import { compartilharLoja } from "@/lib/compartilhar"
import { SeletorLoja } from "./seletor-loja"

/** Botões claros sobre a foto da loja, iguais nos dois temas. */
const SOBRE_FOTO = "rounded-full text-white hover:bg-white/15 hover:text-white"

/**
 * Ações da loja sobre a foto. "Pedidos" é o único contornado; os demais ficam discretos.
 * Os três pontinhos só existem no cabeçalho que gruda.
 */
export function BarraTopo({ aoVerDetalhes }: { aoVerDetalhes: () => void }) {
  return (
    <header className="relative z-10" data-testid="barra-topo">
      <nav
        aria-label="Ações da loja"
        className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-end gap-0.5 px-2 md:gap-1 md:px-6"
      >
        {/* Demonstração: troca entre as lojas de exemplo. */}
        <SeletorLoja className={`${SOBRE_FOTO} mr-auto bg-white/10 ring-1 ring-white/25`} />
        <Dica texto="Sobre a loja">
          <Button
            type="button"
            variant="ghost"
            size="toque"
            className={`${SOBRE_FOTO} md:w-auto md:gap-2 md:px-3.5`}
            aria-label="A loja"
            onClick={aoVerDetalhes}
          >
            <StoreIcon />
            <span className="hidden md:inline">A loja</span>
          </Button>
        </Dica>
        <Dica texto="Compartilhar a loja">
          <Button
            type="button"
            variant="ghost"
            size="toque"
            className={`${SOBRE_FOTO} md:w-auto md:gap-2 md:px-3.5`}
            aria-label="Compartilhar"
            onClick={() => void compartilharLoja()}
          >
            <Share2Icon />
            <span className="hidden md:inline">Compartilhar</span>
          </Button>
        </Dica>
        <AlternarTema className={SOBRE_FOTO} />
        <Button
          asChild
          variant="outline"
          className="ml-1 h-11 gap-2 rounded-full border-white/35 bg-transparent px-4 text-sm font-medium text-white hover:bg-white/15 hover:text-white dark:border-white/35 dark:bg-transparent dark:hover:bg-white/15"
        >
          <Link href="/pedidos">
            <ReceiptTextIcon data-icon="inline-start" />
            Pedidos
          </Link>
        </Button>
        <span className="ml-1.5">
          <IconeSacola origemIcone="topo" />
        </span>
      </nav>
    </header>
  )
}
