"use client"

import type { ComponentProps, ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type DicaProps = {
  /** Texto curto que diz o que o botão faz. */
  texto: string
  lado?: ComponentProps<typeof TooltipContent>["side"]
  /** Mantém a dica fechada, por exemplo enquanto o painel que o botão abre está aberto. */
  desligada?: boolean
  children: ReactNode
}

/**
 * Tooltip do shadcn para botões só de ícone. Aparece no hover e no foco pelo teclado;
 * no toque, o Radix não abre, então não atrapalha no celular.
 */
export function Dica({ texto, lado = "bottom", desligada = false, children }: DicaProps) {
  return (
    <Tooltip open={desligada ? false : undefined}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={lado} sideOffset={6}>
        {texto}
      </TooltipContent>
    </Tooltip>
  )
}
