import { type ReactNode, useId } from "react"
import { Etapa } from "./secoes/sequencia"

/**
 * Bloco plano com título, que também é uma região nomeada: um fio no topo, sem cartão.
 * Dentro de uma `Sequencia` (página, aba), entra na sua vez; fora dela, já aparece inteiro.
 */
export function BlocoSecao({
  titulo,
  descricao,
  acao,
  children,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <Etapa
      como="section"
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-4 border-t border-border/70 pt-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em]">
            {titulo}
          </h2>
          {descricao && <p className="text-[13px] text-muted-foreground">{descricao}</p>}
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </div>
      {children}
    </Etapa>
  )
}
