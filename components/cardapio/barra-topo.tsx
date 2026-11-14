"use client"

import { ReceiptTextIcon, Share2Icon, StoreIcon } from "lucide-react"
import Link from "next/link"
import { AlternarTema } from "@/components/alternar-tema"
import { Dica } from "@/components/dica"
import { IconeSacola } from "@/components/sacola/ilha-sacola"
import { Button } from "@/components/ui/button"
import { compartilharLoja } from "@/lib/compartilhar"
import { SeletorLoja } from "./seletor-loja"

/** Botões claros sobre a foto escura, iguais nos dois temas. */
const SOBRE_FOTO = "rounded-full text-white hover:bg-white/15 hover:text-white"

/**
 * Ações da loja, por cima da foto. "Pedidos" vem em destaque, como pílula clara;
 * os demais ficam discretos. Os três pontinhos só existem no cabeçalho que gruda.
 */
export function BarraTopo({ aoVerDetalhes }: { aoVerDetalhes: () => void }) {
  return (
    <header className="relative z-10" data-testid="barra-topo">
      <nav
        aria-label="Ações da loja"
        className="mx-auto flex h-14 w-full max-w-[1320px] items-center justify-end gap-0.5 px-2 md:gap-1 md:px-6 2xl:max-w-[1640px]"
      >
        {/* Demonstração: troca entre as lojas de exemplo. */}
        <SeletorLoja className={`${SOBRE_FOTO} mr-auto bg-white/10 ring-1 ring-white/20`} />
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
          className="ml-1 h-11 gap-2 rounded-full bg-white px-5 text-sm font-semibold text-neutral-900 shadow-lg shadow-black/25 hover:-translate-y-0.5 hover:bg-white hover:shadow-xl"
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
