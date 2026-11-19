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
import { emReais, formatoMoeda } from "@/lib/formato"
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
  className,
}: {
  rotulo: string
  children: ReactNode
  destaque?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 py-3 2xl:px-5 2xl:first:pl-0", className)}>
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

/** Número animado para quem vê; o valor formatado para leitores de tela e buscas. */
const dinheiroVivo = (valor: number) => (
  <>
    <NumberFlow value={valor} locales="pt-BR" format={formatoMoeda} aria-hidden="true" />
    <span className="sr-only">{emReais(valor)}</span>
  </>
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
      className="flex flex-col gap-3 border-y border-border/70 2xl:flex-row 2xl:items-center 2xl:justify-between"
    >
      {/* Em linha só em tela grande; antes disso, o turno numa linha e os números embaixo. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 2xl:flex 2xl:divide-x 2xl:divide-border/70">
        {/* Fora da tela grande, o turno ocupa a linha toda: o nome e a hora não cabem na coluna. */}
        <Item rotulo="Turno" className="col-span-2 sm:col-span-4 2xl:col-span-1">
          <span className="flex flex-wrap items-center gap-x-2">
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
      <div className="flex flex-wrap gap-2 pb-3 2xl:pb-0">
        <Button type="button" variant="outline" onClick={() => setMovimento(true)}>
          <ArrowLeftRightIcon data-icon="inline-start" />
          Sangria ou suprimento
          <kbd className="ml-1 text-[11px] text-muted-foreground max-lg:hidden">F11</kbd>
        </Button>
        {aoFecharCaixa && (
          <Button type="button" variant="outline" onClick={aoFecharCaixa}>
            <LockIcon data-icon="inline-start" />
            Fechar caixa
            <kbd className="ml-1 text-[11px] text-muted-foreground max-lg:hidden">F12</kbd>
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
