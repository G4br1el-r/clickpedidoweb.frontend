"use client"

import { format, isValid, parse, startOfDay } from "date-fns"
import { parseAsString, useQueryState } from "nuqs"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAgora } from "@/hooks/use-agora"
import { useLoja } from "@/lib/admin/dados/consultas"
import { useAgenda } from "@/lib/admin/dados/consultas-agenda"
import { resumoDaAgenda } from "@/lib/admin/regras/agenda"
import { emReais } from "@/lib/formato"
import { DetalhesPedido } from "../pedidos/detalhes-pedido"
import { usePedidoAberto } from "../pedidos/estado-lista"
import { AgendaDoDia } from "./agenda-do-dia"
import { ListaAgenda } from "./lista-agenda"
import { NovoAgendamento } from "./novo-agendamento"

/** Dia aberto na agenda (`?dia=2026-12-01`), no fuso local; sem ele, hoje. */
function useDiaDaAgenda(agora: Date | null) {
  const [texto, setTexto] = useQueryState("dia", parseAsString)
  const lido = texto ? parse(texto, "yyyy-MM-dd", new Date()) : null
  const dia = lido && isValid(lido) ? lido : agora ? startOfDay(agora) : null
  return [dia, (novo: Date) => void setTexto(format(novo, "yyyy-MM-dd"))] as const
}

function Resumo({
  titulo,
  quantidade,
  total,
}: {
  titulo: string
  quantidade: number
  total: number
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border bg-card p-3 sm:p-4">
      <span className="truncate text-xs text-muted-foreground sm:text-sm">{titulo}</span>
      <span className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-2xl font-semibold tabular-nums">{quantidade}</span>
        <span className="text-xs text-muted-foreground sm:text-sm">
          {quantidade === 1 ? "atendimento" : "atendimentos"}
        </span>
      </span>
      <span className="truncate text-xs tabular-nums text-muted-foreground sm:text-sm">
        {emReais(total)}
      </span>
    </div>
  )
}

/** Agenda do salão: resumo, o dia em linha do tempo e a lista com busca. */
export function PaginaAgendamentos() {
  const agora = useAgora(60_000)
  const { data: pedidos } = useAgenda()
  const { data: loja } = useLoja()
  const [dia, mudarDia] = useDiaDaAgenda(agora)
  const [, abrirPedido] = usePedidoAberto()
  const resumo = pedidos && agora ? resumoDaAgenda(pedidos, agora) : null

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            Pelo dia do atendimento. Toque num horário para ver os detalhes.
          </p>
        </div>
        {loja && agora && dia && (
          <div className="ml-auto">
            <NovoAgendamento dia={dia} agora={agora} horarios={loja.horarios} aoMarcar={mudarDia} />
          </div>
        )}
      </div>

      <section aria-label="Resumo da agenda" className="grid grid-cols-3 gap-2 sm:gap-3">
        {resumo ? (
          <>
            <Resumo titulo="Hoje" {...resumo.hoje} />
            <Resumo titulo="Amanhã" {...resumo.amanha} />
            <Resumo titulo="Próximos 7 dias" {...resumo.semana} />
          </>
        ) : (
          [0, 1, 2].map((indice) => <Skeleton key={indice} className="h-24 rounded-xl" />)
        )}
      </section>

      {!pedidos || !loja || !agora || !dia ? (
        <Skeleton role="status" aria-label="Carregando a agenda" className="h-[40rem] rounded-xl" />
      ) : (
        <Tabs defaultValue="dia">
          {/* Texto da aba inativa mais forte: o padrão não passa no contraste sobre o fundo cinza. */}
          <TabsList>
            <TabsTrigger value="dia" className="text-foreground/80 dark:text-foreground/80">
              Dia
            </TabsTrigger>
            <TabsTrigger value="lista" className="text-foreground/80 dark:text-foreground/80">
              Lista
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dia" className="pt-3">
            <AgendaDoDia
              dia={dia}
              agora={agora}
              pedidos={pedidos}
              horarios={loja.horarios}
              mudarDia={mudarDia}
              aoAbrir={(pedido) => abrirPedido(pedido.id)}
            />
          </TabsContent>
          <TabsContent value="lista" className="pt-3">
            <ListaAgenda
              pedidos={pedidos}
              agora={agora}
              aoAbrir={(pedido) => abrirPedido(pedido.id)}
            />
          </TabsContent>
        </Tabs>
      )}

      <DetalhesPedido />
    </div>
  )
}
