"use client"

import NumberFlow from "@number-flow/react"
import { startOfDay } from "date-fns"
import {
  ArchiveIcon,
  ChevronDownIcon,
  InboxIcon,
  ListChecksIcon,
  MapPinIcon,
  MaximizeIcon,
  TvIcon,
  VolumeXIcon,
} from "lucide-react"
import { AnimatePresence } from "motion/react"
import { parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs"
import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toggle } from "@/components/ui/toggle"
import { useAgora } from "@/hooks/use-agora"
import { useTelaGrande, useTelaLarga } from "@/hooks/use-tela-grande"
import {
  useAceitarPedido,
  useAvancarEmLote,
  useAvancarPedido,
  useCancelarPedido,
  useDefinirEntrega,
  useDespachar,
  useEntregarComReceitaRetida,
  useFila,
  useHistoricoDosClientes,
  useLoja,
  useMotoboys,
  useMotoboyVoltou,
  usePedidos,
  useReabrirPedido,
  useRecusarPedido,
  useServirMesa,
  useSimularCancelamento,
  useSimularPedido,
  useTrocarParaRetirada,
  useVoltarPedido,
} from "@/lib/admin/dados/consultas"
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import type {
  MotivoEscolhido,
  Pedido,
  SomAlerta,
  StatusPedido,
  TipoPedido,
} from "@/lib/admin/dados/tipos"
import { useFarmacia } from "@/lib/admin/farmacia-estado"
import {
  usePreferenciasCarregadas,
  usePreferenciasFila,
  useSomDoAparelho,
} from "@/lib/admin/preferencias-fila"
import { alarmeTocando } from "@/lib/admin/regras/aceite"
import { type HistoricoCliente, seloDoCliente } from "@/lib/admin/regras/clientes"
import { estaNaCozinha } from "@/lib/admin/regras/cozinha"
import { entregasParaAgrupar, situacaoDosMotoboys } from "@/lib/admin/regras/despacho"
import { controladosDoPedido, receitaDoPedido } from "@/lib/admin/regras/farmacia"
import {
  type ColunaFila,
  colunasDaFila,
  finalizadosHoje,
  novosPedidos,
  pedidosDeDiasAnteriores,
  proximasRetiradas,
  resumoDaFila,
} from "@/lib/admin/regras/fila"
import { filtrarPedidos } from "@/lib/admin/regras/filtro-pedidos"
import { pedidoComAlcool } from "@/lib/admin/regras/maioridade"
import {
  FILTROS_DA_FILA,
  type FiltroDaFila,
  filtrarFila,
  metricasDaFila,
} from "@/lib/admin/regras/metricas-fila"
import type { TemposDaLoja } from "@/lib/admin/regras/prazo"
import {
  destinoDoArraste,
  proximoStatus,
  rotuloStatus,
  tomDoStatus,
} from "@/lib/admin/regras/status"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { temModulo } from "@/lib/admin/segmentos-painel"
import { liberarSom, somBloqueado, tocarAlerta } from "@/lib/admin/som"
import { plural } from "@/lib/formato"
import { receitaDoPedidoDemo } from "@/lib/mock/admin/farmacia"
import { cn } from "@/lib/utils"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { CartaoReceita } from "../farmacia/pagina-receitas"
import { useImpressaoDePedidos } from "../impressao/impressao-de-pedidos"
import { DetalhesPedido } from "../pedidos/detalhes-pedido"
import { usePedidoAberto } from "../pedidos/estado-lista"
import { PesagemPedido } from "../pedidos/pesagem-pedido"
import { Traco } from "../traco"
import { AjudaAtalhos } from "./ajuda-atalhos"
import { AjustePrazo } from "./ajuste-prazo"
import { Arrastavel, QuadroArrastavel, useColunaSoltavel } from "./arrastar"
import { AvisoDiasAnteriores } from "./aviso-dias-anteriores"
import { avisarChegada } from "./avisos-do-aparelho"
import { BarraSelecao } from "./barra-selecao"
import { CartaoFila } from "./cartao-fila"
import { ChaveDaLoja } from "./chave-da-loja"
import { EsteAparelho } from "./este-aparelho"
import { FerramentasFila, PARAMETROS_FILA } from "./ferramentas-fila"
import { GavetaBairros } from "./gaveta-bairros"
import { GavetaFinalizados } from "./gaveta-finalizados"
import { IndicadorImpressora } from "./indicador-impressora"
import { JanelaDespacho } from "./janela-despacho"
import { MetricasFila } from "./metricas-fila"
import { PainelMotoboys } from "./painel-motoboys"
import { PausaPedidos } from "./pausa-pedidos"
import { ProximasRetiradas } from "./proximas-retiradas"
import { useAlertasSecundarios } from "./use-alertas-secundarios"
import { useAtalhosDaFila } from "./use-atalhos-da-fila"
import { useTelaAcesa } from "./use-tela-acesa"
import { useTituloDaAba } from "./use-titulo-da-aba"

const _SONS: { valor: SomAlerta; rotulo: string }[] = [
  { valor: "suave", rotulo: "Suave" },
  { valor: "alto", rotulo: "Alto" },
  { valor: "muito-alto", rotulo: "Muito alto" },
  { valor: "sirene", rotulo: "Sirene" },
]

/** Quanto tempo o "Chegou agora" fica no cartão. */
/** Entrega pronta, que espera o motoboy. */
const prontaParaDespachar = (pedido: Pedido) =>
  pedido.tipo === "entrega" && pedido.status === "pronto" && !pedido.esperaAceite

/** Seleção dos pedidos para as ações em lote. */
type SelecaoDaFila = { ativa: boolean; ids: ReadonlySet<number>; alternar: (id: number) => void }

const DESTAQUE_MS = 10_000
/** Demonstração: de quantos em quantos pedidos simulados um cliente cancela. */
const CANCELA_A_CADA = 5
/** Quanto tempo o "Desfazer" fica no aviso depois de avançar. */
const DESFAZER_MS = 6_000

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
  servir: (pedido: Pedido) => void
  /** Açougue: abre a balança do pedido ali mesmo. */
  pesar: (pedido: Pedido) => void
  /** Farmácia: a receita do pedido (sem receita, `undefined`) e se leva controlado. */
  receitaDe: (pedido: Pedido) => "pendente" | "aprovada" | "recusada" | undefined
  controlado: (pedido: Pedido) => boolean
  conferirReceita: (pedido: Pedido) => void
  trocarParaRetirada: (pedido: Pedido) => void
  abrir: (pedido: Pedido) => void
  imprimir: (pedido: Pedido) => void
  /** A loja tem motoboys: a entrega pronta se despacha. */
  despacha: boolean
  /** Adega: o pedido leva bebida alcoólica (+18). */
  comAlcool: (pedido: Pedido) => boolean
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
  nomeLoja,
  compacto,
  selecao,
  acoes,
  comTitulo,
  topo,
}: {
  coluna: ColunaFila
  agora: Date
  motoboys: ReturnType<typeof useMotoboys>["data"]
  novos: ReadonlySet<number>
  emAndamento: number | undefined
  limiteAceiteMin: number
  tempos: TemposDaLoja
  historico: Record<number, HistoricoCliente> | undefined
  nomeLoja: string
  compacto: boolean
  selecao: SelecaoDaFila
  acoes: AcoesDoCartao
  comTitulo: boolean
  /** O que vem antes dos cartões (os motoboys, em A caminho). */
  topo?: ReactNode
}) {
  // Com as colunas lado a lado, o cartão se arrasta para a coluna seguinte ou a anterior.
  const soltavel = useColunaSoltavel(coluna.status, comTitulo)
  return (
    <section
      ref={soltavel.ref}
      aria-label={`${coluna.titulo}, ${coluna.pedidos.length}`}
      // Coluna sem bandeja: os cartões ficam direto na folha, e um fio separa as colunas.
      className={cn(
        "flex min-w-0 flex-col gap-2.5 transition-colors duration-150 lg:px-3 lg:first:pl-0 lg:last:pr-0",
        soltavel.sobre && "bg-foreground/[0.03]",
      )}
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
      {topo}
      {coluna.pedidos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-[13px] text-muted-foreground">
          Nenhum pedido aqui.
        </p>
      ) : (
        <AnimatePresence initial={false}>
          {coluna.pedidos.map((pedido) => (
            <Arrastavel key={pedido.id} id={pedido.id} ativo={comTitulo}>
              <CartaoFila
                pedido={pedido}
                agora={agora}
                motoboys={motoboys ?? []}
                novo={novos.has(pedido.id)}
                ocupado={emAndamento === pedido.id}
                limiteAceiteMin={limiteAceiteMin}
                tempos={tempos}
                seloCliente={historico?.[pedido.id] ? seloDoCliente(historico[pedido.id]) : null}
                nomeLoja={nomeLoja}
                compacto={compacto}
                selecao={{
                  ativa: selecao.ativa,
                  marcado: selecao.ids.has(pedido.id),
                  alternar: () => selecao.alternar(pedido.id),
                }}
                aoAceitar={() => acoes.aceitar(pedido)}
                aoRecusar={(escolhido) => acoes.recusar(pedido, escolhido)}
                aoCancelar={(escolhido) => acoes.cancelar(pedido, escolhido)}
                despacha={acoes.despacha && pedido.tipo === "entrega" && pedido.status === "pronto"}
                maioridade={acoes.comAlcool(pedido)}
                naCozinha={estaNaCozinha(pedido)}
                aoAvancar={() => acoes.avancar(pedido)}
                aoServir={() => acoes.servir(pedido)}
                aoPesar={() => acoes.pesar(pedido)}
                receita={acoes.receitaDe(pedido)}
                controlado={acoes.controlado(pedido)}
                aoConferirReceita={() => acoes.conferirReceita(pedido)}
                aoTrocarParaRetirada={() => acoes.trocarParaRetirada(pedido)}
                aoAbrir={() => acoes.abrir(pedido)}
                aoImprimir={() => acoes.imprimir(pedido)}
              />
            </Arrastavel>
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
  const voltar = useVoltarPedido()
  const servir = useServirMesa()
  const reabrir = useReabrirPedido()
  const [finalizadosAberto, setFinalizadosAberto] = useState(false)
  const quadro = useRef<HTMLDivElement>(null)
  const [ajudaAberta, setAjudaAberta] = useState(false)
  // Seleção para ações em lote: o modo mostra as caixas; Shift+clique marca sem o modo.
  const [selecionando, setSelecionando] = useState(false)
  const [marcados, setMarcados] = useState<ReadonlySet<number>>(new Set())
  const avancarEmLote = useAvancarEmLote()
  const aceitar = useAceitarPedido()
  const recusar = useRecusarPedido()
  const cancelar = useCancelarPedido()
  const definirEntrega = useDefinirEntrega()
  const simularPedido = useSimularPedido()
  const simularCancelamento = useSimularCancelamento()
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
      impressao.imprimir(pedido, { automatica: true })
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
  // A cada 5 pedidos simulados, um cliente cancela pelo site.
  const simular = simularPedido.mutate
  const cancelarPeloCliente = simularCancelamento.mutate
  useEffect(() => {
    if (!preferencias.simular) return
    let vezes = 0
    const relogio = setInterval(() => {
      vezes += 1
      if (vezes % CANCELA_A_CADA === 0) cancelarPeloCliente()
      else simular()
    }, intervaloSimulacao)
    return () => clearInterval(relogio)
  }, [preferencias.simular, intervaloSimulacao, simular, cancelarPeloCliente])

  const avisoDeErro = { onError: (erro: Error) => toast.error(erro.message) }
  /** A mudança mandou aviso ao cliente (simulado): mostra a mensagem que teria saído. */
  const mostrarAviso = (pedido: Pedido) => {
    const ultimo = pedido.historico?.at(-1)
    if (ultimo?.tipo === "aviso" && ultimo.em === pedido.atualizadoEm) {
      toast("Cliente avisado no WhatsApp", { description: ultimo.texto })
    }
  }
  // Despacho: com motoboys, a entrega pronta sai pela janela de despacho.
  const despacha = temModulo(segmento, "motoboys")
  const [despachando, setDespachando] = useState<Pedido[] | null>(null)
  const [bairrosAberto, setBairrosAberto] = useState(false)
  const [conferindo, setConferindo] = useState<Pedido | null>(null)
  // Açougue: a balança aberta pelo cartão. Guarda o id: o pedido vem da fila, já pesado.
  const [pesando, setPesando] = useState<number | null>(null)
  // Farmácia: a receita aberta para conferir (pelo id do pedido) e a retirada do controlado.
  const decisoes = useFarmacia((estado) => estado.decisoes)
  const [conferindoReceita, setConferindoReceita] = useState<number | null>(null)
  const [retendo, setRetendo] = useState<Pedido | null>(null)
  const trocar = useTrocarParaRetirada()
  const entregarRetida = useEntregarComReceitaRetida()
  const receitaDe = (pedido: Pedido) => {
    const tipo = receitaDoPedido(pedido, produtos)
    if (!tipo) return undefined
    return decisoes[`rec-pedido-${pedido.id}`]?.situacao ?? "pendente"
  }
  const controlado = (pedido: Pedido) => controladosDoPedido(pedido, produtos).length > 0
  // Adega: os produtos alcoólicos do cardápio dizem que pedido pede documento.
  const { data: produtos = [] } = useProdutos()
  const comAlcool = (pedido: Pedido) => pedidoComAlcool(pedido, produtos)
  const despachar = useDespachar()
  const motoboyVoltou = useMotoboyVoltou()
  const acoes: AcoesDoCartao = {
    aceitar: (pedido) => {
      // Farmácia: o pedido com receita só entra depois de o farmacêutico aprovar.
      const receita = receitaDe(pedido)
      if (receita && receita !== "aprovada") {
        toast.error(`Confira a receita de #${pedido.numero} antes de aceitar.`)
        return
      }
      aceitar.mutate(pedido.id, {
        ...avisoDeErro,
        onSuccess: (aceito) => {
          toast.success(`#${aceito.numero} aceito.`)
          mostrarAviso(aceito)
        },
      })
    },
    recusar: (pedido, escolhido) =>
      recusar.mutate(
        { id: pedido.id, ...escolhido },
        {
          ...avisoDeErro,
          onSuccess: (recusado) => {
            toast(`#${recusado.numero} recusado.`)
            mostrarAviso(recusado)
          },
        },
      ),
    cancelar: (pedido, escolhido) =>
      cancelar.mutate(
        { id: pedido.id, de: pedido.status, ...escolhido },
        { ...avisoDeErro, onSuccess: (cancelado) => toast(`#${cancelado.numero} cancelado.`) },
      ),
    avancar: (pedido) => {
      // Entrega pronta com motoboys: avançar é despachar (escolher quem leva).
      if (despacha && pedido.tipo === "entrega" && pedido.status === "pronto") {
        setDespachando([pedido])
        return
      }
      // Retirada com bebida alcoólica: antes de entregar, confere o documento.
      if (pedido.tipo === "retirada" && pedido.status === "pronto" && comAlcool(pedido)) {
        setConferindo(pedido)
        return
      }
      // Farmácia: o controlado só sai do balcão com a receita retida.
      if (pedido.tipo === "retirada" && pedido.status === "pronto" && controlado(pedido)) {
        setRetendo(pedido)
        return
      }
      avancarDeVez(pedido)
    },
    abrir: (pedido) => abrirPedido(pedido.id),
    imprimir: impressao.imprimir,
    despacha,
    comAlcool,
    pesar: (pedido) => setPesando(pedido.id),
    receitaDe,
    controlado,
    conferirReceita: (pedido) => setConferindoReceita(pedido.id),
    trocarParaRetirada: (pedido) =>
      trocar.mutate(pedido.id, {
        ...avisoDeErro,
        onSuccess: (trocado) => {
          toast.success(`#${trocado.numero} virou retirada. O cliente foi avisado.`)
          mostrarAviso(trocado)
        },
      }),
    servir: (pedido) =>
      servir.mutate(pedido.id, {
        ...avisoDeErro,
        onSuccess: (servido) => toast(`#${servido.numero} servido. A conta continua em Mesas.`),
      }),
  }
  function avancarDeVez(pedido: Pedido) {
    avancar.mutate(
      { id: pedido.id, de: pedido.status },
      {
        ...avisoDeErro,
        // 6 s para desfazer: o toque errado no pico volta o pedido para a coluna de antes.
        onSuccess: (atualizado) => {
          mostrarAviso(atualizado)
          toast.success(
            `#${atualizado.numero}: ${rotuloStatus(atualizado.tipo, atualizado.status)}`,
            {
              duration: DESFAZER_MS,
              action: {
                label: "Desfazer",
                onClick: () =>
                  voltar.mutate(
                    { id: atualizado.id, de: atualizado.status },
                    {
                      ...avisoDeErro,
                      onSuccess: (voltou) =>
                        toast(
                          `#${voltou.numero} de volta: ${rotuloStatus(voltou.tipo, voltou.status)}`,
                        ),
                    },
                  ),
              },
            },
          )
        },
      },
    )
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
  const finalizados = finalizadosHoje(concluidos, criadosHoje)
  useAlertasSecundarios({ fila, criadosHoje, agora, tempos })
  // Motoboys: quem está na rua, quem está livre (desde a última entrega de hoje) e quem não veio.
  const situacoes = situacaoDosMotoboys(motoboys ?? [], [...(fila ?? []), ...concluidos])
  const painelMotoboys = agora ? (
    <PainelMotoboys
      situacoes={situacoes}
      agora={agora}
      ocupado={motoboyVoltou.isPending}
      aoVoltar={(motoboyId) =>
        motoboyVoltou.mutate(motoboyId, {
          ...avisoDeErro,
          onSuccess: (entregues) =>
            toast(`${plural(entregues.length, "entrega concluída", "entregas concluídas")}.`),
        })
      }
    />
  ) : null
  // Soltar noutra coluna: a seguinte avança, a anterior volta; pular etapa não move.
  const aoSoltar = (pedido: Pedido, para: StatusPedido) => {
    if (para === pedido.status) return
    const destino = destinoDoArraste(pedido.tipo, pedido.status, para)
    if (destino === "avancar") acoes.avancar(pedido)
    else if (destino === "voltar") {
      voltar.mutate(
        { id: pedido.id, de: pedido.status },
        {
          ...avisoDeErro,
          onSuccess: (voltou) =>
            toast(`#${voltou.numero} de volta: ${rotuloStatus(voltou.tipo, voltou.status)}`),
        },
      )
    } else toast("Só dá para levar o pedido para a etapa seguinte ou a anterior.")
  }
  // Atalhos de teclado: só no computador, onde as colunas ficam lado a lado.
  useAtalhosDaFila({
    ativo: telaGrande,
    colunas: colunas?.map((coluna) => coluna.pedidos.map((pedido) => pedido.id)) ?? [],
    pedidos: fila ?? [],
    acoes: {
      avancar: (pedido) => {
        if (proximoStatus(pedido.tipo, pedido.status)) acoes.avancar(pedido)
      },
      aceitar: acoes.aceitar,
      imprimir: acoes.imprimir,
      ajuda: () => setAjudaAberta(true),
    },
  })
  // Só conta o que ainda está na fila: o que saiu (outra aba, cancelado) sai da seleção.
  const selecionados = (fila ?? []).filter((pedido) => marcados.has(pedido.id))
  const limparSelecao = () => {
    setMarcados(new Set())
    setSelecionando(false)
  }
  const selecao: SelecaoDaFila = {
    ativa: selecionando,
    ids: marcados,
    alternar: (id) =>
      setMarcados((atuais) => {
        const novos = new Set(atuais)
        if (!novos.delete(id)) novos.add(id)
        return novos
      }),
  }
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
    // Em tela cheia a fila vira a página toda (o monitor do balcão): precisa do próprio fundo.
    <div
      ref={quadro}
      className="flex flex-1 flex-col gap-5 bg-card p-4 md:p-6 lg:px-8 [&:fullscreen]:overflow-y-auto"
    >
      <CabecalhoPagina
        titulo="Fila de pedidos"
        vivo
        acoes={
          <>
            {/* A TV virada ao cliente: só os números do balcão, numa aba que vai para a outra tela. */}
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/chamada" target="_blank" rel="noreferrer">
                <TvIcon data-icon="inline-start" />
                Painel de chamada
              </a>
            </Button>
            {/* Tela cheia é para o monitor do balcão: no celular não serve. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="max-md:hidden"
              onClick={() => void quadro.current?.requestFullscreen?.()}
            >
              <MaximizeIcon data-icon="inline-start" />
              Tela cheia
            </Button>
          </>
        }
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
          <IndicadorImpressora />
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
            {metricas && (
              <MetricasFila
                metricas={metricas}
                filtro={filtro}
                aoFiltrar={setFiltro}
                aoAbrirFinalizados={() => setFinalizadosAberto(true)}
              />
            )}
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
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <Toggle
                  variant="outline"
                  size="sm"
                  pressed={selecionando}
                  onPressedChange={(ligado) => (ligado ? setSelecionando(true) : limparSelecao())}
                  className="cursor-pointer"
                >
                  <ListChecksIcon data-icon="inline-start" />
                  Selecionar
                </Toggle>
                {despacha && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-haspopup="dialog"
                    onClick={() => setBairrosAberto(true)}
                  >
                    <MapPinIcon data-icon="inline-start" />
                    Por bairro
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-haspopup="dialog"
                  onClick={() => setFinalizadosAberto(true)}
                >
                  <ArchiveIcon data-icon="inline-start" />
                  Finalizados hoje
                  <span className="text-muted-foreground tabular-nums">{finalizados.length}</span>
                </Button>
                <EsteAparelho loja={loja} />
              </div>
            </div>
          </div>
        )}
      </section>

      {fila && agora && (
        <ProximasRetiradas
          grupos={proximasRetiradas(fila, agora)}
          agora={agora}
          aoAbrir={(pedido) => abrirPedido(pedido.id)}
        />
      )}

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
        <QuadroArrastavel pedidos={fila ?? []} aoSoltar={aoSoltar}>
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
                nomeLoja={loja?.nome ?? ""}
                compacto={preferencias.compacto}
                selecao={selecao}
                acoes={acoes}
                comTitulo
                topo={coluna.status === "saiu-para-entrega" ? painelMotoboys : undefined}
              />
            ))}
          </div>
        </QuadroArrastavel>
      ) : (
        <Tabs defaultValue={colunas[0].id}>
          <TabsList className="sem-barra w-full justify-start overflow-x-auto">
            {/* A tinta a 60% do shadcn não chega a 4,5:1 sobre o trilho: aqui fica a 80%. */}
            {colunas.map((coluna) => (
              <TabsTrigger
                key={coluna.id}
                value={coluna.id}
                className="gap-1.5 text-foreground/80 dark:text-foreground/80"
              >
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
                nomeLoja={loja?.nome ?? ""}
                compacto={preferencias.compacto}
                selecao={selecao}
                acoes={acoes}
                comTitulo={false}
                topo={coluna.status === "saiu-para-entrega" ? painelMotoboys : undefined}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {selecionados.length > 0 && (
        <BarraSelecao
          quantos={selecionados.length}
          ocupado={avancarEmLote.isPending}
          aoLimpar={limparSelecao}
          {...(despacha && selecionados.some(prontaParaDespachar)
            ? {
                aoDespachar: () => {
                  setDespachando(selecionados.filter(prontaParaDespachar))
                  limparSelecao()
                },
              }
            : {})}
          aoImprimir={() => {
            for (const pedido of selecionados) impressao.imprimir(pedido)
          }}
          aoAvancar={() =>
            avancarEmLote.mutate(
              selecionados.map((pedido) => ({ id: pedido.id, de: pedido.status })),
              {
                ...avisoDeErro,
                onSuccess: ({ avancados, pulados }) => {
                  limparSelecao()
                  toast.success(
                    `${plural(avancados.length, "pedido avançou", "pedidos avançaram")}.` +
                      (pulados > 0 ? ` ${plural(pulados, "ficou", "ficaram")} de fora.` : ""),
                  )
                },
              },
            )
          }
        />
      )}
      <Dialog
        open={conferindoReceita !== null}
        onOpenChange={(aberta) => !aberta && setConferindoReceita(null)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          {fila
            ?.filter((pedido) => pedido.id === conferindoReceita)
            .map((pedido) => {
              const tipo = receitaDoPedido(pedido, produtos)
              if (!tipo || !agora) return null
              const receita = receitaDoPedidoDemo(pedido, produtos, tipo)
              return (
                <div key={pedido.id} className="flex flex-col gap-4">
                  <DialogHeader>
                    <DialogTitle>Receita do pedido #{pedido.numero}</DialogTitle>
                    <DialogDescription>
                      Aprovada, o pedido pode ser aceito. Recusada, recuse o pedido com o motivo.
                    </DialogDescription>
                  </DialogHeader>
                  <CartaoReceita
                    receita={receita}
                    produtos={produtos}
                    agora={agora}
                    decisao={decisoes[receita.id]}
                  />
                </div>
              )
            })}
        </DialogContent>
      </Dialog>
      <AlertDialog open={retendo !== null} onOpenChange={(aberto) => !aberto && setRetendo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>A receita ficou retida?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido #{retendo?.numero} leva controlado (
              {retendo ? controladosDoPedido(retendo, produtos).join(", ") : ""}): só sai do balcão
              com a via da receita retida na farmácia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (retendo) {
                  entregarRetida.mutate(
                    { id: retendo.id, de: retendo.status },
                    {
                      ...avisoDeErro,
                      onSuccess: (entregue) =>
                        toast.success(`#${entregue.numero} entregue. Receita retida registrada.`),
                    },
                  )
                }
                setRetendo(null)
              }}
            >
              Retida, entregar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={pesando !== null} onOpenChange={(aberta) => !aberta && setPesando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Pesar #{fila?.find((pedido) => pedido.id === pesando)?.numero}
            </DialogTitle>
            <DialogDescription>
              O peso da balança refaz o valor. Se o total mudar, o cliente fica sabendo.
            </DialogDescription>
          </DialogHeader>
          {fila
            ?.filter((pedido) => pedido.id === pesando)
            .map((pedido) => (
              <PesagemPedido key={pedido.id} pedido={pedido} loja={loja?.nome ?? ""} />
            ))}
        </DialogContent>
      </Dialog>
      {despachando && (
        <JanelaDespacho
          pedidos={despachando}
          mesmoBairro={[
            ...new Map(
              despachando
                .flatMap((pedido) => entregasParaAgrupar(pedido, fila ?? []))
                .filter((pedido) => !despachando.some((escolhido) => escolhido.id === pedido.id))
                .map((pedido) => [pedido.id, pedido]),
            ).values(),
          ]}
          situacoes={situacoes}
          comAlcool={comAlcool}
          nomeLoja={loja?.nome ?? ""}
          ocupado={despachar.isPending}
          aoDespachar={async (ids, motoboyId) => {
            try {
              const { despachados, pulados } = await despachar.mutateAsync({ ids, motoboyId })
              for (const pedido of despachados) mostrarAviso(pedido)
              if (pulados > 0)
                toast(`${plural(pulados, "pedido ficou", "pedidos ficaram")} de fora.`)
              return despachados
            } catch (erro) {
              toast.error((erro as Error).message)
              return []
            }
          }}
          aoFechar={() => setDespachando(null)}
        />
      )}
      <GavetaBairros
        fila={fila ?? []}
        aberta={bairrosAberto}
        aoMudar={setBairrosAberto}
        aoAbrirPedido={(pedido) => {
          setBairrosAberto(false)
          abrirPedido(pedido.id)
        }}
      />
      <AlertDialog
        open={conferindo !== null}
        onOpenChange={(aberto) => !aberto && setConferindo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferiu o documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido #{conferindo?.numero} tem bebida alcoólica: só sai para maior de 18.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (conferindo) avancarDeVez(conferindo)
                setConferindo(null)
              }}
            >
              Conferi, entregar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AjudaAtalhos aberta={ajudaAberta} aoMudar={setAjudaAberta} />
      <GavetaFinalizados
        pedidos={finalizados}
        aberta={finalizadosAberto}
        aoMudar={setFinalizadosAberto}
        aoReabrir={(pedido) =>
          reabrir.mutate(pedido.id, {
            ...avisoDeErro,
            onSuccess: (reaberto) =>
              toast(
                `#${reaberto.numero} reaberto: ${rotuloStatus(reaberto.tipo, reaberto.status)}`,
              ),
          })
        }
        aoReimprimir={impressao.imprimir}
      />
      <DetalhesPedido />
      {impressao.elemento}
    </div>
  )
}
