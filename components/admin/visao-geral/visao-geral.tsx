"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ReceiptTextIcon, SquareKanbanIcon } from "lucide-react"
import Link from "next/link"
import { parseAsString, useQueryState } from "nuqs"
import { type ReactNode, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { useReactToPrint } from "react-to-print"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLoja, useMotoboys, usePedidos } from "@/lib/admin/dados/consultas"
import { useCategorias, useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import { useMesas } from "@/lib/admin/dados/consultas-mesas"
import { useFarmacia } from "@/lib/admin/farmacia-estado"
import { useMetas } from "@/lib/admin/metas"
import { abaEscolhida, abasDo } from "@/lib/admin/regras/dashboard/abas"
import { alertasDoPainel } from "@/lib/admin/regras/dashboard/alertas"
import { periodoDaBusca } from "@/lib/admin/regras/dashboard/busca"
import { periodoDeClientes } from "@/lib/admin/regras/dashboard/clientes"
import { situacaoDaMeta } from "@/lib/admin/regras/dashboard/metas"
import { resumir } from "@/lib/admin/regras/dashboard/resumo"
import { destaquesDoSegmento } from "@/lib/admin/regras/dashboard/segmento"
import { hojeVsSemanaPassada } from "@/lib/admin/regras/dashboard/semana-passada"
import { escrituracao } from "@/lib/admin/regras/farmacia"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { temModulo } from "@/lib/admin/segmentos-painel"
import { lotesDemo, movimentosDemo, receitasDemo } from "@/lib/mock/admin/farmacia"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { FaixaRolavel } from "../faixa-rolavel"
import { AbaAgenda } from "./agenda/aba-agenda"
import { BotaoImprimir } from "./botao-imprimir"
import { AbaClientes } from "./clientes/aba-clientes"
import { AbaEntrega } from "./entrega/aba-entrega"
import { EsqueletoVisaoGeral } from "./esqueletos-visao-geral"
import { ProvedorDaAba } from "./exportar"
import { AbaFarmacia } from "./farmacia/aba-farmacia"
import { FiltroPeriodo, usePeriodo } from "./filtro-periodo"
import { AbaFinanceiro } from "./financeiro/aba-financeiro"
import { AbaOperacao } from "./operacao/aba-operacao"
import { AbaResumo } from "./painel-visao-geral"
import { AbaPesagem } from "./pesagem/aba-pesagem"
import { AbaProdutos } from "./produtos/aba-produtos"
import { TrocaDeAba } from "./troca-de-aba"
import { AbaVendas } from "./vendas/aba-vendas"

/** De quanto em quanto tempo o Resumo confere os pedidos. */
const ATUALIZAR_RESUMO_A_CADA = 30_000

/** Visão geral do painel: hoje ao vivo e o desempenho do período escolhido. */
export function VisaoGeral() {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const { agora, periodo } = usePeriodo()
  const [valorDaAba, setAba] = useQueryState("aba", parseAsString)
  const aba = abaEscolhida(valorDaAba, segmento)
  const { data: loja } = useLoja()

  // Uma busca só cobre o período, o anterior (para comparar) e hoje.
  const filtro = agora && periodo ? periodoDaBusca(periodo, agora) : undefined
  // No Resumo, hoje e os alertas se atualizam sozinhos; as abas de análise, não.
  const { data: pedidos, isFetching: sincronizando } = usePedidos(filtro, {
    ativo: Boolean(filtro),
    atualizarACada: aba === "resumo" ? ATUALIZAR_RESUMO_A_CADA : undefined,
  })

  // A aba Clientes enxerga sempre os últimos 90 dias, numa busca própria.
  const { data: pedidosDeClientes } = usePedidos(agora ? periodoDeClientes(agora) : undefined, {
    ativo: aba === "clientes" && Boolean(agora),
  })
  // A Agenda precisa de tudo o que está marcado (os vagos de amanhã), não só do período.
  const { data: agenda } = usePedidos({}, { ativo: aba === "agenda" })
  const { data: motoboys } = useMotoboys()

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
  const { data: categorias } = useCategorias()
  const decisoes = useFarmacia((estado) => estado.decisoes)
  // A farmácia guarda receitas e lotes fora do servidor de demonstração.
  const farmacia = useMemo(
    () =>
      segmento === "farmacia" && agora
        ? { lotes: lotesDemo(agora), receitas: receitasDemo(agora) }
        : { lotes: [], receitas: [] },
    [segmento, agora],
  )
  const movimentos = useMemo(
    () =>
      aba === "farmacia" && agora && produtos
        ? escrituracao(movimentosDemo(agora), farmacia.receitas, produtos, decisoes)
        : [],
    [aba, agora, produtos, farmacia, decisoes],
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

  // Imprimir leva só a aba aberta, com um cabeçalho e as tabelas recolhidas abertas.
  const tituloDaAba = abasDo(segmento).find((item) => item.id === aba)?.titulo ?? "Resumo"
  const periodoDaAba = aba === "clientes" && agora ? periodoDeClientes(agora) : periodo
  const areaDeImpressao = useRef<HTMLDivElement>(null)
  const [impressoEm, setImpressoEm] = useState<Date | null>(null)
  const nomeDaLoja = loja?.nome ?? ""
  const imprimir = useReactToPrint({
    contentRef: areaDeImpressao,
    documentTitle: periodoDaAba
      ? `${nomeDaLoja} · ${tituloDaAba} · ${format(periodoDaAba.de, "dd/MM")} a ${format(periodoDaAba.ate, "dd/MM")}`
      : nomeDaLoja,
    // Na folha não vão botões nem as trocas de medida (R$ ou Qtd., Dia ou Semana).
    pageStyle:
      "@page { margin: 12mm } [data-slot=button], [data-slot=toggle-group] { display: none !important }",
    onBeforePrint: async () => {
      flushSync(() => setImpressoEm(new Date()))
    },
    onAfterPrint: () => setImpressoEm(null),
  })

  /** O conteúdo da aba aberta, ou `null` enquanto o que ela precisa ainda não chegou. */
  const corpo = ((): ReactNode => {
    if (!resumo || !periodo) return null
    switch (aba) {
      case "vendas":
        return <AbaVendas pedidos={pedidos ?? []} periodo={periodo} segmento={segmento} />
      case "clientes":
        return pedidosDeClientes && loja && agora ? (
          <AbaClientes
            pedidos={pedidosDeClientes}
            agora={agora}
            segmento={segmento}
            loja={loja}
            linkDaLoja={typeof window === "undefined" ? "/" : `${window.location.origin}/`}
          />
        ) : null
      case "operacao":
        return <AbaOperacao pedidos={pedidos ?? []} periodo={periodo} segmento={segmento} />
      case "produtos":
        // Sem o cardápio, "o que não vendeu" estaria errado: espera os dois chegarem.
        return produtos && categorias ? (
          <AbaProdutos
            pedidos={pedidos ?? []}
            periodo={periodo}
            segmento={segmento}
            produtos={produtos}
            categorias={categorias}
          />
        ) : null
      case "entrega":
        return <AbaEntrega pedidos={pedidos ?? []} periodo={periodo} motoboys={motoboys ?? []} />
      case "agenda":
        return agenda && loja && agora ? (
          <AbaAgenda
            pedidos={agenda}
            periodo={periodo}
            agora={agora}
            horarios={loja.horarios}
            capacidade={loja.capacidadeAtendimentos ?? 1}
          />
        ) : null
      case "farmacia":
        return produtos && agora ? (
          <AbaFarmacia
            pedidos={pedidos ?? []}
            periodo={periodo}
            agora={agora}
            produtos={produtos}
            receitas={farmacia.receitas}
            decisoes={decisoes}
            lotes={farmacia.lotes}
            movimentos={movimentos}
          />
        ) : null
      case "pesagem":
        return <AbaPesagem pedidos={pedidos ?? []} periodo={periodo} />
      case "financeiro":
        return (
          <AbaFinanceiro pedidos={pedidos ?? []} periodo={periodo} taxas={loja?.taxasPagamento} />
        )
      default:
        return (
          <AbaResumo
            resumo={resumo}
            periodo={periodo}
            segmento={segmento}
            comparacao={comparacao}
            alertas={alertas}
            meta={meta}
            destaques={destaques}
            sincronizando={sincronizando}
          />
        )
    }
  })()

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
            <BotaoImprimir
              imprimindo={impressoEm !== null}
              desabilitado={!resumo}
              aoClicar={() => imprimir()}
            />
            <Button asChild variant="outline" size="sm" className="max-md:min-h-11">
              <Link href="/admin/pedidos">
                <ReceiptTextIcon data-icon="inline-start" />
                Pedidos
              </Link>
            </Button>
            <Button asChild size="sm" className="max-md:min-h-11">
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
        className="gap-6"
      >
        {/*
          No celular, a barra fica presa embaixo do cabeçalho e rola para o lado, com a borda
          direita esmaecida quando há mais abas. No notebook em diante, as abas cabem inteiras.
        */}
        <div className="max-md:sticky max-md:top-14 max-md:z-20 max-md:-mx-4 max-md:border-b max-md:border-border/70 max-md:bg-card max-md:px-4">
          <FaixaRolavel>
            <TabsList
              variant="line"
              aria-label="Abas da visão geral"
              className="w-max min-w-full justify-start"
            >
              {abasDo(segmento).map((item) => (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="flex-none cursor-pointer max-md:min-h-11"
                >
                  {item.titulo}
                </TabsTrigger>
              ))}
            </TabsList>
          </FaixaRolavel>
        </div>

        {aba === "clientes" ? (
          <p className="text-sm text-muted-foreground">Últimos 90 dias, até hoje</p>
        ) : (
          <FiltroPeriodo />
        )}

        {/* Só a aba aberta é montada; cada uma é o painel da sua aba para leitores de tela. */}
        <TabsContent value={aba}>
          <div ref={areaDeImpressao}>
            {/* Só na folha impressa: de que loja, aba e período é, e quando saiu. */}
            {periodoDaAba && (
              <div
                data-testid="cabecalho-da-impressao"
                className="mb-6 hidden flex-col gap-1 border-b border-border pb-4 print:flex"
              >
                <p className="text-lg font-semibold">{`${nomeDaLoja} · ${tituloDaAba}`}</p>
                <p className="text-sm">
                  {`Período: ${format(periodoDaAba.de, "dd/MM/yyyy")} a ${format(periodoDaAba.ate, "dd/MM/yyyy")}`}
                </p>
                <p className="text-sm">
                  {`Impresso em ${format(impressoEm ?? agora ?? periodoDaAba.ate, "dd/MM/yyyy 'às' HH:mm")}`}
                </p>
              </div>
            )}
            <ProvedorDaAba
              loja={nomeDaLoja}
              aba={tituloDaAba}
              periodo={periodoDaAba ?? { de: new Date(0), ate: new Date(0) }}
              imprimindo={impressoEm !== null}
            >
              {/* Esqueleto e conteúdo trocam com fade; o esqueleto tem a forma da aba aberta. */}
              <TrocaDeAba chave={`${aba}:${corpo ? "pronto" : "carregando"}`}>
                {corpo ?? <EsqueletoVisaoGeral aba={aba} />}
              </TrocaDeAba>
            </ProvedorDaAba>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
