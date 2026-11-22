"use client"

import { format } from "date-fns"
import { parseAsString, useQueryState } from "nuqs"
import { useEffect, useState } from "react"
import { useAgora } from "@/hooks/use-agora"
import { useCozinha, useLoja } from "@/lib/admin/dados/consultas"
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import {
  type ConfigCozinha,
  colunasDaCozinha,
  minutosNaCozinha,
  TEMPOS_PADRAO,
  type TicketCozinha,
  urgenciaNaCozinha,
} from "@/lib/admin/regras/cozinha"
import type { VisaoDePraca } from "@/lib/admin/regras/pracas"
import { tomDoStatus } from "@/lib/admin/regras/status"
import { paginaDaTv } from "@/lib/admin/regras/telas-cozinha"
import { cn } from "@/lib/utils"
import { RecursoPro } from "../recurso-pro"
import { Traco } from "../traco"
import { nomeDoTicket } from "./ticket-cozinha"

/** O ticket na TV: grande, sem botões, para ler de longe. */
function TicketNaTv({
  ticket,
  agora,
  tempos,
}: {
  ticket: TicketCozinha
  agora: Date
  tempos: ConfigCozinha
}) {
  const pronto = ticket.status === "pronto"
  const nivel = pronto ? "normal" : urgenciaNaCozinha(ticket, agora, tempos)
  return (
    <article
      aria-label={nomeDoTicket(ticket)}
      data-urgencia={nivel}
      className={cn(
        "flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-border",
        nivel === "atencao" && "ring-2 ring-(--tom-preparo)",
        nivel === "atrasado" && "ring-2 ring-(--tom-cancelado)",
        ticket.refazer && "ring-2 ring-(--atencao)",
      )}
    >
      <header className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold">{nomeDoTicket(ticket)}</span>
        {!pronto && (
          <span className="ml-auto text-xl tabular-nums text-muted-foreground">
            {Math.max(0, minutosNaCozinha(ticket, agora, tempos))} min
          </span>
        )}
      </header>
      <ul className="flex flex-col gap-1.5">
        {ticket.itens.map((item) => (
          <li
            key={item.id}
            className={cn("text-2xl", item.feitoEm && "text-muted-foreground line-through")}
          >
            <span className="font-semibold tabular-nums">{item.quantidade}×</span> {item.nome}
            {item.opcoes.length > 0 && (
              <span className="block text-lg text-muted-foreground">{item.opcoes.join(" · ")}</span>
            )}
          </li>
        ))}
      </ul>
    </article>
  )
}

function QuadroNaTv({
  porColuna,
  trocaDePagina,
  intervalo,
}: {
  porColuna: number
  trocaDePagina: number
  intervalo: number
}) {
  const agora = useAgora(15_000)
  const { data: pedidos } = useCozinha(intervalo)
  const { data: loja } = useLoja()
  const { data: produtos = [] } = useProdutos()
  const [pracaId] = useQueryState("praca", parseAsString)
  const [pagina, setPagina] = useState(0)
  useEffect(() => {
    const virar = setInterval(() => setPagina((atual) => atual + 1), trocaDePagina)
    return () => clearInterval(virar)
  }, [trocaDePagina])

  const pracas = loja?.pracas ?? []
  const praca = pracas.find((outra) => outra.id === pracaId)
  const visao: VisaoDePraca | undefined = praca
    ? { pracaId: praca.id, produtos, pracas }
    : undefined
  const tempos: ConfigCozinha = {
    ...(loja?.temposCozinha ?? TEMPOS_PADRAO),
    preparoMin: loja?.prazos?.retirada.min,
  }
  const colunas = pedidos && agora ? colunasDaCozinha(pedidos, "todos", agora, tempos, visao) : null
  const tela = colunas ? paginaDaTv(colunas, pagina, porColuna) : null

  return (
    <main
      aria-label="Cozinha na TV"
      className="fixed inset-0 z-50 flex flex-col gap-6 overflow-hidden bg-background p-8"
    >
      <header className="flex items-baseline gap-4">
        <h1 className="text-3xl font-semibold">Cozinha{praca ? ` · ${praca.nome}` : ""}</h1>
        {tela && tela.total > 1 && (
          <span className="text-lg text-muted-foreground tabular-nums">
            Página {tela.pagina + 1} de {tela.total}
          </span>
        )}
        {agora && (
          <span className="ml-auto text-3xl font-semibold tabular-nums">
            {format(agora, "HH:mm")}
          </span>
        )}
      </header>
      {tela && agora ? (
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-6">
          {tela.colunas.map((coluna, indice) => (
            <section
              key={coluna.id}
              aria-label={`${coluna.titulo}, ${colunas?.[indice].tickets.length ?? 0}`}
              className="flex min-h-0 flex-col gap-4"
            >
              <h2 className="flex items-center gap-3 text-2xl font-semibold">
                <Traco tom={tomDoStatus(coluna.status)} />
                {coluna.titulo}
                <span className="ml-auto text-xl text-muted-foreground tabular-nums">
                  {colunas?.[indice].tickets.length ?? 0}
                </span>
              </h2>
              {coluna.tickets.map((ticket) => (
                <TicketNaTv key={ticket.id} ticket={ticket} agora={agora} tempos={tempos} />
              ))}
            </section>
          ))}
        </div>
      ) : (
        <p role="status" className="text-xl text-muted-foreground">
          Carregando a cozinha…
        </p>
      )}
    </main>
  )
}

/**
 * Modo TV (Pro): o quadro só para ler, em letra grande, na tela inteira. Quando os tickets
 * não cabem, pagina sozinho. A praça vem no endereço (`?praca=`).
 */
export function TvCozinha({
  porColuna = 4,
  trocaDePagina = 8_000,
  intervalo = 4_000,
}: {
  porColuna?: number
  trocaDePagina?: number
  intervalo?: number
}) {
  return (
    <RecursoPro
      chave="cozinha.tv"
      descricao="O quadro em letra grande numa TV da cozinha, só para ler, que pagina sozinho."
    >
      <QuadroNaTv porColuna={porColuna} trocaDePagina={trocaDePagina} intervalo={intervalo} />
    </RecursoPro>
  )
}
