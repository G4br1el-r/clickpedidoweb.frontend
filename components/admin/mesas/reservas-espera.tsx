"use client"

import { format } from "date-fns"
import {
  CalendarPlusIcon,
  EllipsisIcon,
  MessageCircleIcon,
  PencilIcon,
  UserPlusIcon,
  UserXIcon,
  XIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAgora } from "@/hooks/use-agora"
import { useLoja } from "@/lib/admin/dados/consultas"
import {
  useCancelarReserva,
  useChamarDaEspera,
  useDesistirDaEspera,
  useEspera,
  useNaoCompareceu,
  useReservas,
} from "@/lib/admin/dados/consultas-mesas"
import type { ConfigSalao, EntradaEspera, Mesa, Reserva } from "@/lib/admin/dados/tipos"
import { tempoDesde } from "@/lib/admin/regras/alertas-mesa"
import {
  chamadaPeloWhatsApp,
  statusDaReserva,
  sugerirMesa,
  sugestoesDaEspera,
} from "@/lib/admin/regras/reservas"
import { FUNCOES_PRO_SALAO } from "@/lib/admin/regras/salao"
import { emReais, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { SeloPro } from "../campos"
import { EntrarNaEspera } from "./entrar-na-espera"
import { FormularioReserva } from "./formulario-reserva"
import { type QuemSenta, Sentar } from "./sentar"

const ROTULO_STATUS: Record<Exclude<Reserva["status"], "marcada">, string> = {
  sentou: "Sentou",
  "nao-compareceu": "Não compareceu",
  cancelada: "Cancelada",
}

/** Uma reserva do dia: hora, nome, pessoas, mesa e, nas marcadas, as ações. */
function LinhaReserva({
  reserva,
  mesas,
  salao,
  agora,
  aoEditar,
  aoSentar,
}: {
  reserva: Reserva
  mesas: Mesa[]
  salao: ConfigSalao
  agora: Date | null
  aoEditar: () => void
  aoSentar: () => void
}) {
  const naoCompareceu = useNaoCompareceu()
  const cancelar = useCancelarReserva()
  const status = agora ? statusDaReserva(reserva, agora, salao.reservas) : reserva.status
  const mesa = mesas.find((item) => item.id === reserva.mesaId)
  const aoErrar = (erro: Error) => toast.error(erro.message)
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="w-11 shrink-0 pt-px text-sm font-semibold tabular-nums">
        {format(new Date(reserva.inicio), "HH:mm")}
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          status !== "marcada" && "text-muted-foreground",
        )}
      >
        <span className="truncate text-sm font-medium">{reserva.nome}</span>
        <span className="text-xs text-muted-foreground">
          {plural(reserva.pessoas, "pessoa", "pessoas")} ·{" "}
          {mesa ? `Mesa ${mesa.numero}` : "Sem mesa"}
          {status !== "marcada" && <> · {ROTULO_STATUS[status]}</>}
        </span>
      </span>
      {/* A atrasada (não compareceu pela hora) ainda senta: a pessoa pode chegar tarde. */}
      {reserva.status === "marcada" && (
        <span className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Sentar ${reserva.nome}`}
            onClick={aoSentar}
          >
            Sentar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Mais ações da reserva de ${reserva.nome}`}
              >
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={aoEditar}>
                <PencilIcon />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  naoCompareceu.mutate(reserva.id, {
                    onSuccess: () => toast.success(`${reserva.nome} não compareceu.`),
                    onError: aoErrar,
                  })
                }
              >
                <UserXIcon />
                Não compareceu
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  cancelar.mutate(reserva.id, {
                    onSuccess: () => toast.success(`Reserva de ${reserva.nome} cancelada.`),
                    onError: aoErrar,
                  })
                }
              >
                <XIcon />
                Cancelar reserva
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      )}
    </li>
  )
}

/** Alguém da espera: pessoas, o tempo correndo, a chamada, a mesa sugerida e as ações. */
function LinhaEspera({
  entrada,
  sugestao,
  agora,
  loja,
  aoSentar,
}: {
  entrada: EntradaEspera
  sugestao: Mesa | undefined
  agora: Date | null
  loja: string
  aoSentar: () => void
}) {
  const chamar = useChamarDaEspera()
  const desistir = useDesistirDaEspera()
  const aoErrar = (erro: Error) => toast.error(erro.message)
  const marcarChamada = () => chamar.mutate(entrada.id, { onError: aoErrar })
  return (
    <li className="flex flex-col gap-2 py-2.5">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{entrada.nome}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {plural(entrada.pessoas, "pessoa", "pessoas")}
          {agora && <> · há {tempoDesde(entrada.chegouEm, agora)}</>}
          {agora && entrada.chamadaEm && <> · chamado há {tempoDesde(entrada.chamadaEm, agora)}</>}
        </span>
        {sugestao && <span className="text-xs">Mesa {sugestao.numero} livre</span>}
      </span>
      <span className="flex items-center gap-1">
        {entrada.telefone ? (
          // Abre a conversa com a mensagem pronta: quem envia é a pessoa, no WhatsApp.
          <Button asChild size="sm" variant="outline">
            <a
              href={chamadaPeloWhatsApp(entrada.telefone, loja)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Chamar ${entrada.nome}`}
              onClick={marcarChamada}
            >
              <MessageCircleIcon data-icon="inline-start" />
              Chamar
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Chamar ${entrada.nome}`}
            onClick={marcarChamada}
          >
            Chamar
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`Sentar ${entrada.nome}`}
          onClick={aoSentar}
        >
          Sentar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Mais ações de ${entrada.nome}`}
            >
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                desistir.mutate(entrada.id, {
                  onSuccess: () => toast.success(`${entrada.nome} saiu da espera.`),
                  onError: aoErrar,
                })
              }
            >
              <UserXIcon />
              Desistiu
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </li>
  )
}

const CAIXA = "flex min-w-0 flex-col gap-3 rounded-xl bg-foreground/[0.03] p-4"

/** Com a função Pro desligada (Q32): o cadeado, o preço e o caminho para ligar. */
function ReservasPro({ aoConfigurar }: { aoConfigurar: () => void }) {
  const { nome, preco } = FUNCOES_PRO_SALAO.reservas
  return (
    <section aria-labelledby="titulo-reservas-espera" className={CAIXA}>
      <div className="flex items-center gap-2">
        <h2 id="titulo-reservas-espera" className="text-[15px] font-semibold tracking-[-0.01em]">
          Reservas e espera
        </h2>
        <SeloPro liberada={false} />
      </div>
      <p className="text-sm text-muted-foreground">
        {nome}: reservas do dia, fila com a mesa sugerida e o chamado pelo WhatsApp.{" "}
        {emReais(preco)} por mês no plano Pro. Ligue em Configurar salão, em Funções Pro.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={aoConfigurar}
      >
        Abrir Configurar salão
      </Button>
    </section>
  )
}

/** Reservas do dia e lista de espera (Q11, Q24, Q25), ao lado da grade. */
export function PainelReservas({
  mesas,
  salao,
  aoConfigurar,
}: {
  mesas: Mesa[]
  salao: ConfigSalao
  aoConfigurar: () => void
}) {
  if (!salao.funcoes.reservas) return <ReservasPro aoConfigurar={aoConfigurar} />
  return <Painel mesas={mesas} salao={salao} />
}

function Painel({ mesas, salao }: { mesas: Mesa[]; salao: ConfigSalao }) {
  const { data: reservas } = useReservas(4_000)
  const { data: espera } = useEspera(4_000)
  const { data: loja } = useLoja()
  const agora = useAgora(30_000)
  const [aba, setAba] = useState("reservas")
  const [nova, setNova] = useState(false)
  const [entrando, setEntrando] = useState(false)
  const [editando, setEditando] = useState<Reserva | null>(null)
  const [sentando, setSentando] = useState<QuemSenta | null>(null)
  const marcadas = (reservas ?? []).filter(
    (reserva) => agora && statusDaReserva(reserva, agora, salao.reservas) === "marcada",
  ).length
  const quando = agora ? { agora, config: salao.reservas } : null
  const sugestoes = quando
    ? sugestoesDaEspera(espera ?? [], mesas, reservas ?? [], quando)
    : new Map<string, Mesa>()
  const sentarReserva = (reserva: Reserva) =>
    setSentando({
      tipo: "reserva",
      reserva,
      mesaId:
        reserva.mesaId ??
        (quando
          ? sugerirMesa(reserva.pessoas, mesas, reservas ?? [], { ...quando, ignorar: reserva.id })
              ?.id
          : undefined),
    })
  return (
    <section aria-labelledby="titulo-reservas-espera" className={CAIXA}>
      <h2 id="titulo-reservas-espera" className="text-[15px] font-semibold tracking-[-0.01em]">
        Reservas e espera
      </h2>
      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="w-full">
          <TabsTrigger value="reservas">
            Reservas <span className="tabular-nums">{marcadas}</span>
          </TabsTrigger>
          <TabsTrigger value="espera">
            Espera <span className="tabular-nums">{espera?.length ?? 0}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reservas" className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => setNova(true)}
          >
            <CalendarPlusIcon data-icon="inline-start" />
            Nova reserva
          </Button>
          {reservas && reservas.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Nenhuma reserva para hoje.</p>
          ) : (
            <ul aria-label="Reservas de hoje" className="flex flex-col divide-y divide-border/70">
              {(reservas ?? []).map((reserva) => (
                <LinhaReserva
                  key={reserva.id}
                  reserva={reserva}
                  mesas={mesas}
                  salao={salao}
                  agora={agora}
                  aoEditar={() => setEditando(reserva)}
                  aoSentar={() => sentarReserva(reserva)}
                />
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="espera" className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => setEntrando(true)}
          >
            <UserPlusIcon data-icon="inline-start" />
            Entrar na espera
          </Button>
          {espera && espera.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Ninguém esperando.</p>
          ) : (
            <ul aria-label="Lista de espera" className="flex flex-col divide-y divide-border/70">
              {(espera ?? []).map((entrada) => {
                const sugestao = sugestoes.get(entrada.id)
                return (
                  <LinhaEspera
                    key={entrada.id}
                    entrada={entrada}
                    sugestao={sugestao}
                    agora={agora}
                    loja={loja?.nome ?? ""}
                    aoSentar={() => setSentando({ tipo: "espera", entrada, mesaId: sugestao?.id })}
                  />
                )
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
      <FormularioReserva aberto={nova} aoMudar={setNova} />
      <FormularioReserva
        key={editando?.id}
        reserva={editando ?? undefined}
        aberto={editando !== null}
        aoMudar={(aberto) => !aberto && setEditando(null)}
      />
      <EntrarNaEspera aberto={entrando} aoMudar={setEntrando} />
      <Sentar quem={sentando} aoMudar={(aberto) => !aberto && setSentando(null)} />
    </section>
  )
}
