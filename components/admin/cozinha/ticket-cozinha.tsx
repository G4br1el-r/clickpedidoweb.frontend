"use client"

import { format } from "date-fns"
import {
  AlertTriangleIcon,
  BanIcon,
  ClockIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PrinterIcon,
  Undo2Icon,
  ZapIcon,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type {
  AvisoCozinha,
  ConfigLoja,
  ItemPedido,
  Pedido,
  TipoMensagemCozinha,
} from "@/lib/admin/dados/tipos"
import {
  type ConfigCozinha,
  mensagensPendentes,
  minutosNaCozinha,
  prometidoAoCliente,
  TEXTO_DA_MENSAGEM,
  type TicketCozinha as Ticket,
  urgenciaNaCozinha,
} from "@/lib/admin/regras/cozinha"
import type { Urgencia } from "@/lib/admin/regras/fila"
import { cn } from "@/lib/utils"
import { Traco } from "../traco"

/** O atraso aparece no tempo (pílula colorida) e num anel fino no ticket, nunca numa borda grossa. */
const ANEL_URGENCIA: Record<Urgencia, string> = {
  normal: "ring-border/80",
  atencao: "ring-(--tom-preparo)/45",
  atrasado: "ring-(--tom-cancelado)/45",
}

const ESTILO_TEMPO: Record<Urgencia, string> = {
  normal: "text-muted-foreground",
  atencao: "-my-0.5 px-1.5 py-0.5 font-semibold bg-(--tom-preparo)/12 text-(--tom-preparo-texto)",
  atrasado:
    "-my-0.5 px-1.5 py-0.5 font-semibold bg-(--tom-cancelado)/10 text-destructive dark:text-(--tom-cancelado)",
}

/** Depois de pronto, quem segue com o pedido. */
const DEPOIS_DE_PRONTO: Partial<Record<Pedido["tipo"], string>> = {
  mesa: "Servir na mesa",
  entrega: "Aguardando o motoboy",
  retirada: "Aguardando o cliente",
}

const TIPOS_DE_MENSAGEM = Object.keys(TEXTO_DA_MENSAGEM) as TipoMensagemCozinha[]

/** "Vai atrasar ~10 min" vira "vai atrasar ~10 min", para ler depois de "Avisado:". */
const minuscula = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1)

const origem = (pedido: Pedido) =>
  pedido.mesa ? `Mesa ${pedido.mesa.numero}` : pedido.tipo === "entrega" ? "Entrega" : "Retirada"

/**
 * O que preparar, item por item. A linha inteira é o alvo de toque (mão suja, tablet na
 * bancada): tocar risca o item, tocar de novo desfaz. Opções e observação ficam na linha
 * e entram na descrição para quem usa leitor de tela.
 */
function Itens({
  itens,
  bloqueado,
  cancelado,
  aoRiscar,
}: {
  itens: ItemPedido[]
  bloqueado: boolean
  cancelado: boolean
  aoRiscar: (item: ItemPedido, feito: boolean) => void
}) {
  return (
    <ul aria-label="Para preparar" className="-mx-1.5 flex flex-col gap-0.5">
      {itens.map((item) => {
        const feito = Boolean(item.feitoEm)
        const tachado = feito || cancelado
        const descricao = [item.opcoes.join(" · "), item.observacao].filter(Boolean).join(". ")
        return (
          <li key={item.id}>
            <label
              htmlFor={`riscar-${item.id}`}
              className="flex min-h-11 w-full cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors duration-150 hover:bg-foreground/[0.04] active:bg-foreground/[0.07] has-disabled:cursor-default has-disabled:hover:bg-transparent has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <Checkbox
                id={`riscar-${item.id}`}
                checked={feito}
                disabled={bloqueado}
                onCheckedChange={(marcado) => aoRiscar(item, marcado === true)}
                aria-label={`${item.quantidade}× ${item.nome}`}
                aria-description={descricao || undefined}
                // A linha inteira já mostra o foco.
                className="mt-0.5 size-5 rounded-md border-foreground/45 focus-visible:ring-0 disabled:opacity-100 data-checked:border-primary"
              />
              <span
                className={cn(
                  "flex min-w-0 flex-col text-[17px] leading-snug transition-opacity duration-150",
                  tachado && "text-muted-foreground line-through decoration-foreground/40",
                )}
              >
                <span>
                  <span className="font-semibold tabular-nums">{item.quantidade}×</span> {item.nome}
                </span>
                {item.opcoes.length > 0 && (
                  <span className="text-sm leading-normal text-muted-foreground">
                    {item.opcoes.join(" · ")}
                  </span>
                )}
                {item.observacao && (
                  // Observação do item é o que a cozinha não pode perder: o tom de atenção.
                  <span className="mt-1 block w-fit rounded-md bg-(--tom-preparo)/12 px-1.5 py-0.5 text-sm font-medium text-(--tom-preparo-texto)">
                    {item.observacao}
                  </span>
                )}
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

/** "Mesa 5 · #12", e a rodada quando não é a primeira: "Mesa 5 · #12 · 2ª rodada". */
export const nomeDoTicket = ({ pedido, rodada }: Ticket) =>
  `${origem(pedido)} · #${pedido.numero}${rodada > 1 ? ` · ${rodada}ª rodada` : ""}`

/** Ticket da cozinha: uma rodada, com origem, cronômetro, o que preparar e a próxima etapa. */
export function TicketCozinha({
  ticket,
  agora,
  tempos,
  prazos,
  praca,
  ocupado,
  aoAvancar,
  aoRiscar,
  aoVoltar,
  aoPriorizar,
  aoCiente,
  aoAvisar,
  aoReimprimir,
  esgotaveis,
  aoEsgotar,
}: {
  ticket: Ticket
  agora: Date
  /** Os tempos de atenção e atraso da loja, e quanto ela leva para preparar. */
  tempos: ConfigCozinha
  /** O tempo de entrega e de retirada da loja: o horário prometido ao cliente sai dele. */
  prazos?: ConfigLoja["prazos"]
  /** Na tela de uma praça: o nome dela e o pronto que risca só a parte dela. */
  praca?: { nome: string; aoPronto: () => void }
  ocupado: boolean
  aoAvancar: () => void
  aoRiscar: (item: ItemPedido, feito: boolean) => void
  aoVoltar: () => void
  aoPriorizar: (prioridade: boolean) => void
  aoCiente: (aviso: AvisoCozinha) => void
  /** Mensagem rápida para o salão (mesa) ou o caixa (entrega e retirada). */
  aoAvisar: (tipo: TipoMensagemCozinha) => void
  /** Imprime de novo a via da cozinha. */
  aoReimprimir: () => void
  /** Produtos do ticket que ainda estão no cardápio: a cozinha pode avisar que acabaram. */
  esgotaveis: { id: string; nome: string }[]
  aoEsgotar: (produto: { id: string; nome: string }) => void
}) {
  const semMovimento = useReducedMotion()
  const { pedido, rodada, itens } = ticket
  const pronto = ticket.status === "pronto"
  // Pronto não corre mais contra o relógio: o ticket fica quieto.
  const nivel = pronto ? "normal" : urgenciaNaCozinha(ticket, agora, tempos)
  const minutos = Math.max(0, minutosNaCozinha(ticket, agora, tempos))
  const IconeTempo = nivel === "normal" ? ClockIcon : AlertTriangleIcon
  const feitos = itens.filter((item) => item.feitoEm).length
  const cancelamento = ticket.avisos.find((aviso) => aviso.tipo === "cancelado")
  const cancelado = pedido.status === "cancelado"
  const prometido = pronto || cancelado ? null : prometidoAoCliente(ticket, prazos, agora)
  const alteracoes = ticket.avisos.filter((aviso) => aviso.tipo === "alterado")
  // Na tela de uma praça: o que as outras ainda não terminaram.
  const outras = (ticket.outras ?? []).map((outra) => `${outra.nome} ${outra.faltam}`).join(", ")
  const aguardando = (ticket.outras ?? []).map((outra) => outra.nome).join(", ")
  const avisados = mensagensPendentes(pedido).filter((mensagem) => mensagem.rodada === rodada)

  return (
    <motion.article
      // O mesmo id em todas as colunas: ao avançar, o ticket anda até a coluna seguinte.
      layoutId={semMovimento ? undefined : `ticket-cozinha-${ticket.id}`}
      initial={semMovimento ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        default: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
        layout: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
      }}
      aria-label={nomeDoTicket(ticket)}
      data-urgencia={nivel}
      data-cancelado={cancelado || undefined}
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-card p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 transition-[box-shadow] duration-200",
        ANEL_URGENCIA[nivel],
        // Prioridade é o que exige o olho agora: o laranja de atenção, só no anel e no ícone.
        pedido.prioridade && !cancelado && "ring-2 ring-(--atencao)/60",
        cancelado && "ring-2 ring-(--tom-cancelado)/45",
      )}
    >
      {cancelado && (
        <span className="-mb-1.5 flex items-center gap-2 text-[13px] font-semibold tracking-wide uppercase">
          <Traco tom="cancelado" />
          Cancelado
        </span>
      )}
      {pedido.prioridade && !cancelado && (
        <span className="-mb-1.5 flex items-center gap-1 text-[13px] font-semibold">
          <ZapIcon className="size-3.5 fill-current text-(--atencao)" aria-hidden="true" />
          Prioridade
        </span>
      )}
      {/* Coluna estreita (tablet com a lateral aberta): o tempo e o menu descem de linha. */}
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-base font-semibold whitespace-nowrap">{origem(pedido)}</span>
        <span className="text-sm text-muted-foreground tabular-nums">#{pedido.numero}</span>
        {rodada > 1 && (
          <span className="text-sm font-medium whitespace-nowrap text-muted-foreground">
            {rodada}ª rodada
          </span>
        )}
        <div className="-my-1 ml-auto flex shrink-0 items-center gap-1">
          {!pronto && !cancelado && (
            <span
              className={cn(
                "flex items-center gap-1 rounded-md text-sm whitespace-nowrap tabular-nums",
                ESTILO_TEMPO[nivel],
              )}
            >
              <IconeTempo className="size-3.5" aria-hidden="true" />
              {minutos} min
              {nivel === "atrasado" && <span className="sr-only">, atrasado</span>}
            </span>
          )}
          {!cancelado && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Mais ações"
                  className="-mr-1 size-9 text-muted-foreground"
                >
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuCheckboxItem
                  checked={Boolean(pedido.prioridade)}
                  onCheckedChange={(marcada) => aoPriorizar(marcada === true)}
                >
                  Prioridade
                </DropdownMenuCheckboxItem>
                {ticket.status !== "recebido" && (
                  <DropdownMenuItem onSelect={aoVoltar}>
                    <Undo2Icon />
                    {ticket.status === "pronto" ? "Voltar para Preparando" : "Voltar para A fazer"}
                  </DropdownMenuItem>
                )}
                {itens.length > 0 && (
                  <DropdownMenuItem onSelect={aoReimprimir}>
                    <PrinterIcon />
                    Reimprimir via
                  </DropdownMenuItem>
                )}
                {itens.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <MessageSquareIcon />
                        {pedido.tipo === "mesa" ? "Avisar o salão…" : "Avisar o caixa…"}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {TIPOS_DE_MENSAGEM.map((tipo) => (
                          <DropdownMenuItem key={tipo} onSelect={() => aoAvisar(tipo)}>
                            {TEXTO_DA_MENSAGEM[tipo]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
                {esgotaveis.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <BanIcon />
                        Acabou…
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {esgotaveis.map((produto) => (
                          <DropdownMenuItem key={produto.id} onSelect={() => aoEsgotar(produto)}>
                            {produto.nome}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div className="-mt-1.5 flex flex-col text-[13px] text-muted-foreground">
        <span className="font-medium text-foreground">{pedido.cliente.nome}</span>
        {pedido.mesa?.garcom && <span>Garçom: {pedido.mesa.garcom}</span>}
        {prometido && (
          <span
            className={cn(
              "tabular-nums",
              prometido.minutos < 0 && "font-medium text-destructive dark:text-(--tom-cancelado)",
            )}
          >
            até {format(new Date(prometido.ate), "HH:mm")} ·{" "}
            {prometido.minutos < 0
              ? `passou ${-prometido.minutos} min`
              : `faltam ${prometido.minutos} min`}
          </span>
        )}
      </div>

      {alteracoes.map((aviso) => (
        <div
          key={aviso.id}
          className="flex items-center gap-2 rounded-lg bg-(--tom-cancelado)/[0.07] py-1.5 pr-1.5 pl-2.5"
        >
          <Traco tom="cancelado" />
          <span className="min-w-0 flex-1 text-sm font-medium">
            Alterado: tirou{" "}
            {(aviso.itens ?? []).map((item) => `${item.quantidade}× ${item.nome}`).join(", ")}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => aoCiente(aviso)}>
            Ciente
          </Button>
        </div>
      ))}
      {avisados.map((mensagem) => (
        // Fica até o salão ou o caixa dar Ok: a cozinha sabe que o recado foi dado.
        <p
          key={mensagem.id}
          className="-mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground"
        >
          <MessageSquareIcon className="size-3.5 shrink-0" aria-hidden="true" />
          Avisado: {minuscula(TEXTO_DA_MENSAGEM[mensagem.tipo])}
        </p>
      ))}
      {itens.length > 0 && (
        <Itens
          itens={itens}
          bloqueado={ocupado || cancelado}
          cancelado={cancelado}
          aoRiscar={aoRiscar}
        />
      )}
      {outras && !pronto && (
        <p className="-mt-1 text-[13px] text-muted-foreground">Falta: {outras}</p>
      )}
      {pedido.observacao && (
        <p className="rounded-md bg-foreground/[0.05] px-2 py-1.5 text-sm">
          Obs.: {pedido.observacao}
        </p>
      )}

      <footer className="flex flex-col gap-2 border-t border-border/70 pt-3">
        {!pronto && !cancelado && feitos > 0 && (
          <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
            {feitos} de {itens.length}
          </span>
        )}
        {cancelamento ? (
          // Pare o preparo: o pedido foi cancelado. O ciente vale para todas as telas.
          <Button
            type="button"
            size="lg"
            className="h-11 w-full text-[15px]"
            onClick={() => aoCiente(cancelamento)}
          >
            Ciente
          </Button>
        ) : itens.length === 0 ? null : pronto ? (
          <span className="flex items-center gap-2 text-sm font-medium">
            <Traco tom={aguardando ? "preparo" : "pronto"} />
            {aguardando ? `Aguardando ${aguardando}` : DEPOIS_DE_PRONTO[pedido.tipo]}
          </span>
        ) : praca && ticket.status === "em-preparo" ? (
          <Button
            type="button"
            size="lg"
            className="h-11 w-full text-[15px]"
            disabled={ocupado}
            onClick={praca.aoPronto}
          >
            Marcar pronto · {praca.nome}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="h-11 w-full text-[15px]"
            disabled={ocupado}
            onClick={aoAvancar}
          >
            {ticket.status === "recebido" ? "Iniciar preparo" : "Marcar pronto"}
          </Button>
        )}
      </footer>
    </motion.article>
  )
}
