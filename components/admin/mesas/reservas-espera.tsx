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
  porQueNaoSenta,
  reservaAtiva,
  statusDaReserva,
  sugerirMesa,
  sugestoesDaEspera,
} from "@/lib/admin/regras/reservas"
import { FUNCOES_PRO_SALAO } from "@/lib/admin/regras/salao"
import { emReais, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { SeloPro } from "../campos"
import { devolverFocoA } from "./devolver-foco"
import { EntrarNaEspera } from "./entrar-na-espera"
import { FormularioReserva } from "./formulario-reserva"
import { type QuemSenta, Sentar } from "./sentar"

const ROTULO_STATUS: Record<Exclude<Reserva["status"], "marcada">, string> = {
  sentou: "Sentou",
  "nao-compareceu": "Não compareceu",
  cancelada: "Cancelada",
}

/** A janela que abre por um botão e devolve o foco a ele ao fechar. */
type Gatilho = HTMLElement | null

/** A pergunta antes de cancelar: a mesa da reserva fica livre. */
function ConfirmarCancelamento({
  reserva,
  mesas,
  aoMudar,
  focoAoFechar,
}: {
  reserva: Reserva | null
  mesas: Mesa[]
  aoMudar: (aberta: boolean) => void
  focoAoFechar: Gatilho
}) {
  const cancelar = useCancelarReserva()
  const mesa = mesas.find((item) => item.id === reserva?.mesaId)
  return (
    <AlertDialog open={reserva !== null} onOpenChange={aoMudar}>
      <AlertDialogContent onCloseAutoFocus={devolverFocoA(focoAoFechar)}>
        {reserva && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar a reserva de {reserva.nome}?</AlertDialogTitle>
              <AlertDialogDescription>
                {mesa
                  ? `A mesa ${mesa.numero} deixa de estar reservada.`
                  : "Ela fica na lista como cancelada."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  cancelar.mutate(reserva.id, {
                    onSuccess: () => toast.success(`Reserva de ${reserva.nome} cancelada.`),
                    onError: (erro) => toast.error(erro.message),
                  })
                }
              >
                Cancelar reserva
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Uma reserva do dia: hora, nome, pessoas, mesa e, nas marcadas, as ações. */
function LinhaReserva({
  reserva,
  mesas,
  salao,
  agora,
  aoEditar,
  aoCancelar,
  aoSentar,
}: {
  reserva: Reserva
  mesas: Mesa[]
  salao: ConfigSalao
  agora: Date | null
  aoEditar: (gatilho: Gatilho) => void
  aoCancelar: (gatilho: Gatilho) => void
  aoSentar: (gatilho: Gatilho) => void
}) {
  const naoCompareceu = useNaoCompareceu()
  // O ⋯ recebe o foco de volta quando Editar ou a pergunta de Cancelar fecham.
  const [mais, setMais] = useState<HTMLButtonElement | null>(null)
  const status = agora ? statusDaReserva(reserva, agora, salao.reservas) : reserva.status
  const mesa = mesas.find((item) => item.id === reserva.mesaId)
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
            onClick={(evento) => aoSentar(evento.currentTarget)}
          >
            Sentar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                ref={setMais}
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Mais ações da reserva de ${reserva.nome}`}
              >
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => aoEditar(mais)}>
                <PencilIcon />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  naoCompareceu.mutate(reserva.id, {
                    onSuccess: () => toast.success(`${reserva.nome} não compareceu.`),
                    onError: (erro) => toast.error(erro.message),
                  })
                }
              >
                <UserXIcon />
                Não compareceu
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => aoCancelar(mais)}>
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
  aoSentar: (gatilho: Gatilho) => void
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
          {agora && entrada.chamadaEm && <> · chamada há {tempoDesde(entrada.chamadaEm, agora)}</>}
        </span>
        {sugestao && <span className="text-xs">Mesa {sugestao.numero} livre</span>}
      </span>
      <span className="flex flex-wrap items-center gap-1">
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
          onClick={(evento) => aoSentar(evento.currentTarget)}
        >
          Sentar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`${entrada.nome} desistiu`}
          disabled={desistir.isPending}
          onClick={() =>
            desistir.mutate(entrada.id, {
              onSuccess: () => toast.success(`${entrada.nome} saiu da espera.`),
              onError: aoErrar,
            })
          }
        >
          <UserXIcon data-icon="inline-start" />
          Desistiu
        </Button>
      </span>
    </li>
  )
}

const CAIXA = "flex min-w-0 flex-col gap-3 rounded-xl bg-foreground/[0.03] p-4"

// A aba de fora, sobre o fundo da caixa, precisa de mais contraste que o padrão (foreground/60
// não chega a 4,5:1 no claro; o axe do E2E do mapa pegou).
const ABA = "text-foreground/75"

/**
 * Com a função Pro desligada (Q32): o cadeado, o preço e o caminho para ligar. As reservas
 * marcadas antes de desligar continuam segurando a mesa (o servidor não confere o plano): o bloco
 * lista as ativas e deixa cancelar, para nenhuma mesa ficar presa sem caminho na tela.
 */
function ReservasPro({
  mesas,
  salao,
  aoConfigurar,
}: {
  mesas: Mesa[]
  salao: ConfigSalao
  aoConfigurar: () => void
}) {
  const { nome, preco } = FUNCOES_PRO_SALAO.reservas
  const { data: reservas = [] } = useReservas(4_000)
  const agora = useAgora(30_000)
  const [cancelando, setCancelando] = useState<Reserva | null>(null)
  const [gatilho, setGatilho] = useState<Gatilho>(null)
  const ativas = agora
    ? reservas.filter((reserva) => reservaAtiva(reserva, agora, salao.reservas))
    : []
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
      {ativas.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            As reservas marcadas antes de desligar continuam segurando a mesa:
          </p>
          <ul aria-label="Reservas ativas" className="flex flex-col divide-y divide-border/70">
            {ativas.map((reserva) => {
              const mesa = mesas.find((item) => item.id === reserva.mesaId)
              return (
                <li key={reserva.id} className="flex items-center gap-3 py-2">
                  <span className="w-11 shrink-0 text-sm font-semibold tabular-nums">
                    {format(new Date(reserva.inicio), "HH:mm")}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{reserva.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {plural(reserva.pessoas, "pessoa", "pessoas")} ·{" "}
                      {mesa ? `Mesa ${mesa.numero}` : "Sem mesa"}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Cancelar a reserva de ${reserva.nome}`}
                    onClick={(evento) => {
                      setGatilho(evento.currentTarget)
                      setCancelando(reserva)
                    }}
                  >
                    Cancelar
                  </Button>
                </li>
              )
            })}
          </ul>
        </>
      )}
      <ConfirmarCancelamento
        reserva={cancelando}
        mesas={mesas}
        aoMudar={(aberta) => !aberta && setCancelando(null)}
        focoAoFechar={gatilho}
      />
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
  if (!salao.funcoes.reservas) {
    return <ReservasPro mesas={mesas} salao={salao} aoConfigurar={aoConfigurar} />
  }
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
  const [cancelando, setCancelando] = useState<Reserva | null>(null)
  const [sentando, setSentando] = useState<QuemSenta | null>(null)
  // Quem abriu a janela aberta agora: o foco volta para ele quando ela fecha.
  const [gatilho, setGatilho] = useState<Gatilho>(null)
  const abrirCom = (elemento: Gatilho, abrir: () => void) => {
    setGatilho(elemento)
    abrir()
  }
  const marcadas = (reservas ?? []).filter(
    (reserva) => agora && statusDaReserva(reserva, agora, salao.reservas) === "marcada",
  ).length
  const quando = agora ? { agora, config: salao.reservas } : null
  const sugestoes = quando
    ? sugestoesDaEspera(espera ?? [], mesas, reservas ?? [], quando)
    : new Map<string, Mesa>()
  // A mesa da reserva só vem escolhida se ainda recebe; senão, a sugestão (a janela diz o porquê).
  const sentarReserva = (reserva: Reserva) =>
    setSentando({
      tipo: "reserva",
      reserva,
      mesaId:
        reserva.mesaId && !porQueNaoSenta(reserva.mesaId, mesas)
          ? reserva.mesaId
          : quando
            ? sugerirMesa(reserva.pessoas, mesas, reservas ?? [], {
                ...quando,
                ignorar: reserva.id,
              })?.id
            : undefined,
    })
  return (
    <section aria-labelledby="titulo-reservas-espera" className={CAIXA}>
      <h2 id="titulo-reservas-espera" className="text-[15px] font-semibold tracking-[-0.01em]">
        Reservas e espera
      </h2>
      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="w-full">
          <TabsTrigger value="reservas" className={ABA}>
            Reservas <span className="tabular-nums">{marcadas}</span>
          </TabsTrigger>
          <TabsTrigger value="espera" className={ABA}>
            Espera <span className="tabular-nums">{espera?.length ?? 0}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reservas" className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start"
            onClick={(evento) => abrirCom(evento.currentTarget, () => setNova(true))}
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
                  aoEditar={(elemento) => abrirCom(elemento, () => setEditando(reserva))}
                  aoCancelar={(elemento) => abrirCom(elemento, () => setCancelando(reserva))}
                  aoSentar={(elemento) => abrirCom(elemento, () => sentarReserva(reserva))}
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
            onClick={(evento) => abrirCom(evento.currentTarget, () => setEntrando(true))}
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
                    aoSentar={(elemento) =>
                      abrirCom(elemento, () =>
                        setSentando({ tipo: "espera", entrada, mesaId: sugestao?.id }),
                      )
                    }
                  />
                )
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
      <FormularioReserva aberto={nova} aoMudar={setNova} focoAoFechar={gatilho} />
      <FormularioReserva
        key={editando?.id}
        reserva={editando ?? undefined}
        aberto={editando !== null}
        aoMudar={(aberto) => !aberto && setEditando(null)}
        focoAoFechar={gatilho}
      />
      <ConfirmarCancelamento
        reserva={cancelando}
        mesas={mesas}
        aoMudar={(aberta) => !aberta && setCancelando(null)}
        focoAoFechar={gatilho}
      />
      <EntrarNaEspera aberto={entrando} aoMudar={setEntrando} focoAoFechar={gatilho} />
      <Sentar
        quem={sentando}
        aoMudar={(aberto) => !aberto && setSentando(null)}
        focoAoFechar={gatilho}
      />
    </section>
  )
}
