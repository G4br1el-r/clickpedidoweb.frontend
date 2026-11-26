"use client"

import { PrinterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Carregador } from "../movimento/carregador"

/**
 * "Imprimir" da visão geral. Enquanto a folha é preparada, o ícone vira o papel saindo da
 * impressora e o botão não aceita outro clique; o texto continua o mesmo, então a largura
 * não muda. No celular tem 44 px de altura.
 */
export function BotaoImprimir({
  imprimindo,
  desabilitado = false,
  aoClicar,
}: {
  imprimindo: boolean
  desabilitado?: boolean
  aoClicar: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("max-md:min-h-11", imprimindo && "disabled:opacity-100")}
      aria-busy={imprimindo || undefined}
      disabled={desabilitado || imprimindo}
      onClick={aoClicar}
    >
      {imprimindo ? (
        <Carregador variante="papel" rotulo="Preparando a impressão" className="size-4" />
      ) : (
        <PrinterIcon data-icon="inline-start" />
      )}
      Imprimir
    </Button>
  )
}
