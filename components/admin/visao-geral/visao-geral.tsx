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
import { CabecalhoPagina } from "../cabecalho-pagina"
import { FiltroPeriodo, usePeriodo } from "./filtro-periodo"
import { PainelVisaoGeral } from "./painel-visao-geral"

/** Esqueleto no formato final da tela: blocos de hoje, do período, gráfico e listas. */
function EsqueletoVisaoGeral() {
  return (
    <div role="status" aria-label="Carregando a visão geral" className="flex flex-col gap-10">
      {[0, 1].map((secao) => (
        <div key={secao} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 gap-x-8 border-y border-border/70 py-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((fato) => (
              <div key={fato} className="flex flex-col gap-2 py-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-32" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Skeleton className="h-72 rounded-xl" />
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
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Visão geral"
        resumo={
          <span className="first-letter:uppercase">
            {agora ? format(agora, "EEEE, d 'de' MMMM", { locale: ptBR }) : " "}
            {loja ? ` · ${loja.nome}` : ""}
          </span>
        }
        acoes={
          <>
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
          </>
        }
      />

      <FiltroPeriodo />

      {resumo && periodo ? (
        <PainelVisaoGeral resumo={resumo} periodo={periodo} segmento={segmento} />
      ) : (
        <EsqueletoVisaoGeral />
      )}
    </div>
  )
}
