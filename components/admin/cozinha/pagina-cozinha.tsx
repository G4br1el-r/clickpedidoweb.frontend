"use client"

import NumberFlow from "@number-flow/react"
import { ChefHatIcon, MaximizeIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useRef, useState } from "react"
import { toast } from "sonner"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAgora } from "@/hooks/use-agora"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import {
  useAvancarTicket,
  useAvisarSobreRodada,
  useCozinha,
  useDarCiente,
  useLoja,
  usePriorizarPedido,
  useProntoNaPraca,
  useRiscarItem,
  useVoltarTicket,
} from "@/lib/admin/dados/consultas"
import { useAlternarProduto, useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import type {
  AvisoCozinha,
  ConfigLoja,
  ItemPedido,
  Produto,
  TipoMensagemCozinha,
} from "@/lib/admin/dados/tipos"
import {
  usePreferenciasCarregadas,
  usePreferenciasFila,
  useSomDoAparelho,
} from "@/lib/admin/preferencias-fila"
import {
  type ColunaCozinha,
  type ConfigCozinha,
  colunasDaCozinha,
  type FiltroCozinha,
  maisTardeNaCozinha,
  type StatusTicket,
  TEMPOS_PADRAO,
  type TicketCozinha as Ticket,
} from "@/lib/admin/regras/cozinha"
import { type VisaoDePraca, viasDoTicket } from "@/lib/admin/regras/pracas"
import { tomDoStatus } from "@/lib/admin/regras/status"
import { tocarAlerta } from "@/lib/admin/som"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { useFilaDeVias } from "../impressao/via-cozinha"
import { Traco } from "../traco"
import { AjustesCozinha } from "./ajustes-cozinha"
import { MaisTarde } from "./mais-tarde"
import { nomeDoTicket, TicketCozinha } from "./ticket-cozinha"
import { TracoDePraca } from "./traco-de-praca"
import { useSonsDaCozinha } from "./use-sons-da-cozinha"
import { useViasDaCozinha } from "./use-vias-da-cozinha"

const ABAS = ["quadro", "ajustes"] as const

const FILTROS: { valor: FiltroCozinha; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "mesas", rotulo: "Mesas" },
  { valor: "entrega", rotulo: "Entrega" },
  { valor: "retirada", rotulo: "Retirada" },
]

const NOME_DA_COLUNA: Record<StatusTicket, string> = {
  recebido: "A fazer",
  "em-preparo": "Preparando",
  pronto: "Prontos",
}

/** O que chega em cada coluna: a coluna vazia ensina, em vez de só dizer "nada". */
const VAZIA: Record<ColunaCozinha["id"], string> = {
  afazer: "Os pedidos novos e as rodadas das mesas chegam aqui.",
  preparando: "Toque em Iniciar preparo num ticket de A fazer.",
  prontos: "Marque um ticket como pronto e ele vem para cá.",
}

function Coluna({
  coluna,
  agora,
  tempos,
  prazos,
  praca,
  emAndamento,
  aoAvancar,
  aoProntoNaPraca,
  aoRiscar,
  aoVoltar,
  aoPriorizar,
  aoCiente,
  aoAvisar,
  aoReimprimir,
  esgotaveis,
  aoEsgotar,
  comTitulo,
}: {
  coluna: ColunaCozinha
  agora: Date
  tempos: ConfigCozinha
  prazos: ConfigLoja["prazos"]
  /** Na tela de uma praça, o nome dela. */
  praca: string | undefined
  emAndamento: string | undefined
  aoAvancar: (ticket: Ticket) => void
  aoProntoNaPraca: (ticket: Ticket) => void
  aoRiscar: (ticket: Ticket, item: ItemPedido, feito: boolean) => void
  aoVoltar: (ticket: Ticket) => void
  aoPriorizar: (ticket: Ticket, prioridade: boolean) => void
  aoCiente: (ticket: Ticket, aviso: AvisoCozinha) => void
  aoAvisar: (ticket: Ticket, tipo: TipoMensagemCozinha) => void
  aoReimprimir: (ticket: Ticket) => void
  esgotaveis: (ticket: Ticket) => Produto[]
  aoEsgotar: (produto: { id: string; nome: string }) => void
  comTitulo: boolean
}) {
  return (
    <section
      aria-label={`${coluna.titulo}, ${coluna.tickets.length}`}
      // Coluna sem bandeja: os tickets ficam direto na folha, e um fio separa as colunas.
      className="flex min-w-0 flex-col gap-2.5 md:px-3 md:first:pl-0 md:last:pr-0"
    >
      {comTitulo && (
        <h2 className="flex items-center gap-2 pb-1 text-[15px] font-semibold">
          <Traco tom={tomDoStatus(coluna.status)} />
          {coluna.titulo}
          <span className="ml-auto text-[13px] font-medium text-muted-foreground tabular-nums">
            <NumberFlow value={coluna.tickets.length} />
          </span>
        </h2>
      )}
      {coluna.tickets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-balance text-muted-foreground">
          {VAZIA[coluna.id]}
        </p>
      ) : (
        <AnimatePresence initial={false}>
          {coluna.tickets.map((ticket) => (
            <TicketCozinha
              key={ticket.id}
              ticket={ticket}
              agora={agora}
              tempos={tempos}
              prazos={prazos}
              praca={praca ? { nome: praca, aoPronto: () => aoProntoNaPraca(ticket) } : undefined}
              ocupado={emAndamento === ticket.id}
              aoAvancar={() => aoAvancar(ticket)}
              aoRiscar={(item, feito) => aoRiscar(ticket, item, feito)}
              aoVoltar={() => aoVoltar(ticket)}
              aoPriorizar={(prioridade) => aoPriorizar(ticket, prioridade)}
              aoCiente={(aviso) => aoCiente(ticket, aviso)}
              aoAvisar={(tipo) => aoAvisar(ticket, tipo)}
              aoReimprimir={() => aoReimprimir(ticket)}
              esgotaveis={esgotaveis(ticket)}
              aoEsgotar={aoEsgotar}
            />
          ))}
        </AnimatePresence>
      )}
    </section>
  )
}

/**
 * Tela da cozinha (KDS): o que preparar agora, da rodada nova de cada comanda e dos
 * pedidos do site e do balcão. Pronto sai daqui: entrega e retirada seguem pela Fila
 * e a mesa fecha a conta em Mesas.
 */
export function PaginaCozinha({
  intervalo = 4_000,
  tique,
}: {
  intervalo?: number
  /** De quanto em quanto tempo a cozinha confere atraso e repete os alarmes. */
  tique?: number
}) {
  usePreferenciasCarregadas()
  const agora = useAgora(15_000)
  const telaGrande = useTelaGrande()
  const { data: pedidos } = useCozinha(intervalo)
  const avancar = useAvancarTicket()
  const riscar = useRiscarItem()
  const voltar = useVoltarTicket()
  const priorizar = usePriorizarPedido()
  const ciente = useDarCiente()
  const avisarSobre = useAvisarSobreRodada()
  const { data: produtos } = useProdutos()
  const alternarProduto = useAlternarProduto()
  const [filtro, setFiltro] = useState<FiltroCozinha>("todos")
  const [aba, setAba] = useQueryState("aba", parseAsStringLiteral(ABAS).withDefault("quadro"))
  const { data: loja } = useLoja()
  // Os tempos de alerta e quanto a loja leva para preparar (o mínimo da retirada).
  const tempos: ConfigCozinha = {
    ...(loja?.temposCozinha ?? TEMPOS_PADRAO),
    preparoMin: loja?.prazos?.retirada.min,
  }
  const pracas = loja?.pracas ?? []
  const pracaEscolhida = usePreferenciasFila((estado) => estado.praca)
  const escolherPraca = usePreferenciasFila((estado) => estado.escolherPraca)
  // A praça apagada em outro aparelho volta para Todas.
  const pracaAtual = pracas.find((praca) => praca.id === pracaEscolhida)
  const visao: VisaoDePraca | undefined = pracaAtual
    ? { pracaId: pracaAtual.id, produtos: produtos ?? [], pracas }
    : undefined
  const prontoNaPraca = useProntoNaPraca()
  const imprimirVias = usePreferenciasFila((estado) => estado.imprimirVias)
  const vias = useFilaDeVias()
  useSonsDaCozinha(pedidos, tempos, tique, visao, pracaAtual?.tocaSom === false)
  const somLigado = usePreferenciasFila((estado) => estado.somLigado)
  const ligarSom = usePreferenciasFila((estado) => estado.ligarSom)
  const tipoSom = useSomDoAparelho()
  const quadro = useRef<HTMLDivElement>(null)

  const colunas = pedidos && agora ? colunasDaCozinha(pedidos, filtro, agora, tempos, visao) : null
  const maisTarde =
    pedidos && agora ? maisTardeNaCozinha(pedidos, filtro, agora, tempos, visao) : []
  useViasDaCozinha({
    pedidos,
    agora,
    tempos,
    produtos,
    pracas,
    viaDaCozinha: loja?.viaDaCozinha,
    pracaDoAparelho: pracaAtual?.id ?? "todas",
    ligado: imprimirVias,
    imprimir: vias.imprimir,
  })
  const aoReimprimir = (ticket: Ticket) =>
    vias.imprimir(
      viasDoTicket(ticket, {
        produtos: produtos ?? [],
        pracas,
        pracaDoAparelho: pracaAtual?.id ?? "todas",
      }),
    )
  const aoErrar = (erro: Error) => toast.error(erro.message)
  /** O avanço e a volta avisam para onde o ticket foi, com Desfazer para o toque errado. */
  const avisar = (ticket: Ticket, para: StatusTicket, desfazer: () => void) =>
    toast(`${nomeDoTicket(ticket)} foi para ${NOME_DA_COLUNA[para]}.`, {
      duration: 6_000,
      action: { label: "Desfazer", onClick: desfazer },
    })
  const aoAvancar = (ticket: Ticket) => {
    const mudanca = { id: ticket.pedido.id, rodada: ticket.rodada, de: ticket.status }
    const para: StatusTicket = ticket.status === "recebido" ? "em-preparo" : "pronto"
    avancar.mutate(mudanca, {
      onError: aoErrar,
      onSuccess: () =>
        avisar(ticket, para, () => voltar.mutate({ ...mudanca, de: para }, { onError: aoErrar })),
    })
  }
  const aoRiscar = (ticket: Ticket, item: ItemPedido, feito: boolean) =>
    riscar.mutate(
      { id: ticket.pedido.id, itemId: item.id, feito },
      { onError: (erro) => toast.error(erro.message) },
    )
  const aoVoltar = (ticket: Ticket) => {
    const mudanca = { id: ticket.pedido.id, rodada: ticket.rodada, de: ticket.status }
    const para: StatusTicket = ticket.status === "pronto" ? "em-preparo" : "recebido"
    voltar.mutate(mudanca, {
      onError: aoErrar,
      onSuccess: () =>
        avisar(ticket, para, () => avancar.mutate({ ...mudanca, de: para }, { onError: aoErrar })),
    })
  }
  const aoProntoNaPraca = (ticket: Ticket) => {
    if (!visao || !pracaAtual) return
    prontoNaPraca.mutate(
      { id: ticket.pedido.id, rodada: ticket.rodada, visao },
      {
        onError: aoErrar,
        onSuccess: () => toast(`${nomeDoTicket(ticket)}: ${pracaAtual.nome} pronto.`),
      },
    )
  }
  const aoPriorizar = (ticket: Ticket, prioridade: boolean) =>
    priorizar.mutate({ id: ticket.pedido.id, prioridade }, { onError: aoErrar })
  const aoCiente = (ticket: Ticket, aviso: AvisoCozinha) =>
    ciente.mutate({ id: ticket.pedido.id, avisoId: aviso.id }, { onError: aoErrar })
  const aoAvisar = (ticket: Ticket, tipo: TipoMensagemCozinha) =>
    avisarSobre.mutate({ id: ticket.pedido.id, rodada: ticket.rodada, tipo }, { onError: aoErrar })
  /** Os produtos do ticket que ainda estão à venda. */
  const esgotaveis = (ticket: Ticket): Produto[] => {
    const ids = new Set(ticket.itens.flatMap((item) => (item.produtoId ? [item.produtoId] : [])))
    return (produtos ?? []).filter((produto) => ids.has(produto.id) && produto.disponivel)
  }
  /** Acabou na cozinha: sai do cardápio na hora; o desfazer devolve. */
  const aoEsgotar = (produto: { id: string; nome: string }) =>
    alternarProduto.mutate(
      { id: produto.id, campo: "disponivel" },
      {
        onError: aoErrar,
        onSuccess: () =>
          toast(`${produto.nome} acabou e saiu do cardápio.`, {
            duration: 6_000,
            action: {
              label: "Desfazer",
              onClick: () =>
                alternarProduto.mutate(
                  { id: produto.id, campo: "disponivel" },
                  { onError: aoErrar },
                ),
            },
          }),
      },
    )
  const emAndamento =
    avancar.isPending && avancar.variables
      ? `${avancar.variables.id}:${avancar.variables.rodada}`
      : undefined

  return (
    // Em tela cheia o quadro vira a página toda: precisa do próprio fundo.
    <div ref={quadro} className="flex flex-1 flex-col gap-5 bg-background p-4 md:p-6 lg:px-8">
      <CabecalhoPagina
        titulo="Cozinha"
        vivo
        resumo={
          colunas
            ? `${colunas[0].tickets.length} a fazer · ${colunas[1].tickets.length} preparando`
            : "Carregando a cozinha…"
        }
        acoes={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void quadro.current?.requestFullscreen?.()}
          >
            <MaximizeIcon data-icon="inline-start" />
            Tela cheia
          </Button>
        }
      />

      <Tabs
        value={aba}
        onValueChange={(valor) => void setAba(valor as (typeof ABAS)[number])}
        className="gap-5"
      >
        <TabsList variant="line" aria-label="Partes da cozinha">
          {/* Texto da aba inativa mais forte: o padrão não passa no contraste. */}
          {ABAS.map((valor) => (
            <TabsTrigger
              key={valor}
              value={valor}
              className="text-foreground/80 dark:text-foreground/80"
            >
              {valor === "quadro" ? "Quadro" : "Ajustes"}
            </TabsTrigger>
          ))}
        </TabsList>

        {vias.elemento}
        <TabsContent value="ajustes">
          <AjustesCozinha />
        </TabsContent>

        <TabsContent value="quadro" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-border/70 py-3">
            <ToggleGroup
              type="single"
              variant="segmento"
              size="sm"
              aria-label="Mostrar"
              value={filtro}
              onValueChange={(valor) => valor && setFiltro(valor as FiltroCozinha)}
            >
              {FILTROS.map(({ valor, rotulo }) => (
                <ToggleGroupItem key={valor} value={valor}>
                  {rotulo}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {pracas.length > 0 && (
              <Select
                value={pracaAtual?.id ?? "todas"}
                onValueChange={(valor) => escolherPraca(valor)}
              >
                <SelectTrigger size="sm" aria-label="Praça" className="min-w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="todas">Todas</SelectItem>
                    {pracas.map((praca) => (
                      <SelectItem key={praca.id} value={praca.id}>
                        <TracoDePraca cor={praca.cor} />
                        {praca.nome}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="cozinha-alerta"
                checked={somLigado}
                onCheckedChange={(ligado) => {
                  ligarSom(ligado)
                  // O toque na chave libera o som no navegador.
                  if (ligado) tocarAlerta(tipoSom)
                }}
              />
              <Label htmlFor="cozinha-alerta" className="cursor-pointer">
                Alerta sonoro
              </Label>
            </div>
          </div>

          <MaisTarde
            tickets={maisTarde}
            tempos={tempos}
            emAndamento={emAndamento}
            aoIniciar={aoAvancar}
          />

          {!colunas || !agora ? (
            // Esqueleto no formato do quadro: as pistas com o título e dois tickets.
            <div
              role="status"
              aria-label="Carregando a cozinha"
              className="grid gap-3 md:grid-cols-3"
            >
              {[0, 1, 2].map((indice) => (
                <div key={indice} className="flex flex-col gap-2.5 max-md:not-first:hidden">
                  <Skeleton className="mb-1 h-4 w-24" />
                  <Skeleton className="h-48 rounded-xl" />
                  <Skeleton className="h-36 rounded-xl" />
                </div>
              ))}
            </div>
          ) : colunas.every((coluna) => coluna.tickets.length === 0) ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ChefHatIcon />
                </EmptyMedia>
                <EmptyTitle>Nada para preparar</EmptyTitle>
                <EmptyDescription>
                  Os pedidos e as rodadas novas aparecem aqui sozinhos.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : telaGrande ? (
            <div className="grid grid-cols-3 items-stretch divide-x divide-border/70">
              {colunas.map((coluna) => (
                <Coluna
                  key={coluna.id}
                  coluna={coluna}
                  agora={agora}
                  tempos={tempos}
                  prazos={loja?.prazos}
                  praca={pracaAtual?.nome}
                  aoProntoNaPraca={aoProntoNaPraca}
                  emAndamento={emAndamento}
                  aoAvancar={aoAvancar}
                  aoRiscar={aoRiscar}
                  aoVoltar={aoVoltar}
                  aoPriorizar={aoPriorizar}
                  aoCiente={aoCiente}
                  aoAvisar={aoAvisar}
                  aoReimprimir={aoReimprimir}
                  esgotaveis={esgotaveis}
                  aoEsgotar={aoEsgotar}
                  comTitulo
                />
              ))}
            </div>
          ) : (
            <Tabs defaultValue={colunas[0].id}>
              <TabsList className="w-full">
                {colunas.map((coluna) => (
                  // Texto da aba inativa mais forte: o padrão não passa no contraste sobre o fundo cinza.
                  <TabsTrigger
                    key={coluna.id}
                    value={coluna.id}
                    className="gap-1.5 text-foreground/80 dark:text-foreground/80"
                  >
                    <Traco tom={tomDoStatus(coluna.status)} />
                    {coluna.titulo}
                    <span className="text-xs tabular-nums">{coluna.tickets.length}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {colunas.map((coluna) => (
                <TabsContent key={coluna.id} value={coluna.id}>
                  <Coluna
                    coluna={coluna}
                    agora={agora}
                    tempos={tempos}
                    prazos={loja?.prazos}
                    praca={pracaAtual?.nome}
                    aoProntoNaPraca={aoProntoNaPraca}
                    emAndamento={emAndamento}
                    aoAvancar={aoAvancar}
                    aoRiscar={aoRiscar}
                    aoVoltar={aoVoltar}
                    aoPriorizar={aoPriorizar}
                    aoCiente={aoCiente}
                    aoAvisar={aoAvisar}
                    aoReimprimir={aoReimprimir}
                    esgotaveis={esgotaveis}
                    aoEsgotar={aoEsgotar}
                    comTitulo={false}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
