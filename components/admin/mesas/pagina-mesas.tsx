"use client"

import NumberFlow from "@number-flow/react"
import { ArmchairIcon } from "lucide-react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import { useState } from "react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useAgora } from "@/hooks/use-agora"
import { useFila } from "@/lib/admin/dados/consultas"
import { useMesas } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { estadoDaMesa } from "@/lib/admin/regras/mesas"
import { emReais, formatoMoeda, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { RadarAoVivo } from "../entrega/atualizando"
import { BlocoEntrando, ItemEntrando } from "../movimento/entrada-admin"
import { Traco } from "../traco"
import { ComandaMesa } from "./comanda-mesa"
import { EsqueletoMesas, GRADE_DE_MESAS } from "./esqueleto-mesas"
import { NovaMesa } from "./nova-mesa"

/** "25 min" ou "1 h 05". */
function tempoDesde(inicio: string, agora: Date) {
  const minutos = Math.max(0, Math.floor((agora.getTime() - Date.parse(inicio)) / 60_000))
  if (minutos < 60) return `${minutos} min`
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")}`
}

const nomePadrao = (mesa: Mesa) => mesa.nome === `Mesa ${String(mesa.numero).padStart(2, "0")}`

function CartaoMesa({
  mesa,
  comanda,
  agora,
  aoAbrir,
}: {
  mesa: Mesa
  comanda: Pedido | undefined
  agora: Date | null
  aoAbrir: () => void
}) {
  const ocupada = mesa.status === "ocupada"
  const estado = estadoDaMesa(mesa, comanda)
  const itens = comanda?.itens.reduce((soma, item) => soma + item.quantidade, 0) ?? 0
  return (
    <button
      type="button"
      onClick={aoAbrir}
      aria-labelledby={`mesa-${mesa.id}`}
      aria-describedby={`mesa-${mesa.id}-detalhes`}
      className={cn(
        "flex h-full min-h-32 w-full cursor-pointer flex-col gap-1.5 rounded-xl p-3 text-left outline-none",
        "transition-[transform,box-shadow,background-color] duration-150 ease-saida active:scale-[0.98] motion-reduce:transition-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        ocupada
          ? "bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-border/80 hover:ring-foreground/25"
          : "bg-foreground/[0.03] hover:bg-foreground/[0.06]",
      )}
    >
      <span className="flex items-center gap-2">
        <span id={`mesa-${mesa.id}`} className="text-[15px] font-semibold">
          Mesa {mesa.numero}
        </span>
        <span
          className={cn(
            "ml-auto flex items-center gap-1.5 text-xs font-medium",
            !ocupada && "text-muted-foreground",
          )}
        >
          <Traco tom={estado.tom} />
          {estado.rotulo}
        </span>
      </span>
      <span id={`mesa-${mesa.id}-detalhes`} className="sr-only">
        {[estado.rotulo, mesa.clienteNome, comanda ? emReais(comanda.total) : null]
          .filter(Boolean)
          .join(", ")}
      </span>
      {!nomePadrao(mesa) && (
        <span className="-mt-1 truncate text-xs text-muted-foreground">{mesa.nome}</span>
      )}
      {ocupada ? (
        <>
          <span className="truncate text-sm font-medium">{mesa.clienteNome}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground tabular-nums">
            {mesa.ocupadaEm && agora && <span>{tempoDesde(mesa.ocupadaEm, agora)}</span>}
            {mesa.ocupadaEm && agora && comanda?.mesa?.garcom && <span aria-hidden="true">·</span>}
            {comanda?.mesa?.garcom && <span>Garçom {comanda.mesa.garcom}</span>}
          </span>
          {comanda && (
            <span className="mt-auto flex items-baseline justify-between gap-2 border-t border-border/70 pt-2">
              <span className="text-xs text-muted-foreground">
                {plural(itens, "item", "itens")}
              </span>
              <NumberFlow
                value={comanda.total}
                locales="pt-BR"
                format={formatoMoeda}
                className="text-[15px] font-semibold tabular-nums"
              />
            </span>
          )}
        </>
      ) : (
        <span className="mt-auto text-xs text-muted-foreground">Toque para ver</span>
      )}
    </button>
  )
}

/** Mesas do salão: grade de livres e ocupadas e a comanda de cada uma. */
export function PaginaMesas() {
  const { data: mesas, isFetching: sincronizandoMesas } = useMesas()
  const { data: fila, isFetching: sincronizandoFila } = useFila()
  const semMovimento = useReducedMotion() ?? false
  const agora = useAgora(30_000)
  const [abertaId, setAbertaId] = useState<string | null>(null)

  const comandas = new Map(
    (fila ?? []).filter((pedido) => pedido.tipo === "mesa").map((p) => [p.id, p]),
  )
  const comandaDa = (mesa: Mesa) =>
    mesa.pedidoAtivoId ? comandas.get(mesa.pedidoAtivoId) : undefined
  const ocupadas = mesas?.filter((mesa) => mesa.status === "ocupada").length ?? 0
  const naCozinha =
    mesas?.filter((mesa) => estadoDaMesa(mesa, comandaDa(mesa)).tom === "preparo").length ?? 0
  const aberta = mesas?.find((mesa) => mesa.id === abertaId) ?? null

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Mesas"
        vivo
        resumo={
          mesas
            ? [
                plural(ocupadas, "ocupada", "ocupadas"),
                plural(mesas.length - ocupadas, "livre", "livres"),
                naCozinha > 0 ? `${naCozinha} com rodada na cozinha` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Carregando as mesas…"
        }
        acoes={
          <>
            {/* Ao vivo: as mesas e as comandas conferem com o servidor de tempos em tempos. */}
            <RadarAoVivo
              ativo={Boolean(mesas) && (sincronizandoMesas || sincronizandoFila)}
              rotulo="Sincronizando as mesas"
            />
            <NovaMesa />
          </>
        }
      />

      {!mesas ? (
        <EsqueletoMesas />
      ) : mesas.length === 0 ? (
        <BlocoEntrando>
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ArmchairIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma mesa cadastrada</EmptyTitle>
              <EmptyDescription>
                Crie as mesas do salão em Nova mesa para o garçom lançar os pedidos.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </BlocoEntrando>
      ) : (
        <ul aria-label="Mesas" className={GRADE_DE_MESAS}>
          {/* As mesas entram em sequência na primeira vez; mesa criada ou excluída entra e sai. */}
          <AnimatePresence>
            {mesas.map((mesa, indice) => (
              <ItemEntrando
                key={mesa.id}
                como="li"
                indice={indice}
                layout={semMovimento ? false : "position"}
              >
                <CartaoMesa
                  mesa={mesa}
                  comanda={comandaDa(mesa)}
                  agora={agora}
                  aoAbrir={() => setAbertaId(mesa.id)}
                />
              </ItemEntrando>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <ComandaMesa mesa={aberta} aoFechar={() => setAbertaId(null)} />
    </div>
  )
}
