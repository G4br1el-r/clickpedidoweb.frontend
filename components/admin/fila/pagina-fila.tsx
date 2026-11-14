"use client"

import { startOfDay } from "date-fns"
import { BellRingIcon, InboxIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAgora } from "@/hooks/use-agora"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import {
  useAvancarPedido,
  useDefinirEntrega,
  useFila,
  useLoja,
  useMotoboys,
  usePedidos,
  useSimularPedido,
} from "@/lib/admin/dados/consultas"
import type { Pedido, SomAlerta } from "@/lib/admin/dados/tipos"
import {
  usePreferenciasCarregadas,
  usePreferenciasFila,
  useSomDoAparelho,
} from "@/lib/admin/preferencias-fila"
import { type ColunaFila, colunasDaFila, novosPedidos, resumoDaFila } from "@/lib/admin/regras/fila"
import { rotuloStatus } from "@/lib/admin/regras/status"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { temModulo } from "@/lib/admin/segmentos-painel"
import { tocarAlerta } from "@/lib/admin/som"
import { plural } from "@/lib/formato"
import { useImpressaoDePedidos } from "../impressao/impressao-de-pedidos"
import { DetalhesPedido } from "../pedidos/detalhes-pedido"
import { usePedidoAberto } from "../pedidos/estado-lista"
import { CartaoFila } from "./cartao-fila"
import { ChaveDaLoja } from "./chave-da-loja"

const SONS: { valor: SomAlerta; rotulo: string }[] = [
  { valor: "suave", rotulo: "Suave" },
  { valor: "alto", rotulo: "Alto" },
  { valor: "muito-alto", rotulo: "Muito alto" },
]

/** Quanto tempo o "Chegou agora" fica no cartão. */
const DESTAQUE_MS = 10_000

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

function Coluna({
  coluna,
  agora,
  motoboys,
  novos,
  emAndamento,
  aoAvancar,
  aoAbrir,
  aoImprimir,
  comTitulo,
}: {
  coluna: ColunaFila
  agora: Date
  motoboys: ReturnType<typeof useMotoboys>["data"]
  novos: ReadonlySet<number>
  emAndamento: number | undefined
  aoAvancar: (pedido: Pedido) => void
  aoAbrir: (pedido: Pedido) => void
  aoImprimir: (pedido: Pedido) => void
  comTitulo: boolean
}) {
  return (
    <section
      aria-label={`${coluna.titulo}, ${coluna.pedidos.length}`}
      className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/50 p-2"
    >
      {comTitulo && (
        <h2 className="flex items-center gap-2 px-1 pt-1 text-sm font-semibold">
          {coluna.titulo}
          <Badge variant="secondary" className="tabular-nums">
            {coluna.pedidos.length}
          </Badge>
        </h2>
      )}
      {coluna.pedidos.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">Nenhum pedido aqui.</p>
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
              aoAvancar={() => aoAvancar(pedido)}
              aoAbrir={() => aoAbrir(pedido)}
              aoImprimir={() => aoImprimir(pedido)}
            />
          ))}
        </AnimatePresence>
      )}
    </section>
  )
}

/** Fila ao vivo: o quadro do que está em andamento, com as chaves da loja e o alerta. */
export function PaginaFila({ intervaloSimulacao = 60_000 }: { intervaloSimulacao?: number }) {
  usePreferenciasCarregadas()
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const agora = useAgora(30_000)
  const telaGrande = useTelaGrande()
  const { data: fila } = useFila()
  const { data: loja } = useLoja()
  const { data: motoboys } = useMotoboys()
  // Início do dia, não a hora: a chave da consulta só muda na virada do dia.
  const hoje = agora ? startOfDay(agora) : undefined
  const { data: concluidos = [] } = usePedidos(hoje ? { concluidosEm: hoje } : undefined, {
    ativo: Boolean(hoje),
  })
  const avancar = useAvancarPedido()
  const definirEntrega = useDefinirEntrega()
  const simularPedido = useSimularPedido()
  const [, abrirPedido] = usePedidoAberto()
  const preferencias = usePreferenciasFila()
  const somDoAparelho = useSomDoAparelho()
  const impressao = useImpressaoDePedidos()
  // Impressão automática: cada pedido novo entra uma vez na fila da impressora.
  const enviadosParaImprimir = useRef(new Set<number>())
  const novos = useChegadas(fila, (chegaram) => {
    if (!loja?.impressaoAutomatica) return
    for (const pedido of chegaram) {
      if (pedido.impressoEm || enviadosParaImprimir.current.has(pedido.id)) continue
      enviadosParaImprimir.current.add(pedido.id)
      impressao.imprimir(pedido)
    }
  })

  // Demonstração: um pedido novo chega de tempos em tempos.
  const simular = simularPedido.mutate
  useEffect(() => {
    if (!preferencias.simular) return
    const relogio = setInterval(() => simular(), intervaloSimulacao)
    return () => clearInterval(relogio)
  }, [preferencias.simular, intervaloSimulacao, simular])

  const aoAvancar = (pedido: Pedido) =>
    avancar.mutate(
      { id: pedido.id, de: pedido.status },
      {
        onSuccess: (atualizado) =>
          toast.success(
            `#${atualizado.numero}: ${rotuloStatus(atualizado.tipo, atualizado.status)}`,
          ),
        onError: (erro) => toast.error(erro.message),
      },
    )
  const aoAbrir = (pedido: Pedido) => abrirPedido(pedido.id)

  const colunas = fila && agora ? colunasDaFila(fila, segmento, agora) : null
  const resumo = fila && agora ? resumoDaFila([...fila, ...concluidos], segmento, agora) : null
  const temEntrega = temModulo(segmento, "motoboys")

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Fila de pedidos</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {resumo
            ? [
                `${resumo.emAndamento} em andamento`,
                `${resumo.concluidosHoje} concluídos hoje`,
                resumo.aguardandoPagamento > 0
                  ? `${plural(resumo.aguardandoPagamento, "aguardando", "aguardando")} pagamento online`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Carregando a fila…"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border bg-card px-4 py-3">
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
        <div className="flex flex-wrap items-center gap-2">
          <Chave
            id="alerta-sonoro"
            rotulo="Alerta sonoro"
            marcada={preferencias.somLigado}
            aoMudar={(ligado) => {
              preferencias.ligarSom(ligado)
              // O toque na chave libera o som no navegador.
              if (ligado) tocarAlerta(somDoAparelho)
            }}
          />
          <Select
            value={preferencias.tipoSom ?? "padrao"}
            onValueChange={(tipo) =>
              preferencias.escolherSom(tipo === "padrao" ? null : (tipo as SomAlerta))
            }
          >
            <SelectTrigger size="sm" aria-label="Tipo do alerta" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {/* Sem escolha neste aparelho, vale o som das configurações da loja. */}
                <SelectItem value="padrao">
                  Padrão da loja ({SONS.find((som) => som.valor === loja?.som)?.rotulo ?? "Alto"})
                </SelectItem>
                {SONS.map(({ valor, rotulo }) => (
                  <SelectItem key={valor} value={valor}>
                    {rotulo}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => tocarAlerta(somDoAparelho)}
          >
            <BellRingIcon data-icon="inline-start" />
            Testar
          </Button>
        </div>
        <div className="sm:ml-auto">
          <Chave
            id="simular-pedidos"
            rotulo="Simular pedidos chegando"
            marcada={preferencias.simular}
            aoMudar={preferencias.ligarSimulacao}
          />
        </div>
      </div>

      {!colunas || !agora ? (
        <div role="status" aria-label="Carregando a fila" className="grid gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((indice) => (
            <Skeleton key={indice} className="h-96 rounded-xl" />
          ))}
        </div>
      ) : colunas.every((coluna) => coluna.pedidos.length === 0) ? (
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
          className="grid items-start gap-3"
          style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(0, 1fr))` }}
        >
          {colunas.map((coluna) => (
            <Coluna
              key={coluna.id}
              coluna={coluna}
              agora={agora}
              motoboys={motoboys}
              novos={novos}
              emAndamento={avancar.isPending ? avancar.variables?.id : undefined}
              aoAvancar={aoAvancar}
              aoAbrir={aoAbrir}
              aoImprimir={impressao.imprimir}
              comTitulo
            />
          ))}
        </div>
      ) : (
        <Tabs defaultValue={colunas[0].id}>
          <TabsList className="w-full">
            {colunas.map((coluna) => (
              <TabsTrigger key={coluna.id} value={coluna.id} className="gap-1.5">
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
                emAndamento={avancar.isPending ? avancar.variables?.id : undefined}
                aoAvancar={aoAvancar}
                aoAbrir={aoAbrir}
                aoImprimir={impressao.imprimir}
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
