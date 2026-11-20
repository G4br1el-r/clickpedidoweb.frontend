"use client"

import { format } from "date-fns"
import {
  AlertTriangleIcon,
  BellRingIcon,
  BikeIcon,
  CalendarIcon,
  ChefHatIcon,
  ChevronUpIcon,
  ClockIcon,
  IdCardIcon,
  MapPinIcon,
  MessageCircleIcon,
  PanelRightOpenIcon,
  PrinterIcon,
  ScaleIcon,
  XIcon,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import type { MotivoEscolhido, Motoboy, Pedido } from "@/lib/admin/dados/tipos"
import { esperaDoAceite } from "@/lib/admin/regras/aceite"
import { resumoDosItens, textoCobranca, type Urgencia, urgencia } from "@/lib/admin/regras/fila"
import { AVISO_DE_MAIORIDADE } from "@/lib/admin/regras/maioridade"
import { linkWhatsApp, mensagemParaCliente } from "@/lib/admin/regras/mensagens"
import { textoRetirada } from "@/lib/admin/regras/numero"
import { pesagemPendente } from "@/lib/admin/regras/pesagem"
import { type TemposDaLoja, textoDoPrazo } from "@/lib/admin/regras/prazo"
import { rotuloCanal, rotuloOrigem } from "@/lib/admin/regras/rotulos"
import { rotuloAcao, tomDoStatus } from "@/lib/admin/regras/status"
import { cn } from "@/lib/utils"
import { ConfirmarComMotivo } from "../pedidos/confirmar-com-motivo"
import { Traco } from "../traco"

const CANAL_CURTO = { entrega: "Entrega", retirada: "Retirada", atendimento: "Salão" } as const

/** O atraso aparece no tempo (pílula colorida) e num anel fino no cartão, nunca numa borda grossa. */
const ANEL_URGENCIA: Record<Urgencia, string> = {
  normal: "ring-border/80",
  atencao: "ring-(--tom-preparo)/45",
  atrasado: "ring-(--tom-cancelado)/45",
}

function Tempo({ pedido, agora, tempos }: { pedido: Pedido; agora: Date; tempos: TemposDaLoja }) {
  const nivel = urgencia(pedido, agora, tempos)
  if (pedido.agendamento) {
    return (
      <span
        className={cn(
          "flex items-center gap-1",
          nivel === "atrasado" && "font-medium text-destructive",
        )}
      >
        <ClockIcon className="size-3.5" aria-hidden="true" />
        {format(new Date(pedido.agendamento.inicio), "HH:mm")} · {pedido.agendamento.duracaoMin} min
        {nivel === "atrasado" && " · passou da hora"}
      </span>
    )
  }
  const minutos = Math.max(0, Math.floor((agora.getTime() - Date.parse(pedido.criadoEm)) / 60_000))
  const prazo = textoDoPrazo(pedido, tempos, agora)
  const Icone = nivel === "normal" ? ClockIcon : AlertTriangleIcon
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-md whitespace-nowrap tabular-nums",
        nivel !== "normal" && "-my-0.5 px-1.5 py-0.5 font-medium",
        nivel === "atencao" && "bg-(--tom-preparo)/12 text-(--tom-preparo-texto)",
        nivel === "atrasado" &&
          "bg-(--tom-cancelado)/10 text-destructive dark:text-(--tom-cancelado)",
      )}
    >
      <Icone className="size-3.5" aria-hidden="true" />
      {prazo ? (
        <>
          <span aria-hidden="true">
            até {prazo.ate} · {prazo.resta}
          </span>
          <span className="sr-only">{prazo.completo}</span>
        </>
      ) : (
        <>
          {format(new Date(pedido.criadoEm), "HH:mm")} · {minutos} min
          {nivel === "atrasado" && <span className="sr-only">, atrasado</span>}
        </>
      )}
    </span>
  )
}

/** Cartão de um pedido na fila: o que preparar, para quem, como cobrar e a próxima etapa. */
export function CartaoFila({
  pedido,
  agora,
  motoboys,
  novo,
  ocupado,
  limiteAceiteMin,
  tempos,
  seloCliente = null,
  nomeLoja = "",
  compacto = false,
  selecao,
  despacha = false,
  maioridade = false,
  naCozinha = false,
  aoAceitar,
  aoRecusar,
  aoCancelar,
  aoAvancar,
  aoServir,
  aoPesar,
  aoAbrir,
  aoImprimir,
}: {
  pedido: Pedido
  agora: Date
  motoboys: Motoboy[]
  novo: boolean
  ocupado: boolean
  limiteAceiteMin: number
  /** Tempos de entrega e retirada da loja: dão o prazo prometido. */
  tempos: TemposDaLoja
  /** "1º pedido" ou "Cliente frequente", pelo que o cliente já pediu. */
  seloCliente?: string | null
  /** Nome da loja, para a mensagem ao cliente. */
  nomeLoja?: string
  /** Modo compacto deste aparelho: uma linha que abre ao tocar. */
  compacto?: boolean
  /** Seleção para ações em lote: a caixa aparece no modo de seleção; Shift+clique marca. */
  selecao?: { ativa: boolean; marcado: boolean; alternar: () => void }
  /** Entrega pronta numa loja com motoboys: o botão vira "Despachar". */
  despacha?: boolean
  /** Adega: o pedido tem bebida alcoólica e só sai com documento (+18). */
  maioridade?: boolean
  /** O pedido está na tela da Cozinha (a fazer ou preparando). */
  naCozinha?: boolean
  aoAceitar: () => void
  aoRecusar: (escolhido: MotivoEscolhido) => void
  aoCancelar: (escolhido: MotivoEscolhido) => void
  aoAvancar: () => void
  /** Mesa pronta: a rodada chegou à mesa. */
  aoServir?: () => void
  /** Açougue: abre a pesagem ali mesmo. Enquanto falta pesar, é a ação do cartão. */
  aoPesar?: () => void
  aoAbrir: () => void
  aoImprimir: () => void
}) {
  const semMovimento = useReducedMotion()
  const espera = esperaDoAceite(pedido, agora, limiteAceiteMin)
  // Entrega pronta, com motoboys: a próxima etapa é despachar (escolher quem leva).
  const acao = despacha ? "Despachar" : rotuloAcao(pedido.tipo, pedido.status)
  const motoboy = motoboys.find((item) => item.id === pedido.motoboyId)
  // Açougue: carne no quilo que ainda não passou pela balança.
  const aPesar = pesagemPendente(pedido)
  // Em preparo, falta só a balança: "Marcar como pronto" espera a pesagem.
  const pesarAgora = aPesar && pedido.status === "em-preparo" && aoPesar
  const canal = pedido.mesa
    ? `Mesa ${pedido.mesa.numero}`
    : CANAL_CURTO[pedido.tipo as keyof typeof CANAL_CURTO]
  const [expandido, setExpandido] = useState(false)
  // Quem espera aceite pede ação: não se recolhe nem no compacto.
  const recolhido = compacto && !expandido && !espera

  return (
    <motion.article
      // O mesmo id em todas as colunas: ao avançar, o cartão anda até a coluna seguinte.
      layoutId={semMovimento ? undefined : `cartao-fila-${pedido.id}`}
      initial={semMovimento ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        default: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
        layout: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
      }}
      aria-labelledby={`pedido-${pedido.id}`}
      // No computador, as setas trazem o foco ao cartão (atalhos da fila).
      tabIndex={-1}
      data-pedido-id={pedido.id}
      className="relative rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Card
        // Shift+clique (mouse) marca o pedido para as ações em lote, sem entrar no modo.
        onClick={(evento) => {
          if (!evento.shiftKey || !selecao) return
          evento.preventDefault()
          selecao.alternar()
        }}
        className={cn(
          "gap-3 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 transition-[box-shadow] duration-200",
          ANEL_URGENCIA[espera?.passou ? "atrasado" : urgencia(pedido, agora, tempos)],
          novo && "ring-2 ring-(--atencao)/55",
          espera?.passou && "ring-2",
          selecao?.marcado && "ring-2 ring-foreground",
        )}
      >
        {/* Chegou agora: um realce na cor de atenção que esmaece sozinho. */}
        {novo && !semMovimento && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-xl bg-(--atencao)"
            initial={{ opacity: 0.1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 2.4, ease: "easeOut" }}
          />
        )}
        {recolhido ? (
          <button
            type="button"
            aria-expanded={false}
            onClick={() => setExpandido(true)}
            className="flex w-full min-w-0 items-center gap-2 px-3 text-left focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Traco tom={tomDoStatus(pedido.status)} className="h-3" />
            <span id={`pedido-${pedido.id}`} className="text-base font-semibold tabular-nums">
              #{pedido.numero}
            </span>
            <span className="text-[13px] text-muted-foreground">{canal}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{pedido.cliente.nome}</span>
            <span className="text-xs text-muted-foreground">
              <Tempo pedido={pedido} agora={agora} tempos={tempos} />
            </span>
          </button>
        ) : (
          <>
            <CardHeader className="flex flex-row flex-wrap items-center gap-x-2 gap-y-1 px-3">
              {selecao?.ativa && (
                <Checkbox
                  checked={selecao.marcado}
                  onCheckedChange={selecao.alternar}
                  aria-label={`Selecionar #${pedido.numero}`}
                  className="mr-1"
                />
              )}
              {/* O traço da etapa: troca de cor quando o pedido anda para a coluna seguinte. */}
              <Traco tom={tomDoStatus(pedido.status)} className="h-3" />
              <h3 id={`pedido-${pedido.id}`} className="text-base font-semibold tabular-nums">
                #{pedido.numero}
              </h3>
              <span
                data-canal=""
                title={rotuloCanal(pedido.tipo)}
                className="text-[13px] text-muted-foreground"
              >
                {canal}
              </span>
              <Badge variant="outline">{rotuloOrigem(pedido.origem)}</Badge>
              {naCozinha && (
                <Badge variant="outline" className="gap-1">
                  <ChefHatIcon aria-hidden="true" />
                  Na cozinha
                </Badge>
              )}
              {aPesar && (
                <Badge variant="secondary" className="gap-1">
                  <ScaleIcon aria-hidden="true" />A pesar
                </Badge>
              )}
              {novo && (
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                  <span aria-hidden="true" className="h-3 w-[3px] rounded-full bg-(--atencao)" />
                  Chegou agora
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">
                <Tempo pedido={pedido} agora={agora} tempos={tempos} />
              </span>
              {compacto && expandido && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Recolher #${pedido.numero}`}
                  aria-expanded={true}
                  onClick={() => setExpandido(false)}
                >
                  <ChevronUpIcon />
                </Button>
              )}
            </CardHeader>

            <CardContent className="flex flex-col gap-2 px-3 text-sm">
              {maioridade && (
                <p className="flex items-center gap-1.5 text-[13px] font-medium">
                  <IdCardIcon className="size-4" aria-hidden="true" />
                  {AVISO_DE_MAIORIDADE}
                </p>
              )}
              {espera && (
                // A loja nunca recusa sozinha: passou do limite, o aviso só fica mais forte.
                <p
                  className={cn(
                    "flex items-center gap-1.5 self-start rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
                    espera.passou
                      ? "bg-(--tom-cancelado)/10 text-destructive dark:text-(--tom-cancelado)"
                      : "bg-(--atencao)/12 text-foreground",
                  )}
                >
                  <BellRingIcon className="size-3.5" aria-hidden="true" />
                  Esperando aceite há {espera.minutos} min
                  {espera.passou && <span className="sr-only">, passou do limite</span>}
                </p>
              )}
              <div className="flex flex-col">
                {/* O selo do cliente fica com o nome: o cabeçalho é do pedido. */}
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{pedido.cliente.nome}</span>
                  {seloCliente && <Badge variant="secondary">{seloCliente}</Badge>}
                </span>
                {pedido.mesa?.garcom && (
                  <span className="text-xs text-muted-foreground">
                    Garçom: {pedido.mesa.garcom}
                  </span>
                )}
                {pedido.endereco && (
                  <span className="flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPinIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    {pedido.endereco.logradouro}, {pedido.endereco.numero} ·{" "}
                    {pedido.endereco.bairro}
                  </span>
                )}
              </div>
              <ul className="flex flex-col gap-1">
                {pedido.itens.map((item) => (
                  <li key={item.id}>
                    <span className="font-medium tabular-nums">{item.quantidade}×</span> {item.nome}
                    {item.opcoes.length > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {item.opcoes.join(" · ")}
                      </span>
                    )}
                    {item.observacao && (
                      <span className="block text-xs italic">“{item.observacao}”</span>
                    )}
                  </li>
                ))}
              </ul>
              {pedido.observacao && (
                <p className="rounded-md bg-foreground/[0.05] px-2 py-1.5 text-xs">
                  Obs.: {pedido.observacao}
                </p>
              )}
              {pedido.dataRetirada && (
                <p className="flex items-center gap-1 text-xs font-medium">
                  <CalendarIcon className="size-3.5" aria-hidden="true" />
                  {textoRetirada(pedido.dataRetirada)}
                </p>
              )}
              <p className="text-xs text-muted-foreground tabular-nums">{resumoDosItens(pedido)}</p>
              <p className="text-xs text-muted-foreground">{textoCobranca(pedido)}</p>
              {pedido.impressoEm && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <PrinterIcon className="size-3.5" aria-hidden="true" />
                  Impresso às {format(new Date(pedido.impressoEm), "HH:mm")}
                </p>
              )}
              {motoboy && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BikeIcon className="size-3.5" aria-hidden="true" />
                  {motoboy.nome}
                </p>
              )}
            </CardContent>

            <CardFooter className="flex-wrap gap-2 border-border/70 bg-transparent px-3 pt-3">
              {espera ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="min-w-[min(100%,7rem)] flex-1"
                    disabled={ocupado}
                    onClick={aoAceitar}
                  >
                    Aceitar
                  </Button>
                  <ConfirmarComMotivo
                    gatilho={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={ocupado}
                        data-acao="recusar"
                      >
                        Recusar
                      </Button>
                    }
                    titulo={`Recusar o pedido #${pedido.numero}?`}
                    descricao="O cliente fica sabendo do motivo. Se já pagou, o pedido fica marcado para devolver."
                    confirmar="Sim, recusar"
                    aoConfirmar={aoRecusar}
                  />
                </>
              ) : pesarAgora ? (
                <Button
                  type="button"
                  size="sm"
                  className="min-w-[min(100%,7rem)] flex-1"
                  disabled={ocupado}
                  onClick={aoPesar}
                >
                  <ScaleIcon data-icon="inline-start" />
                  Pesar
                </Button>
              ) : acao ? (
                <Button
                  type="button"
                  size="sm"
                  className="min-w-[min(100%,7rem)] flex-1"
                  disabled={ocupado}
                  onClick={aoAvancar}
                >
                  {acao}
                </Button>
              ) : aoServir && pedido.tipo === "mesa" && pedido.status === "pronto" ? (
                // A mesa sai da fila quando a rodada chega; a conta continua em Mesas.
                <Button
                  type="button"
                  size="sm"
                  className="min-w-[min(100%,7rem)] flex-1"
                  disabled={ocupado}
                  onClick={aoServir}
                >
                  Servido
                </Button>
              ) : (
                <span className="flex-1 text-xs text-muted-foreground">Fecha em Mesas</span>
              )}
              {/* Os ícones andam juntos: sem lugar, descem inteiros para a linha de baixo. */}
              <div className="ml-auto flex items-center gap-2">
                <Button asChild type="button" size="icon-sm" variant="outline">
                  <a
                    href={linkWhatsApp(
                      pedido.cliente.telefone,
                      mensagemParaCliente(pedido, {
                        loja: nomeLoja,
                        endereco: typeof window === "undefined" ? "" : window.location.origin,
                      }),
                    )}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Avisar #${pedido.numero} no WhatsApp`}
                    title={`Avisar ${pedido.cliente.nome.split(" ")[0]} no WhatsApp`}
                  >
                    <MessageCircleIcon />
                  </a>
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label={`${pedido.impressoEm ? "Reimprimir" : "Imprimir"} cupom de #${pedido.numero}`}
                  onClick={aoImprimir}
                >
                  <PrinterIcon />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Detalhes"
                  title={`Detalhes de #${pedido.numero}`}
                  onClick={aoAbrir}
                >
                  <PanelRightOpenIcon />
                </Button>
                {/* Quem espera aceite se recusa; o resto se cancela, sempre com motivo. */}
                {!espera && (
                  <ConfirmarComMotivo
                    gatilho={
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Cancelar pedido #${pedido.numero}`}
                        title={`Cancelar #${pedido.numero}`}
                        disabled={ocupado}
                      >
                        <XIcon />
                      </Button>
                    }
                    titulo={`Cancelar o pedido #${pedido.numero}?`}
                    descricao="O pedido sai da fila e da cozinha. Se já estava pago, fica marcado para devolver ao cliente."
                    confirmar="Sim, cancelar"
                    aoConfirmar={aoCancelar}
                  />
                )}
              </div>
            </CardFooter>
          </>
        )}
      </Card>
    </motion.article>
  )
}
