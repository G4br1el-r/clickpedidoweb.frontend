"use client"

import { LockIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { CATALOGO_PRO, useConfig, useOpcaoPro } from "@/lib/admin/config"
import { emReais } from "@/lib/formato"
import { cn } from "@/lib/utils"

/**
 * Recurso de operação do plano Pro: liberado, mostra o conteúdo; com cadeado, mostra o
 * nome, o preço, para que serve e o botão Contratar (o "Liberar todos" da lateral também
 * libera). `compacto` fica no lugar de um botão ou de um campo: o botão desce para a linha
 * de baixo quando o espaço não dá.
 */
export function RecursoPro({
  chave,
  descricao,
  children,
  compacto = false,
}: {
  chave: string
  descricao: string
  children: ReactNode
  compacto?: boolean
}) {
  const { liberada } = useOpcaoPro(chave)
  const contratar = useConfig((estado) => estado.contratar)
  if (liberada) return children
  const { nome, preco } = CATALOGO_PRO[chave]
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap gap-3 rounded-xl border border-dashed border-border",
        compacto ? "items-center p-3" : "flex-col items-start p-5",
      )}
    >
      <span className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1">
        <span className="text-sm font-semibold">
          <LockIcon className="mr-1.5 inline size-3.5 -translate-y-px" aria-hidden="true" />
          {nome} <span className="text-xs font-medium text-muted-foreground">· Pro</span>
        </span>
        <span className="text-[13px] text-muted-foreground">{descricao}</span>
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-auto min-h-8 max-w-full py-1.5 text-left whitespace-normal"
        onClick={() => contratar([chave])}
      >
        Contratar o {nome} · {emReais(preco)}/mês
      </Button>
    </div>
  )
}
