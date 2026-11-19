"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ReceiptTextIcon, SquareKanbanIcon } from "lucide-react"
import Link from "next/link"
import { parseAsString, useQueryState } from "nuqs"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLoja, usePedidos } from "@/lib/admin/dados/consultas"
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import { useMesas } from "@/lib/admin/dados/consultas-mesas"
import { useFarmacia } from "@/lib/admin/farmacia-estado"
import { useMetas } from "@/lib/admin/metas"
import { abaEscolhida, abasDo } from "@/lib/admin/regras/dashboard/abas"
import { alertasDoPainel } from "@/lib/admin/regras/dashboard/alertas"
import { periodoDaBusca } from "@/lib/admin/regras/dashboard/busca"
import { situacaoDaMeta } from "@/lib/admin/regras/dashboard/metas"
import { resumir } from "@/lib/admin/regras/dashboard/resumo"
import { destaquesDoSegmento } from "@/lib/admin/regras/dashboard/segmento"
import { hojeVsSemanaPassada } from "@/lib/admin/regras/dashboard/semana-passada"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { temModulo } from "@/lib/admin/segmentos-painel"
import { lotesDemo, receitasDemo } from "@/lib/mock/admin/farmacia"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { FiltroPeriodo, usePeriodo } from "./filtro-periodo"
import { AbaFinanceiro, AbaResumo, AbaVendas } from "./painel-visao-geral"

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
  const [valorDaAba, setAba] = useQueryState("aba", parseAsString)
  const aba = abaEscolhida(valorDaAba, segmento)
  const { data: loja } = useLoja()

  // Uma busca só cobre o período, o anterior (para comparar) e hoje.
  const filtro = agora && periodo ? periodoDaBusca(periodo, agora) : undefined
  const { data: pedidos } = usePedidos(filtro, { ativo: Boolean(filtro) })

  const resumo = useMemo(
    () => (pedidos && periodo && agora ? resumir(pedidos, periodo, agora) : null),
    [pedidos, periodo, agora],
  )
  const comparacao = useMemo(
    () => (pedidos && agora ? hojeVsSemanaPassada(pedidos, agora) : undefined),
    [pedidos, agora],
  )

  const metaDefinida = useMetas((estado) => estado.metas[segmento])
  const meta = useMemo(
    () =>
      metaDefinida && pedidos && loja && agora
        ? situacaoDaMeta(metaDefinida, pedidos, loja.horarios, agora)
        : null,
    [metaDefinida, pedidos, loja, agora],
  )

  const temMesas = temModulo(segmento, "mesas")
  const { data: mesas } = useMesas(30_000, { ativo: temMesas })

  const { data: produtos } = useProdutos()
  const decisoes = useFarmacia((estado) => estado.decisoes)
  // A farmácia guarda receitas e lotes fora do servidor de demonstração.
  const farmacia = useMemo(
    () =>
      segmento === "farmacia" && agora
        ? { lotes: lotesDemo(agora), receitas: receitasDemo(agora) }
        : { lotes: [], receitas: [] },
    [segmento, agora],
  )
  const alertas = useMemo(
    () =>
      pedidos && produtos && loja && agora
        ? alertasDoPainel({ segmento, agora, pedidos, produtos, loja, ...farmacia, decisoes, meta })
        : [],
    [pedidos, produtos, loja, agora, segmento, farmacia, decisoes, meta],
  )
  const destaques = useMemo(
    () =>
      pedidos && agora && (!temMesas || mesas)
        ? destaquesDoSegmento({
            segmento,
            agora,
            pedidos,
            ...farmacia,
            decisoes,
            mesas: temMesas ? (mesas ?? []) : null,
          })
        : [],
    [pedidos, agora, segmento, farmacia, decisoes, temMesas, mesas],
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

      <Tabs
        value={aba}
        // Resumo é o padrão: fica fora do endereço.
        onValueChange={(valor) => void setAba(valor === "resumo" ? null : valor)}
      >
        <TabsList variant="line" aria-label="Abas da visão geral">
          {abasDo(segmento).map((item) => (
            <TabsTrigger key={item.id} value={item.id} className="cursor-pointer">
              {item.titulo}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <FiltroPeriodo />

      {resumo && periodo ? (
        aba === "vendas" ? (
          <AbaVendas resumo={resumo} segmento={segmento} />
        ) : aba === "financeiro" ? (
          <AbaFinanceiro resumo={resumo} />
        ) : (
          <AbaResumo
            resumo={resumo}
            periodo={periodo}
            segmento={segmento}
            comparacao={comparacao}
            alertas={alertas}
            meta={meta}
            destaques={destaques}
          />
        )
      ) : (
        <EsqueletoVisaoGeral />
      )}
    </div>
  )
}
