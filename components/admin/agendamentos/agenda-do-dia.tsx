"use client"

import { addDays, differenceInMinutes, format, isSameDay, startOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, MoonIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useState } from "react"
// O locale do calendário traz também os rótulos de navegação em português.
import { ptBR as calendarioPtBR } from "react-day-picker/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { HorarioFuncionamento, Pedido } from "@/lib/admin/dados/tipos"
import {
  CURVA_SAIDA,
  DURACAO,
  estiloDeEntrada,
  semRelogioDoNavegador,
  variantesDoItem,
} from "@/lib/admin/movimento"
import { expediente, faixasDoDia } from "@/lib/admin/regras/agenda"
import { rotuloStatus, tomDoStatus } from "@/lib/admin/regras/status"
import { plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { Traco } from "../traco"

/** Altura de uma hora na linha do tempo. */
const PX_POR_HORA = 64
const px = (minutos: number) => `${Math.round((minutos * PX_POR_HORA) / 60)}px`

export const tituloDoDia = (dia: Date) => format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })

/** Os tons que aparecem na agenda, para ler os traços de relance. */
const LEGENDA = [
  { status: "recebido", rotulo: "Agendado" },
  { status: "em-preparo", rotulo: "Em atendimento" },
  { status: "concluido", rotulo: "Concluído" },
] as const

function Bloco({
  pedido,
  abre,
  posicao,
  indice,
  aoAbrir,
}: {
  pedido: Pedido
  abre: Date
  posicao: { faixa: number; faixas: number }
  indice: number
  aoAbrir: () => void
}) {
  const reduzido = useReducedMotion() ?? false
  const inicio = new Date(pedido.agendamento?.inicio ?? pedido.criadoEm)
  const duracao = pedido.agendamento?.duracaoMin ?? 60
  const servicos = pedido.itens.map((item) => item.nome).join(", ")
  const encerrado = pedido.status === "concluido"
  return (
    <motion.button
      type="button"
      onClick={aoAbrir}
      // Entra em sequência na primeira vez; atendimento cancelado ou remarcado sai com o fade.
      variants={variantesDoItem(reduzido)}
      custom={indice}
      initial="entrar"
      animate="parado"
      onUpdate={semRelogioDoNavegador}
      exit="sair"
      style={{
        ...estiloDeEntrada(indice),
        top: px(differenceInMinutes(inicio, abre)),
        height: px(duracao),
        left: `${(posicao.faixa / posicao.faixas) * 100}%`,
        width: `${100 / posicao.faixas}%`,
      }}
      // A folga de 2 px em volta separa blocos vizinhos sem desenhar borda.
      className="alvo-toque entra-item group absolute p-px pr-0.5 pb-0.5 text-left outline-none focus-visible:z-10"
    >
      <span
        className={cn(
          "relative flex h-full flex-col justify-start overflow-hidden rounded-md bg-card px-2 text-xs shadow-[0_1px_2px_rgb(0_0_0/0.05)] ring-1 ring-border/80 transition-[box-shadow,background-color] duration-150",
          "group-hover:ring-foreground/25 group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
          // Serviço curto (20 ou 30 min): uma linha só, sem folga em cima e embaixo.
          duracao < 45 ? "justify-center py-0 leading-none" : "py-1.5",
          encerrado && "bg-card/60 text-muted-foreground shadow-none",
        )}
      >
        {/* O traço é a haste curta da Etiqueta ao lado do horário, não uma faixa na altura do bloco. */}
        <span className="flex min-w-0 items-center gap-1.5 font-medium tabular-nums">
          <Traco tom={tomDoStatus(pedido.status)} className="h-3" />
          <span className="truncate">
            {format(inicio, "HH:mm")} · {pedido.cliente.nome}
          </span>
        </span>
        {duracao > 30 && (
          <span className="block truncate pl-[9px] text-muted-foreground">{servicos}</span>
        )}
        <span className="sr-only">, {rotuloStatus(pedido.tipo, pedido.status).toLowerCase()}</span>
      </span>
    </motion.button>
  )
}

/** Linha do tempo do dia: blocos do tamanho da duração, lado a lado quando se cruzam. */
export function AgendaDoDia({
  dia,
  agora,
  pedidos,
  horarios,
  mudarDia,
  aoAbrir,
}: {
  dia: Date
  agora: Date
  pedidos: Pedido[]
  horarios: HorarioFuncionamento[]
  mudarDia: (dia: Date) => void
  aoAbrir: (pedido: Pedido) => void
}) {
  const semMovimento = useReducedMotion() ?? false
  const [calendarioAberto, setCalendarioAberto] = useState(false)
  // Para onde o dia andou: a grade entra do lado certo. Na primeira vez, não anima.
  const [diaAnterior, setDiaAnterior] = useState(dia.getTime())
  const [direcao, setDirecao] = useState(0)
  if (diaAnterior !== dia.getTime()) {
    setDirecao(dia.getTime() > diaAnterior ? 1 : -1)
    setDiaAnterior(dia.getTime())
  }

  const dele = expediente(dia, horarios)
  const doDia = pedidos.filter(
    (pedido) =>
      pedido.agendamento &&
      pedido.status !== "cancelado" &&
      isSameDay(new Date(pedido.agendamento.inicio), dia),
  )
  const faixas = faixasDoDia(doDia)
  const horas = dele ? Math.ceil(differenceInMinutes(dele.fecha, dele.abre) / 60) : 0
  const rotulosDasHoras = dele
    ? Array.from({ length: horas }, (_, hora) =>
        format(new Date(dele.abre.getTime() + hora * 3_600_000), "HH:mm"),
      )
    : []
  const ehHoje = isSameDay(agora, dia)
  const minutoAgora = dele && ehHoje ? differenceInMinutes(agora, dele.abre) : -1
  const fechado = (data: Date) => expediente(data, horarios) === null

  return (
    <section aria-label="Agenda do dia" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
        <div className="flex w-full min-w-0 flex-col gap-0.5 sm:mr-auto sm:w-auto">
          <h2 className="text-lg leading-tight font-semibold tracking-[-0.01em] first-letter:uppercase">
            {tituloDoDia(dia)}
          </h2>
          <p className="text-[13px] text-muted-foreground tabular-nums">
            {dele
              ? `${plural(doDia.length, "atendimento", "atendimentos")} · das ${format(dele.abre, "HH:mm")} às ${format(dele.fecha, "HH:mm")}`
              : "Salão fechado"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-foreground/[0.05] p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Dia anterior"
              className="max-sm:size-11"
              onClick={() => mudarDia(addDays(dia, -1))}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("max-sm:h-11", ehHoje && "bg-background shadow-sm")}
              onClick={() => mudarDia(startOfDay(agora))}
            >
              Hoje
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Próximo dia"
              className="max-sm:size-11"
              onClick={() => mudarDia(addDays(dia, 1))}
            >
              <ChevronRightIcon />
            </Button>
          </div>
          <Popover open={calendarioAberto} onOpenChange={setCalendarioAberto}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="max-sm:h-11">
                <CalendarIcon data-icon="inline-start" />
                Escolher dia
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="single"
                locale={calendarioPtBR}
                selected={dia}
                defaultMonth={dia}
                modifiers={{ fechado }}
                modifiersClassNames={{ fechado: "opacity-40" }}
                onSelect={(escolhido) => {
                  if (!escolhido) return
                  mudarDia(escolhido)
                  setCalendarioAberto(false)
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <motion.div
        key={dia.getTime()}
        initial={direcao === 0 ? false : { opacity: 0, x: semMovimento ? 0 : direcao * 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: DURACAO.entrada, ease: CURVA_SAIDA }}
        className="flex flex-col gap-2"
      >
        {!dele ? (
          <Empty className="rounded-2xl bg-foreground/[0.03] py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MoonIcon />
              </EmptyMedia>
              <EmptyTitle>O salão não abre neste dia.</EmptyTitle>
              <EmptyDescription>
                Escolha outro dia para ver ou marcar atendimentos. O horário de cada dia fica nas
                configurações da loja.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              {LEGENDA.map(({ status, rotulo }) => (
                <li key={status} className="inline-flex items-center gap-1.5">
                  <Traco tom={tomDoStatus(status)} className="h-3" />
                  {rotulo}
                </li>
              ))}
            </ul>
            <div className="flex rounded-2xl bg-foreground/[0.03] p-2 pt-3">
              <ol
                aria-hidden="true"
                className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums"
              >
                {rotulosDasHoras.map((rotulo) => (
                  <li key={rotulo} style={{ height: px(60) }} className="-translate-y-2 pl-1">
                    {rotulo}
                  </li>
                ))}
              </ol>
              <div className="relative flex-1" style={{ height: px(horas * 60) }}>
                {rotulosDasHoras.map((rotulo, hora) => (
                  <div key={rotulo} aria-hidden="true">
                    <div
                      className="absolute inset-x-0 border-t border-border/80"
                      style={{ top: px(hora * 60) }}
                    />
                    <div
                      className="absolute inset-x-0 border-t border-dashed border-border/50"
                      style={{ top: px(hora * 60 + 30) }}
                    />
                  </div>
                ))}
                {/* Ao trocar de dia, a grade inteira já desliza: os blocos só animam na primeira vez. */}
                <AnimatePresence initial={direcao === 0}>
                  {doDia.map((pedido, indice) => (
                    <Bloco
                      key={pedido.id}
                      pedido={pedido}
                      abre={dele.abre}
                      posicao={faixas.get(pedido.id) ?? { faixa: 0, faixas: 1 }}
                      indice={indice}
                      aoAbrir={() => aoAbrir(pedido)}
                    />
                  ))}
                </AnimatePresence>
                {minutoAgora >= 0 && minutoAgora <= horas * 60 && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 z-10 border-t border-(--tom-novo)"
                    style={{ top: px(minutoAgora) }}
                  >
                    <span className="absolute -top-[4.5px] -left-1 size-2 rounded-full bg-(--tom-novo)" />
                  </div>
                )}
                {doDia.length === 0 && (
                  <div className="absolute inset-x-0 top-6 flex flex-col items-center gap-1 text-center">
                    <p className="text-sm font-medium">Nenhum atendimento marcado.</p>
                    <p className="text-[13px] text-muted-foreground">
                      Os horários ficam livres para marcar em Novo agendamento.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </motion.div>
    </section>
  )
}
