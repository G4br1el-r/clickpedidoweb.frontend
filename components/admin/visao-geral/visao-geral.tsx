"use client"

import { format, startOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ReceiptTextIcon, SquareKanbanIcon } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLoja, usePedidos } from "@/lib/admin/dados/consultas"
import { resumir } from "@/lib/admin/regras/dashboard"
import { periodoAnterior } from "@/lib/admin/regras/periodo"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { FiltroPeriodo, usePeriodo } from "./filtro-periodo"
import { PainelVisaoGeral } from "./painel-visao-geral"

/** Esqueleto no formato final da tela: blocos de hoje, do período, gráfico e listas. */
function EsqueletoVisaoGeral() {
  return (
    <div role="status" aria-label="Carregando a visão geral" className="flex flex-col gap-8">
      {[0, 1].map((secao) => (
        <div key={secao} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((cartao) => (
              <Skeleton key={cartao} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  )
}

/** Visão geral do painel: hoje ao vivo e o desempenho do período escolhido. */
export function VisaoGeral() {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const { agora, periodo } = usePeriodo()
  const { data: loja } = useLoja()

  // Uma busca só cobre o período, o anterior (para comparar) e hoje.
  const filtro =
    agora && periodo ? { de: periodoAnterior(periodo).de, ate: startOfDay(agora) } : undefined
  const { data: pedidos } = usePedidos(filtro, { ativo: Boolean(filtro) })

  const resumo = useMemo(
    () => (pedidos && periodo && agora ? resumir(pedidos, periodo, agora) : null),
    [pedidos, periodo, agora],
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {agora ? format(agora, "EEEE, d 'de' MMMM", { locale: ptBR }) : " "}
            {loja ? ` · ${loja.nome}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/pedidos">
              <ReceiptTextIcon data-icon="inline-start" />
              Pedidos
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/fila">
              <SquareKanbanIcon data-icon="inline-start" />
              Abrir a fila
            </Link>
          </Button>
        </div>
      </div>

      <FiltroPeriodo />

      {resumo && periodo ? (
        <PainelVisaoGeral resumo={resumo} periodo={periodo} segmento={segmento} />
      ) : (
        <EsqueletoVisaoGeral />
      )}
    </div>
  )
}
