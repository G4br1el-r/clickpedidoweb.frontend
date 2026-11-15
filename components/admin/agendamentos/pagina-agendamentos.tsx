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
import { CabecalhoPagina } from "../cabecalho-pagina"
import { DetalhesPedido } from "../pedidos/detalhes-pedido"
import { usePedidoAberto } from "../pedidos/estado-lista"
import { Indicador } from "../regua"
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

/** Régua de três fatos, como a da visão geral: lado a lado entre fios, sem cartões. */
const REGUA =
  "grid grid-cols-3 border-y border-border/70 *:border-border/70 *:px-3 sm:*:px-4 [&>*:first-child]:pl-0 [&>*:not(:first-child)]:border-l"

function EsqueletoAgenda() {
  return (
    <div role="status" aria-label="Carregando a agenda" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <Skeleton className="h-[40rem] rounded-2xl" />
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
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Agendamentos"
        resumo="Pelo dia do atendimento. Toque num horário para ver os detalhes."
        acoes={
          loja &&
          agora &&
          dia && (
            <NovoAgendamento dia={dia} agora={agora} horarios={loja.horarios} aoMarcar={mudarDia} />
          )
        }
      />

      <section aria-label="Resumo da agenda">
        <dl className={REGUA}>
          {(
            [
              ["Hoje", resumo?.hoje],
              ["Amanhã", resumo?.amanha],
              ["Próximos 7 dias", resumo?.semana],
            ] as const
          ).map(([titulo, contagem]) => (
            <Indicador
              key={titulo}
              rotulo={titulo}
              detalhe={
                contagem ? (
                  <span className="tabular-nums">
                    <span className="max-sm:hidden">
                      {contagem.quantidade === 1 ? "atendimento" : "atendimentos"} ·{" "}
                    </span>
                    {emReais(contagem.total)}
                  </span>
                ) : (
                  <Skeleton className="h-3 w-16" />
                )
              }
            >
              {contagem ? contagem.quantidade : <Skeleton className="h-7 w-8" />}
            </Indicador>
          ))}
        </dl>
      </section>

      {!pedidos || !loja || !agora || !dia ? (
        <EsqueletoAgenda />
      ) : (
        <Tabs defaultValue="dia" className="gap-4">
          {/* Texto da aba inativa mais forte: o padrão não passa no contraste sobre o fundo cinza. */}
          <TabsList>
            <TabsTrigger value="dia" className="text-foreground/80 dark:text-foreground/80">
              Dia
            </TabsTrigger>
            <TabsTrigger value="lista" className="text-foreground/80 dark:text-foreground/80">
              Lista
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dia">
            <AgendaDoDia
              dia={dia}
              agora={agora}
              pedidos={pedidos}
              horarios={loja.horarios}
              mudarDia={mudarDia}
              aoAbrir={(pedido) => abrirPedido(pedido.id)}
            />
          </TabsContent>
          <TabsContent value="lista">
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
