"use client"

import Image from "next/image"
import { linkDoTelefone } from "@/lib/contato"
import { useLoja } from "@/lib/loja-atual"

/** Fechamento discreto: a marca, onde fica e como falar com a loja. O resto está em "A loja". */
export function RodapeLoja() {
  const loja = useLoja()

  return (
    <footer data-testid="rodape-loja" className="mt-16 border-t bg-card md:mt-20">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-5 pt-8 pb-28 md:flex-row md:items-center md:justify-between md:px-6 md:pb-8">
        <div className="flex items-center gap-3">
          <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-border">
            <Image src={loja.logo} alt="" fill sizes="44px" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-heading text-base font-bold">{loja.nome}</p>
            <p className="text-muted-foreground">
              {loja.endereco} ·{" "}
              <a
                href={linkDoTelefone(loja.telefone)}
                className="-my-3 inline-flex min-h-11 items-center tabular-nums underline-offset-4 hover:text-foreground hover:underline"
              >
                {loja.telefone}
              </a>
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Pedidos online por <span className="font-semibold text-foreground">ClickPedido</span>
        </p>
      </div>
    </footer>
  )
}
