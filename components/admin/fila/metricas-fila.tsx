"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import type { FiltroDaFila, MetricasDaFila } from "@/lib/admin/regras/metricas-fila"
import { cn } from "@/lib/utils"

const minutos = (valor: number | null) => (valor === null ? "—" : `${valor} min`)

const CAIXA =
  "flex min-w-0 flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-left transition-colors"
const INTERATIVA = "hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"

function Numero({ rotulo, valor, tom }: { rotulo: string; valor: ReactNode; tom?: string }) {
  return (
    <>
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className={cn("text-lg font-semibold leading-none tabular-nums", tom)}>{valor}</span>
    </>
  )
}

/**
 * Números ao vivo da fila. Os de pedidos em andamento filtram as colunas (tocar de novo
 * tira o filtro); concluídos e cancelados levam à lista de pedidos.
 */
export function MetricasFila({
  metricas,
  filtro,
  aoFiltrar,
}: {
  metricas: MetricasDaFila
  filtro: FiltroDaFila | null
  aoFiltrar: (filtro: FiltroDaFila | null) => void
}) {
  const filtros: { id: FiltroDaFila; rotulo: string; valor: number; tom?: string }[] = [
    {
      id: "atrasados",
      rotulo: "Atrasados",
      valor: metricas.atrasados,
      ...(metricas.atrasados > 0 ? { tom: "text-destructive dark:text-(--tom-cancelado)" } : {}),
    },
    {
      id: "aceite",
      rotulo: "Esperando aceite",
      valor: metricas.esperandoAceite,
      ...(metricas.esperandoAceite > 0 ? { tom: "text-(--tom-preparo-texto)" } : {}),
    },
    { id: "ultima-hora", rotulo: "Na última hora", valor: metricas.ultimaHora },
  ]

  return (
    <section aria-label="Métricas de hoje" className="flex flex-wrap items-stretch gap-1">
      <button
        type="button"
        aria-pressed={filtro === null}
        className={cn(CAIXA, INTERATIVA, filtro === null && "bg-muted")}
        onClick={() => aoFiltrar(null)}
      >
        <Numero rotulo="Em andamento" valor={metricas.emAndamento} />
      </button>
      {filtros.map(({ id, rotulo, valor, tom }) => (
        <button
          key={id}
          type="button"
          aria-pressed={filtro === id}
          className={cn(CAIXA, INTERATIVA, filtro === id && "bg-muted")}
          onClick={() => aoFiltrar(filtro === id ? null : id)}
        >
          <Numero rotulo={rotulo} valor={valor} {...(tom ? { tom } : {})} />
        </button>
      ))}
      <div className={CAIXA}>
        <Numero rotulo="Preparo médio" valor={minutos(metricas.preparoMedioMin)} />
      </div>
      <div className={CAIXA}>
        <Numero rotulo="Até a entrega" valor={minutos(metricas.entregaMedioMin)} />
      </div>
      <Link href="/admin/pedidos?status=concluido" className={cn(CAIXA, INTERATIVA)}>
        <Numero rotulo="Concluídos" valor={metricas.concluidos} />
      </Link>
      <Link href="/admin/pedidos?status=cancelado" className={cn(CAIXA, INTERATIVA)}>
        <Numero rotulo="Cancelados" valor={metricas.cancelados} />
      </Link>
    </section>
  )
}
