"use client"

import { LockIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty"

/**
 * O turno é de outra pessoa do caixa: quem está usando o painel não vende, não faz
 * sangria nem fecha. Volta a operar quem abriu, um gerente ou o dono.
 */
export function CaixaDeOutraPessoa({
  operador,
  aoVerHistorico,
}: {
  operador: string
  aoVerHistorico: () => void
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon />
        </EmptyMedia>
        <h1 className="text-lg font-semibold tracking-[-0.01em]">
          Este caixa está aberto por {operador}
        </h1>
        <EmptyDescription>
          Só {operador}, um gerente ou o dono vendem e mexem neste caixa. Troque de usuário no topo
          (Ctrl+U).
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="outline" onClick={aoVerHistorico}>
          Histórico de caixas
        </Button>
      </EmptyContent>
    </Empty>
  )
}
