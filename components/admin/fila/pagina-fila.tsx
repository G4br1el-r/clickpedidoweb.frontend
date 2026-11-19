"use client"

import NumberFlow from "@number-flow/react"
import { startOfDay } from "date-fns"
import { ChevronDownIcon, InboxIcon, VolumeXIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAgora } from "@/hooks/use-agora"
import { useTelaGrande, useTelaLarga } from "@/hooks/use-tela-grande"
import {
  useAceitarPedido,
  useAvancarPedido,
  useCancelarPedido,
  useDefinirEntrega,
  useFila,
  useHistoricoDosClientes,
  useLoja,
  useMotoboys,
  usePedidos,
  useRecusarPedido,
  useSimularPedido,
} from "@/lib/admin/dados/consultas"
import type { MotivoEscolhido, Pedido, SomAlerta, TipoPedido } from "@/lib/admin/dados/tipos"
import {
  usePreferenciasCarregadas,
  usePreferenciasFila,
  useSomDoAparelho,
} from "@/lib/admin/preferencias-fila"
import { alarmeTocando } from "@/lib/admin/regras/aceite"
import { type HistoricoCliente, seloDoCliente } from "@/lib/admin/regras/clientes"
import {
  type ColunaFila,
  colunasDaFila,
  novosPedidos,
  pedidosDeDiasAnteriores,
  resumoDaFila,
} from "@/lib/admin/regras/fila"
import { filtrarPedidos } from "@/lib/admin/regras/filtro-pedidos"
import {
  FILTROS_DA_FILA,
  type FiltroDaFila,
  filtrarFila,
  metricasDaFila,
} from "@/lib/admin/regras/metricas-fila"
import type { TemposDaLoja } from "@/lib/admin/regras/prazo"
import { rotuloStatus, tomDoStatus } from "@/lib/admin/regras/status"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { temModulo } from "@/lib/admin/segmentos-painel"
import { liberarSom, somBloqueado, tocarAlerta } from "@/lib/admin/som"
import { plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { useImpressaoDePedidos } from "../impressao/impressao-de-pedidos"
import { DetalhesPedido } from "../pedidos/detalhes-pedido"
import { usePedidoAberto } from "../pedidos/estado-lista"
import { Traco } from "../traco"
import { AjustePrazo } from "./ajuste-prazo"
import { AvisoDiasAnteriores } from "./aviso-dias-anteriores"
import { avisarChegada } from "./avisos-do-aparelho"
import { CartaoFila } from "./cartao-fila"
import { ChaveDaLoja } from "./chave-da-loja"
import { EsteAparelho } from "./este-aparelho"
import { FerramentasFila, PARAMETROS_FILA } from "./ferramentas-fila"
import { MetricasFila } from "./metricas-fila"
import { PausaPedidos } from "./pausa-pedidos"
import { useTelaAcesa } from "./use-tela-acesa"
import { useTituloDaAba } from "./use-titulo-da-aba"

const _SONS: { valor: SomAlerta; rotulo: string }[] = [
  { valor: "suave", rotulo: "Suave" },
  { valor: "alto", rotulo: "Alto" },
  { valor: "muito-alto", rotulo: "Muito alto" },
  { valor: "sirene", rotulo: "Sirene" },
]

/** Quanto tempo o "Chegou agora" fica no cartão. */
const DESTAQUE_MS = 10_000

/** O que a fila mostra quando uma métrica filtra as colunas. */
const ROTULO_DO_FILTRO: Record<FiltroDaFila, string> = {
  atrasados: "Só os atrasados",
  aceite: "Só os que esperam aceite",
  "ultima-hora": "Só os da última hora",
}

function Chave({
  id,
  rotulo,
  marcada,
  aoMudar,
}: {
  id: string
  rotulo: string
  marcada: boolean
  aoMudar: (marcada: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={marcada} onCheckedChange={aoMudar} />
      <Label htmlFor={id} className="cursor-pointer">
        {rotulo}
      </Label>
    </div>
  )
}

/**
 * O navegador segura o som até a pessoa tocar na página. Com o alerta ligado, a fila pede
 * esse toque: sem ele, o alarme do pedido novo não sai. Qualquer toque na página também libera.
 */
function AvisoSomBloqueado({ somLigado }: { somLigado: boolean }) {
  const [bloqueado, setBloqueado] = useState(false)
  useEffect(() => {
    if (!somLigado) return
    const conferir = () => setBloqueado(somBloqueado())
    conferir()
    window.addEventListener("pointerdown", conferir)
    return () => window.removeEventListener("pointerdown", conferir)
  }, [somLigado])

  if (!somLigado || !bloqueado) return null
  return (
    <Button
      type="button"
      variant="outline"
      className="self-start border-(--atencao)/60 bg-(--atencao)/10"
      onClick={async () => {
        await liberarSom()
        setBloqueado(somBloqueado())
      }}
    >
      <VolumeXIcon data-icon="inline-start" />
      Toque para ativar o som
    </Button>
  )
}

/** Detecta pedidos que chegaram desde a última leitura: destaque no cartão e alerta sonoro. */
function useChegadas(pedidos: Pedido[] | undefined, aoChegar: (chegaram: Pedido[]) => void) {
  const conhecidos = useRef<Set<number> | null>(null)
  const [novos, setNovos] = useState<ReadonlySet<number>>(new Set())
  const somLigado = usePreferenciasFila((estado) => estado.somLigado)
  const tipoSom = useSomDoAparelho()
  const avisar = useEffectEvent(aoChegar)
  // Relógios do destaque ainda correndo: saem junto com a tela.
  const relogios = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const correndo = relogios.current
    return () => {
      for (const relogio of correndo) clearTimeout(relogio)
      correndo.clear()
    }
  }, [])

  useEffect(() => {
    if (!pedidos) return
    // Na primeira leitura não há "novo": é o que já estava lá.
    if (conhecidos.current) {
      const chegaram = novosPedidos(conhecidos.current, pedidos)
      if (chegaram.length > 0) {
        if (somLigado) tocarAlerta(tipoSom)
        avisar(pedidos.filter((pedido) => chegaram.includes(pedido.id)))
        setNovos((atuais) => new Set([...atuais, ...chegaram]))
        const relogio = setTimeout(() => {
          relogios.current.delete(relogio)
          setNovos((atuais) => new Set([...atuais].filter((id) => !chegaram.includes(id))))
        }, DESTAQUE_MS)
        relogios.current.add(relogio)
      }
    }
    conhecidos.current = new Set(pedidos.map((pedido) => pedido.id))
  }, [pedidos, somLigado, tipoSom])

  return novos
}

/** O que cada cartão sabe fazer com o pedido dele. */
type AcoesDoCartao = {
  aceitar: (pedido: Pedido) => void
  recusar: (pedido: Pedido, escolhido: MotivoEscolhido) => void
  cancelar: (pedido: Pedido, escolhido: MotivoEscolhido) => void
  avancar: (pedido: Pedido) => void
  abrir: (pedido: Pedido) => void
  imprimir: (pedido: Pedido) => void
}

function Coluna({
  coluna,
  agora,
  motoboys,
  novos,
  emAndamento,
  limiteAceiteMin,
  tempos,
  historico,
  acoes,
  comTitulo,
}: {
  coluna: ColunaFila
  agora: Date
  motoboys: ReturnType<typeof useMotoboys>["data"]
  novos: ReadonlySet<number>
  emAndamento: number | undefined
  limiteAceiteMin: number
  tempos: TemposDaLoja
  historico: Record<number, HistoricoCliente> | undefined
  acoes: AcoesDoCartao
  comTitulo: boolean
}) {
  return (
    <section
      aria-label={`${coluna.titulo}, ${coluna.pedidos.length}`}
      // Coluna sem bandeja: os cartões ficam direto na folha, e um fio separa as colunas.
      className="flex min-w-0 flex-col gap-2.5 lg:px-3 lg:first:pl-0 lg:last:pr-0"
    >
      {comTitulo && (
        <h2 className="flex items-center gap-2 pb-1 text-sm font-semibold">
          <Traco tom={tomDoStatus(coluna.status)} />
          {coluna.titulo}
          <span className="ml-auto text-[13px] font-medium text-muted-foreground tabular-nums">
            <NumberFlow value={coluna.pedidos.length} />
          </span>
        </h2>
      )}
      {coluna.pedidos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-[13px] text-muted-foreground">
          Nenhum pedido aqui.
        </p>
      ) : (
        <AnimatePresence initial={false}>
          {coluna.pedidos.map((pedido) => (
            <CartaoFila
              key={pedido.id}
              pedido={pedido}
              agora={agora}
              motoboys={motoboys ?? []}
              novo={novos.has(pedido.id)}
              ocupado={emAndamento === pedido.id}
              limiteAceiteMin={limiteAceiteMin}
              tempos={tempos}
              seloCliente={historico?.[pedido.id] ? seloDoCliente(historico[pedido.id]) : null}
              aoAceitar={() => acoes.aceitar(pedido)}
              aoRecusar={(escolhido) => acoes.recusar(pedido, escolhido)}
              aoCancelar={(escolhido) => acoes.cancelar(pedido, escolhido)}
              aoAvancar={() => acoes.avancar(pedido)}
              aoAbrir={() => acoes.abrir(pedido)}
              aoImprimir={() => acoes.imprimir(pedido)}
            />
          ))}
        </AnimatePresence>
      )}
    </section>
  )
}

/** Fila ao vivo: o quadro do que está em andamento, com as chaves da loja e o alerta. */
export function PaginaFila({
  intervaloSimulacao = 60_000,
  intervaloAlarme = 5_000,
}: {
  intervaloSimulacao?: number
  intervaloAlarme?: number
}) {
  usePreferenciasCarregadas()
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const agora = useAgora(30_000)
  // No tablet a barra lateral come 256 px: quatro colunas só a partir do notebook.
  const telaGrande = useTelaLarga()
  // Do tablet em diante a régua e as ferramentas ficam à vista; no celular, no Mais.
  const aparelhoGrande = useTelaGrande()
  const [maisAberto, setMaisAberto] = useState(false)
  const { data: fila } = useFila()
  const { data: loja } = useLoja()
  const { data: motoboys } = useMotoboys()
  // Início do dia, não a hora: a chave da consulta só muda na virada do dia.
  const hoje = agora ? startOfDay(agora) : undefined
  const { data: concluidos = [] } = usePedidos(hoje ? { concluidosEm: hoje } : undefined, {
    ativo: Boolean(hoje),
  })
  const { data: historico } = useHistoricoDosClientes(fila?.map((pedido) => pedido.id) ?? [])
  const { data: criadosHoje = [] } = usePedidos(hoje ? { de: hoje, ate: hoje } : undefined, {
    ativo: Boolean(hoje),
  })
  // Filtro das métricas ("só atrasados"), no endereço da página.
  const [filtro, setFiltro] = useQueryState("ver", parseAsStringLiteral(FILTROS_DA_FILA))
  const [ferramentas, setFerramentas] = useQueryStates(PARAMETROS_FILA)
  const filtrando =
    Boolean(filtro || ferramentas.busca) || ferramentas.canal.length > 0 || ferramentas.naoPagos
  const avancar = useAvancarPedido()
  const aceitar = useAceitarPedido()
  const recusar = useRecusarPedido()
  const cancelar = useCancelarPedido()
  const definirEntrega = useDefinirEntrega()
  const simularPedido = useSimularPedido()
  const [, abrirPedido] = usePedidoAberto()
  const preferencias = usePreferenciasFila()
  const somDoAparelho = useSomDoAparelho()
  const impressao = useImpressaoDePedidos()
  // Impressão automática: cada pedido novo entra uma vez na fila da impressora.
  const enviadosParaImprimir = useRef(new Set<number>())
  const marcarNaAba = useTituloDaAba(fila, preferencias.piscarAba)
  useTelaAcesa(preferencias.telaAcesa)
  const novos = useChegadas(fila, (chegaram) => {
    avisarChegada(chegaram, usePreferenciasFila.getState())
    marcarNaAba(chegaram)
    if (!loja?.impressaoAutomatica) return
    for (const pedido of chegaram) {
      if (pedido.impressoEm || enviadosParaImprimir.current.has(pedido.id)) continue
      enviadosParaImprimir.current.add(pedido.id)
      impressao.imprimir(pedido)
    }
  })

  // Alarme insistente: enquanto algum pedido espera aceite, o som repete.
  const tocando = Boolean(fila && alarmeTocando(fila))
  useEffect(() => {
    if (!tocando || !preferencias.somLigado) return
    const relogio = setInterval(() => tocarAlerta(somDoAparelho), intervaloAlarme)
    return () => clearInterval(relogio)
  }, [tocando, preferencias.somLigado, somDoAparelho, intervaloAlarme])

  // Demonstração: um pedido novo chega de tempos em tempos.
  const simular = simularPedido.mutate
  useEffect(() => {
    if (!preferencias.simular) return
    const relogio = setInterval(() => simular(), intervaloSimulacao)
    return () => clearInterval(relogio)
  }, [preferencias.simular, intervaloSimulacao, simular])

  const avisoDeErro = { onError: (erro: Error) => toast.error(erro.message) }
  const acoes: AcoesDoCartao = {
    aceitar: (pedido) =>
      aceitar.mutate(pedido.id, {
        ...avisoDeErro,
        onSuccess: (aceito) => toast.success(`#${aceito.numero} aceito.`),
      }),
    recusar: (pedido, escolhido) =>
      recusar.mutate(
        { id: pedido.id, ...escolhido },
        { ...avisoDeErro, onSuccess: (recusado) => toast(`#${recusado.numero} recusado.`) },
      ),
    cancelar: (pedido, escolhido) =>
      cancelar.mutate(
        { id: pedido.id, de: pedido.status, ...escolhido },
        { ...avisoDeErro, onSuccess: (cancelado) => toast(`#${cancelado.numero} cancelado.`) },
      ),
    avancar: (pedido) =>
      avancar.mutate(
        { id: pedido.id, de: pedido.status },
        {
          ...avisoDeErro,
          onSuccess: (atualizado) =>
            toast.success(
              `#${atualizado.numero}: ${rotuloStatus(atualizado.tipo, atualizado.status)}`,
            ),
        },
      ),
    abrir: (pedido) => abrirPedido(pedido.id),
    imprimir: impressao.imprimir,
  }
  // O cartão que está sendo mexido fica com os botões travados até o servidor responder.
  const emAndamento = [avancar, aceitar, recusar, cancelar].find((mutacao) => mutacao.isPending)
  const idEmAndamento =
    typeof emAndamento?.variables === "number" ? emAndamento.variables : emAndamento?.variables?.id
  const limiteAceiteMin = loja?.limiteAceiteMin ?? 5
  const tempos = {
    tempoEntrega: loja?.tempoEntrega ?? "",
    tempoRetirada: loja?.tempoRetirada ?? "",
  }

  const colunas =
    fila && agora
      ? colunasDaFila(
          filtrarFila(
            filtrarPedidos(fila, {
              busca: ferramentas.busca,
              tipos: ferramentas.canal,
              naoPagos: ferramentas.naoPagos,
            }),
            filtro,
            agora,
            tempos,
          ),
          segmento,
          agora,
        )
      : null
  const metricas =
    fila && agora
      ? metricasDaFila({
          ativos: fila,
          concluidosHoje: concluidos,
          criadosHoje,
          segmento,
          agora,
          tempos,
        })
      : null
  const resumo = fila && agora ? resumoDaFila([...fila, ...concluidos], segmento, agora) : null
  const temEntrega = temModulo(segmento, "motoboys")
  const canaisDoSegmento: TipoPedido[] =
    segmento === "salao"
      ? []
      : [
          ...(temEntrega ? (["entrega"] as const) : []),
          "retirada",
          ...(temModulo(segmento, "mesas") ? (["mesa"] as const) : []),
        ]

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Fila de pedidos"
        vivo
        resumo={
          resumo
            ? [
                `${resumo.emAndamento} em andamento`,
                `${resumo.concluidosHoje} concluídos hoje`,
                resumo.aguardandoPagamento > 0
                  ? `${plural(resumo.aguardandoPagamento, "aguardando", "aguardando")} pagamento online`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Carregando a fila…"
        }
      />

      <AvisoSomBloqueado somLigado={preferencias.somLigado} />
      {fila && agora && <AvisoDiasAnteriores pedidos={pedidosDeDiasAnteriores(fila, agora)} />}

      <section aria-label="Barra da fila" className="flex flex-col">
        {/* Faixa 1: o estado da loja, sempre à vista. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/70 py-3">
          <ChaveDaLoja loja={loja} agora={agora} />
          {temEntrega && (
            <Chave
              id="aceita-entrega"
              rotulo="Entrega"
              marcada={loja?.aceitaEntrega ?? false}
              aoMudar={(entrega) =>
                definirEntrega.mutate(entrega, {
                  onSuccess: () =>
                    toast(
                      entrega
                        ? "Entrega ligada."
                        : "Entrega desligada. Os pedidos de entrega em andamento continuam na fila.",
                    ),
                })
              }
            />
          )}
          {/* No celular, o Mais fica na linha da pausa, sem ocupar uma linha só para ele. */}
          <div className="flex items-center gap-2 max-md:w-full">
            {loja && agora && <PausaPedidos loja={loja} agora={agora} comEntrega={temEntrega} />}
            {!aparelhoGrande && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                aria-expanded={maisAberto}
                aria-controls="fila-mais"
                onClick={() => setMaisAberto((aberto) => !aberto)}
              >
                Mais
                <ChevronDownIcon
                  data-icon="inline-end"
                  className={cn("transition-transform duration-200", maisAberto && "rotate-180")}
                />
              </Button>
            )}
          </div>
          {loja && <AjustePrazo loja={loja} comEntrega={temEntrega} />}
        </div>

        {/* Faixas 2 e 3: a régua e as ferramentas. No celular, recolhidas no Mais. */}
        {(aparelhoGrande || maisAberto) && (
          <div id="fila-mais" className="flex flex-col">
            {metricas && <MetricasFila metricas={metricas} filtro={filtro} aoFiltrar={setFiltro} />}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/70 py-3">
              <FerramentasFila
                busca={ferramentas.busca}
                canais={ferramentas.canal}
                canaisDoSegmento={canaisDoSegmento}
                naoPagos={ferramentas.naoPagos}
                aoMudar={(mudanca) => void setFerramentas(mudanca)}
              />
              {filtro && (
                <p className="flex items-center gap-2 text-sm">
                  <Traco tom="novo" />
                  {ROTULO_DO_FILTRO[filtro]}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setFiltro(null)}>
                    Ver todos
                  </Button>
                </p>
              )}
              <div className="ml-auto">
                <EsteAparelho loja={loja} />
              </div>
            </div>
          </div>
        )}
      </section>

      {!colunas || !agora ? (
        <div role="status" aria-label="Carregando a fila" className="grid gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((indice) => (
            <Skeleton key={indice} className="h-96 rounded-xl" />
          ))}
        </div>
      ) : !filtrando && colunas.every((coluna) => coluna.pedidos.length === 0) ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum pedido em andamento</EmptyTitle>
            <EmptyDescription>Os pedidos novos aparecem aqui sozinhos.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : telaGrande ? (
        <div
          className="grid items-stretch divide-x divide-border/70"
          style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(0, 1fr))` }}
        >
          {colunas.map((coluna) => (
            <Coluna
              key={coluna.id}
              coluna={coluna}
              agora={agora}
              motoboys={motoboys}
              novos={novos}
              emAndamento={idEmAndamento}
              limiteAceiteMin={limiteAceiteMin}
              tempos={tempos}
              historico={historico}
              acoes={acoes}
              comTitulo
            />
          ))}
        </div>
      ) : (
        <Tabs defaultValue={colunas[0].id}>
          <TabsList className="sem-barra w-full justify-start overflow-x-auto">
            {colunas.map((coluna) => (
              <TabsTrigger key={coluna.id} value={coluna.id} className="gap-1.5">
                <Traco tom={tomDoStatus(coluna.status)} className="h-3" />
                {coluna.titulo}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {coluna.pedidos.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {colunas.map((coluna) => (
            <TabsContent key={coluna.id} value={coluna.id}>
              <Coluna
                coluna={coluna}
                agora={agora}
                motoboys={motoboys}
                novos={novos}
                emAndamento={idEmAndamento}
                limiteAceiteMin={limiteAceiteMin}
                tempos={tempos}
                historico={historico}
                acoes={acoes}
                comTitulo={false}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <DetalhesPedido />
      {impressao.elemento}
    </div>
  )
}
