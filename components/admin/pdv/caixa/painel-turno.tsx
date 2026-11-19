"use client"

import NumberFlow from "@number-flow/react"
import { differenceInMinutes, format } from "date-fns"
import { ArrowLeftRightIcon, LockIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { Button } from "@/components/ui/button"
import { useAgora } from "@/hooks/use-agora"
import { useLoja } from "@/lib/admin/dados/consultas"
import { useCaixaAtual, useResumoTurno } from "@/lib/admin/dados/consultas-caixa"
import { useEquipe } from "@/lib/admin/dados/consultas-equipe"
import { configPdv, precisaSangria } from "@/lib/admin/regras/caixa"
import { formatoMoeda } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { JanelaMovimento } from "./janela-movimento"

/** "Desde 08:02 · 4h12" */
function desde(abertoEm: string, agora: Date | null) {
  const inicio = new Date(abertoEm)
  const minutos = Math.max(0, differenceInMinutes(agora ?? inicio, inicio))
  const duracao = `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, "0")}`
  return `Desde ${format(inicio, "HH:mm")} · ${duracao}`
}

function Item({
  rotulo,
  children,
  destaque = false,
}: {
  rotulo: string
  children: ReactNode
  destaque?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 py-3 sm:px-5 sm:first:pl-0">
      <span className="text-[13px] text-muted-foreground">{rotulo}</span>
      <span
        className={cn(
          "truncate font-semibold tabular-nums tracking-[-0.01em]",
          destaque ? "text-xl" : "text-base",
        )}
      >
        {children}
      </span>
    </div>
  )
}

const dinheiroVivo = (valor: number) => (
  <NumberFlow value={valor} locales="pt-BR" format={formatoMoeda} />
)

/**
 * Painel do turno, em cima da venda: quem está no caixa, as vendas, o total, o
 * ticket médio e o dinheiro na gaveta, com o alerta de sangria. `F11` abre a
 * sangria ou o suprimento e `F12` leva ao fechamento.
 */
export function PainelTurno({ aoFecharCaixa }: { aoFecharCaixa?: () => void }) {
  const agora = useAgora(60_000)
  const { data: turno } = useCaixaAtual()
  const { data: resumo } = useResumoTurno(turno?.id)
  const { data: loja } = useLoja()
  const { data: equipe = [] } = useEquipe()
  const [movimento, setMovimento] = useState(false)

  useHotkeys("f11", () => setMovimento(true), {
    preventDefault: true,
    enableOnFormTags: true,
    useKey: true,
  })
  useHotkeys("f12", () => aoFecharCaixa?.(), {
    preventDefault: true,
    enableOnFormTags: true,
    useKey: true,
  })

  if (!turno) return null
  const operador = equipe.find((membro) => membro.id === turno.abertoPor)?.nome ?? "…"
  const alerta = Boolean(resumo && loja && precisaSangria(resumo, configPdv(loja)))

  return (
    <section
      aria-label="Turno do caixa"
      className="flex flex-col gap-3 border-y border-border/70 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="grid grid-cols-2 sm:flex sm:divide-x sm:divide-border/70">
        <Item rotulo="Turno">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-4 w-[3px] shrink-0 rounded-full bg-(--tom-pronto)"
            />
            {operador}
            <span className="text-[13px] font-normal text-muted-foreground">
              {desde(turno.abertoEm, agora)}
            </span>
          </span>
        </Item>
        <Item rotulo="Vendas">{resumo?.vendas ?? 0}</Item>
        <Item rotulo="Total vendido">{dinheiroVivo(resumo?.total ?? 0)}</Item>
        <Item rotulo="Ticket médio">{dinheiroVivo(resumo?.ticketMedio ?? 0)}</Item>
        <Item rotulo="Dinheiro na gaveta" destaque>
          <span className="flex items-center gap-2">
            {alerta && (
              <span
                aria-hidden="true"
                className="h-5 w-[3px] shrink-0 rounded-full bg-(--atencao)"
              />
            )}
            {dinheiroVivo(resumo?.dinheiroNaGaveta ?? turno.fundo)}
            {alerta && (
              <span className="text-[13px] font-medium text-(--atencao)">Sangria recomendada</span>
            )}
          </span>
        </Item>
      </div>
      <div className="flex gap-2 pb-3 lg:pb-0">
        <Button type="button" variant="outline" onClick={() => setMovimento(true)}>
          <ArrowLeftRightIcon data-icon="inline-start" />
          Sangria ou suprimento
          <kbd className="ml-1 text-[11px] text-muted-foreground">F11</kbd>
        </Button>
        {aoFecharCaixa && (
          <Button type="button" variant="outline" onClick={aoFecharCaixa}>
            <LockIcon data-icon="inline-start" />
            Fechar caixa
            <kbd className="ml-1 text-[11px] text-muted-foreground">F12</kbd>
          </Button>
        )}
      </div>
      {movimento && (
        <JanelaMovimento
          dinheiroNaGaveta={resumo?.dinheiroNaGaveta ?? turno.fundo}
          aoFechar={() => setMovimento(false)}
        />
      )}
    </section>
  )
}
