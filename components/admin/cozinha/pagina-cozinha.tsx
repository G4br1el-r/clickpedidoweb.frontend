"use client"

import NumberFlow from "@number-flow/react"
import { ChefHatIcon, ClipboardListIcon, MaximizeIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
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
  useEntregarRefazer,
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
import { esgotados, resumoDeProducao } from "@/lib/admin/regras/producao"
import { tomDoStatus } from "@/lib/admin/regras/status"
import { tocarAlerta } from "@/lib/admin/som"
import { CabecalhoPagina } from "../cabecalho-pagina"
import { useFilaDeVias } from "../impressao/via-cozinha"
import { Traco } from "../traco"
import { AjustesCozinha } from "./ajustes-cozinha"
import { AtalhosCozinha } from "./atalhos-cozinha"
import { DesempenhoCozinha, FaixaDoTurnoAoVivo } from "./desempenho-cozinha"
import { ESCALA_DO_QUADRO, ExibicaoCozinha } from "./exibicao-cozinha"
import { HistoricoCozinha } from "./historico-cozinha"
import { JanelaRefazer } from "./janela-refazer"
import { MaisTarde } from "./mais-tarde"
import { ResumoProducao } from "./resumo-producao"
import { nomeDoTicket, TicketCozinha } from "./ticket-cozinha"
import { TracoDePraca } from "./traco-de-praca"
import { useAtalhosDaCozinha } from "./use-atalhos-da-cozinha"
import { useSonsDaCozinha } from "./use-sons-da-cozinha"
import { useViasDaCozinha } from "./use-vias-da-cozinha"

const ABAS = ["quadro", "historico", "desempenho", "ajustes"] as const

const NOME_DA_ABA: Record<(typeof ABAS)[number], string> = {
  quadro: "Quadro",
  historico: "Histórico",
  desempenho: "Desempenho",
  ajustes: "Ajustes",
}

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
  destacados,
  compacto,
  aoRefazer,
  aoEntregar,
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
  /** Com um produto tocado no resumo: os tickets dele. Os outros ficam apagados. */
  destacados: Set<string> | null
  compacto: boolean
  aoRefazer: (ticket: Ticket) => void
  aoEntregar: (ticket: Ticket) => void
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
              apagado={destacados ? !destacados.has(ticket.id) : false}
              compacto={compacto}
              aoRefazer={() => aoRefazer(ticket)}
              aoEntregar={() => aoEntregar(ticket)}
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
  const entregar = useEntregarRefazer()
  const imprimirVias = usePreferenciasFila((estado) => estado.imprimirVias)
  const vias = useFilaDeVias()
  useSonsDaCozinha(pedidos, tempos, tique, visao, pracaAtual?.tocaSom === false)
  const somLigado = usePreferenciasFila((estado) => estado.somLigado)
  const ligarSom = usePreferenciasFila((estado) => estado.ligarSom)
  const tipoSom = useSomDoAparelho()
  const quadro = useRef<HTMLDivElement>(null)
  const tamanho = usePreferenciasFila((estado) => estado.tamanho)
  const compacto = usePreferenciasFila((estado) => estado.compacto)
  const [resumoAberto, setResumoAberto] = useState(false)
  const [ajudaAberta, setAjudaAberta] = useState(false)
  const [refazendo, setRefazendo] = useState<Ticket | null>(null)
  // A última ação com Desfazer ainda na tela: o Z do teclado desfaz.
  const ultimoDesfazer = useRef<{ id: string | number; desfazer: () => void } | null>(null)
  const [destaque, setDestaque] = useState<string | null>(null)

  const colunas = pedidos && agora ? colunasDaCozinha(pedidos, filtro, agora, tempos, visao) : null
  const maisTarde =
    pedidos && agora ? maisTardeNaCozinha(pedidos, filtro, agora, tempos, visao) : []
  const producao = colunas ? resumoDeProducao(colunas) : []
  const doQuadro = (id: string) =>
    colunas?.flatMap((coluna) => coluna.tickets).find((ticket) => ticket.id === id)
  useAtalhosDaCozinha({
    ligado: telaGrande && aba === "quadro",
    grade: (colunas ?? []).map((coluna) => coluna.tickets.map((ticket) => ticket.id)),
    aoAvancar: (id) => {
      const ticket = doQuadro(id)
      if (!ticket || ticket.status === "pronto" || ticket.pedido.status === "cancelado") return null
      // Na praça, o ticket em preparo fica pronto só na parte dela.
      if (pracaAtual && ticket.status === "em-preparo") {
        aoProntoNaPraca(ticket)
        return "pronto"
      }
      aoAvancar(ticket)
      return ticket.status === "recebido" ? "em-preparo" : "pronto"
    },
    aoPriorizar: (id) => {
      const ticket = doQuadro(id)
      if (ticket && !ticket.refazer) aoPriorizar(ticket, !ticket.pedido.prioridade)
    },
    aoAjuda: () => setAjudaAberta(true),
    aoDesfazer: () => {
      const ultimo = ultimoDesfazer.current
      if (!ultimo) return
      ultimoDesfazer.current = null
      toast.dismiss(ultimo.id)
      ultimo.desfazer()
    },
    aoRiscar: (id, posicao) => {
      const ticket = doQuadro(id)
      const item = ticket?.itens[posicao - 1]
      if (ticket && item && ticket.pedido.status !== "cancelado") {
        aoRiscar(ticket, item, !item.feitoEm)
      }
    },
  })
  const linhaDestacada = producao.find((linha) => linha.chave === destaque)
  const destacados = linhaDestacada ? new Set(linhaDestacada.tickets) : null
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
  /**
   * Aviso com Desfazer. Enquanto ele está na tela, o Z do teclado faz o mesmo que o botão.
   */
  const comDesfazer = (mensagem: string, desfazer: () => void) => {
    const esquecer = () => {
      if (ultimoDesfazer.current?.id === id) ultimoDesfazer.current = null
    }
    const id = toast(mensagem, {
      duration: 6_000,
      action: {
        label: "Desfazer",
        onClick: () => {
          esquecer()
          desfazer()
        },
      },
      onDismiss: esquecer,
      onAutoClose: esquecer,
    })
    ultimoDesfazer.current = { id, desfazer }
  }
  /** O avanço e a volta avisam para onde o ticket foi, com Desfazer para o toque errado. */
  const avisar = (ticket: Ticket, para: StatusTicket, desfazer: () => void) =>
    comDesfazer(`${nomeDoTicket(ticket)} foi para ${NOME_DA_COLUNA[para]}.`, desfazer)
  const aoAvancar = (ticket: Ticket) => {
    const mudanca = {
      id: ticket.pedido.id,
      rodada: ticket.rodada,
      de: ticket.status,
      refazer: ticket.refazer?.numero,
    }
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
    const mudanca = {
      id: ticket.pedido.id,
      rodada: ticket.rodada,
      de: ticket.status,
      refazer: ticket.refazer?.numero,
    }
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
      { id: ticket.pedido.id, rodada: ticket.rodada, visao, refazer: ticket.refazer?.numero },
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
          comDesfazer(`${produto.nome} acabou e saiu do cardápio.`, () =>
            alternarProduto.mutate({ id: produto.id, campo: "disponivel" }, { onError: aoErrar }),
          ),
      },
    )
  /** O refazer da entrega ou da retirada foi entregue: sai do quadro. */
  const aoEntregar = (ticket: Ticket) => {
    if (!ticket.refazer) return
    entregar.mutate(
      { id: ticket.pedido.id, numero: ticket.refazer.numero },
      { onError: aoErrar, onSuccess: () => toast(`${nomeDoTicket(ticket)}: entregue.`) },
    )
  }
  /** Voltou: o produto esgotado volta ao cardápio. */
  const aoVoltarAoCardapio = (produto: { id: string; nome: string }) =>
    alternarProduto.mutate(
      { id: produto.id, campo: "disponivel" },
      { onError: aoErrar, onSuccess: () => toast(`${produto.nome} voltou ao cardápio.`) },
    )
  const resumo = (
    <ResumoProducao
      linhas={producao}
      produtos={produtos ?? []}
      esgotados={esgotados(produtos ?? [])}
      destaque={destaque}
      aoDestacar={(chave) => {
        setDestaque(chave)
        // No celular, a gaveta cobre o quadro: fecha para mostrar o destaque.
        if (!telaGrande) setResumoAberto(false)
      }}
      aoAcabar={aoEsgotar}
      aoVoltar={aoVoltarAoCardapio}
    />
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
              {NOME_DA_ABA[valor]}
            </TabsTrigger>
          ))}
        </TabsList>

        {vias.elemento}
        <AtalhosCozinha aberta={ajudaAberta} aoMudar={setAjudaAberta} />
        {refazendo && <JanelaRefazer ticket={refazendo} aoFechar={() => setRefazendo(null)} />}
        <TabsContent value="historico">
          <HistoricoCozinha aoReimprimir={aoReimprimir} aoRefazer={setRefazendo} />
        </TabsContent>
        <TabsContent value="desempenho">
          <DesempenhoCozinha />
        </TabsContent>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={resumoAberto}
              onClick={() => setResumoAberto((aberto) => !aberto)}
            >
              <ClipboardListIcon data-icon="inline-start" />
              Em produção
              <span className="tabular-nums text-muted-foreground">
                {producao.reduce((soma, linha) => soma + linha.quantidade, 0)}
              </span>
            </Button>
            <ExibicaoCozinha />
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

          {agora && <FaixaDoTurnoAoVivo agora={agora} tempos={tempos} intervalo={intervalo} />}

          <MaisTarde
            tickets={maisTarde}
            tempos={tempos}
            emAndamento={emAndamento}
            aoIniciar={aoAvancar}
          />

          <div className="flex items-start gap-6">
            {/* O tamanho muda só a escala do quadro. */}
            <div
              data-tamanho={tamanho}
              style={{ zoom: ESCALA_DO_QUADRO[tamanho] ?? 1 }}
              className="min-w-0 flex-1"
            >
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
                      destacados={destacados}
                      compacto={compacto}
                      aoRefazer={setRefazendo}
                      aoEntregar={aoEntregar}
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
                        destacados={destacados}
                        compacto={compacto}
                        aoRefazer={setRefazendo}
                        aoEntregar={aoEntregar}
                        comTitulo={false}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </div>
            {telaGrande && resumoAberto && (
              <aside
                aria-label="Resumo de produção"
                className="sticky top-4 w-72 shrink-0 border-l border-border/70 pl-4"
              >
                {resumo}
              </aside>
            )}
          </div>
          {!telaGrande && (
            <Drawer open={resumoAberto} onOpenChange={setResumoAberto}>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Em produção</DrawerTitle>
                  <DrawerDescription>
                    O que falta fazer, somado por produto. Toque num para ver os tickets dele.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-6">{resumo}</div>
              </DrawerContent>
            </Drawer>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
