"use client"

import NumberFlow from "@number-flow/react"
import {
  ArrowRightLeftIcon,
  CombineIcon,
  ConciergeBellIcon,
  EllipsisIcon,
  LockIcon,
  LockOpenIcon,
  PencilIcon,
  ReceiptTextIcon,
  SplitIcon,
  SprayCanIcon,
  Trash2Icon,
} from "lucide-react"
import { Fragment, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useDesbloquearMesa,
  useMarcarLimpa,
  useMarcarServido,
  useSepararMesas,
} from "@/lib/admin/dados/consultas-mesas"
import type { Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { useGarcom } from "@/lib/admin/garcom"
import { tempoDesde } from "@/lib/admin/regras/alertas-mesa"
import type { MesaNaGrade } from "@/lib/admin/regras/filtro-mesas"
import { autorDaAcao } from "@/lib/admin/regras/historico"
import { type EstadoMesa, nomePadraoDaMesa } from "@/lib/admin/regras/mesas"
import { emReais, formatoMoeda, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { ALVO_DE_TOQUE } from "../entrega/linha-animada"
import { Traco } from "../traco"
import { useAvisoComDesfazer } from "./aviso-desfazer"
import { ConfirmarExclusaoMesa } from "./excluir-mesa"
import { JuntarMesas } from "./juntar-mesas"
import { TransferirMesa } from "./transferir-mesa"

const nomePadrao = (mesa: Mesa) => mesa.nome === nomePadraoDaMesa(mesa.numero)

/** A linha de baixo da mesa sem comanda: o motivo do bloqueio, a limpeza ou os lugares. */
function resumoSemComanda(mesa: Mesa, estado: EstadoMesa, agora: Date | null) {
  if (estado === "bloqueada") return mesa.bloqueio?.motivo || "Sem motivo"
  if (estado === "limpeza" && mesa.limpezaDesde) {
    return agora ? `Limpeza há ${tempoDesde(mesa.limpezaDesde, agora)}` : "Limpeza"
  }
  return plural(mesa.lugares, "lugar", "lugares")
}

type AcaoMesa =
  | "abrir"
  | "servido"
  | "limpa"
  | "desbloquear"
  | "transferir"
  | "juntar"
  | "separar"
  | "editar"
  | "bloquear"
  | "excluir"

/**
 * O que o menu ⋯ oferece em cada estado (decisões de detalhe da Fase 2; a Fase 5 põe as
 * movimentações). "Separar" só aparece na mesa aberta que tem mesas juntadas.
 */
const ACOES: Record<EstadoMesa, AcaoMesa[]> = {
  livre: ["abrir", "editar", "bloquear", "excluir"],
  reservada: ["abrir", "editar", "bloquear", "excluir"],
  limpeza: ["limpa", "editar", "bloquear", "excluir"],
  ocupada: ["abrir", "transferir", "juntar", "separar", "editar"],
  "na-cozinha": ["abrir", "transferir", "juntar", "separar", "editar"],
  servir: ["servido", "abrir", "transferir", "juntar", "separar", "editar"],
  "conta-pedida": ["abrir", "transferir", "juntar", "separar", "editar"],
  bloqueada: ["desbloquear", "editar", "excluir"],
  // Abre a comanda da principal; separar solta todas as mesas da comanda.
  juntada: ["abrir", "separar"],
}

type Acoes = {
  aoAbrir: () => void
  /** Recebem o botão ⋯, para onde o foco volta quando a janela fecha. */
  aoEditar: (gatilho: HTMLElement | null) => void
  aoBloquear: (gatilho: HTMLElement | null) => void
}

function MenuMesa({
  mesa,
  comanda,
  estado,
  aoAbrir,
  aoEditar,
  aoBloquear,
}: Acoes & { mesa: Mesa; comanda: Pedido | undefined; estado: EstadoMesa }) {
  const marcarLimpa = useMarcarLimpa()
  const servir = useMarcarServido()
  const separar = useSepararMesas()
  const avisar = useAvisoComDesfazer()
  const por = useGarcom((atual) => atual.nome)
  const desbloquear = useDesbloquearMesa()
  const [excluindo, setExcluindo] = useState(false)
  const [movendo, setMovendo] = useState<"transferir" | "juntar" | null>(null)
  // Em estado, não em ref: a pergunta de excluir lê o botão ao renderizar.
  const [gatilho, setGatilho] = useState<HTMLButtonElement | null>(null)
  const aoErrar = (erro: Error) => toast.error(erro.message)
  const temJuntadas = Boolean(comanda?.mesa?.juntadas?.length)
  const acoes = ACOES[estado].filter((acao) => acao !== "separar" || temJuntadas)
  const itens: Record<AcaoMesa, React.ReactNode> = {
    abrir: (
      <DropdownMenuItem key="abrir" onSelect={aoAbrir}>
        <ReceiptTextIcon />
        Abrir comanda
      </DropdownMenuItem>
    ),
    servido: (
      <DropdownMenuItem
        key="servido"
        onSelect={() =>
          comanda &&
          servir.mutate(
            { pedidoId: comanda.id, ...(por.trim() ? { por } : {}) },
            {
              onSuccess: () => toast.success(`Mesa ${mesa.numero} servida.`),
              onError: aoErrar,
            },
          )
        }
      >
        <ConciergeBellIcon />
        Marcar servido
      </DropdownMenuItem>
    ),
    limpa: (
      <DropdownMenuItem
        key="limpa"
        onSelect={() =>
          marcarLimpa.mutate(mesa.id, {
            onSuccess: ({ desfazer }) => avisar(`Mesa ${mesa.numero} limpa.`, desfazer),
            onError: aoErrar,
          })
        }
      >
        <SprayCanIcon />
        Marcar limpa
      </DropdownMenuItem>
    ),
    transferir: (
      <DropdownMenuItem key="transferir" onSelect={() => setMovendo("transferir")}>
        <ArrowRightLeftIcon />
        Transferir
      </DropdownMenuItem>
    ),
    juntar: (
      <DropdownMenuItem key="juntar" onSelect={() => setMovendo("juntar")}>
        <CombineIcon />
        Juntar mesas
      </DropdownMenuItem>
    ),
    separar: (
      <DropdownMenuItem
        key="separar"
        onSelect={() =>
          comanda &&
          separar.mutate(
            { pedidoId: comanda.id, ...autorDaAcao(por, comanda.mesa?.garcom) },
            { onSuccess: ({ desfazer }) => avisar("Mesas separadas.", desfazer), onError: aoErrar },
          )
        }
      >
        <SplitIcon />
        Separar
      </DropdownMenuItem>
    ),
    desbloquear: (
      <DropdownMenuItem
        key="desbloquear"
        onSelect={() =>
          desbloquear.mutate(mesa.id, {
            onSuccess: () => toast.success(`Mesa ${mesa.numero} desbloqueada.`),
            onError: aoErrar,
          })
        }
      >
        <LockOpenIcon />
        Desbloquear
      </DropdownMenuItem>
    ),
    editar: (
      <DropdownMenuItem key="editar" onSelect={() => aoEditar(gatilho)}>
        <PencilIcon />
        Editar
      </DropdownMenuItem>
    ),
    bloquear: (
      <DropdownMenuItem key="bloquear" onSelect={() => aoBloquear(gatilho)}>
        <LockIcon />
        Bloquear
      </DropdownMenuItem>
    ),
    excluir: (
      <DropdownMenuItem key="excluir" variant="destructive" onSelect={() => setExcluindo(true)}>
        <Trash2Icon />
        Excluir
      </DropdownMenuItem>
    ),
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={setGatilho}
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(ALVO_DE_TOQUE, "absolute top-2 right-2")}
            aria-label={`Ações da mesa ${mesa.numero}`}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{acoes.map((acao) => itens[acao])}</DropdownMenuContent>
      </DropdownMenu>
      <ConfirmarExclusaoMesa
        mesa={mesa}
        aberta={excluindo}
        aoMudar={setExcluindo}
        focoAoFechar={gatilho}
      />
      {comanda && (
        <TransferirMesa
          mesa={mesa}
          comanda={comanda}
          aberta={movendo === "transferir"}
          aoMudar={(aberta) => !aberta && setMovendo(null)}
          focoAoFechar={gatilho}
        />
      )}
      {comanda && (
        <JuntarMesas
          mesa={mesa}
          comanda={comanda}
          aberta={movendo === "juntar"}
          aoMudar={(aberta) => !aberta && setMovendo(null)}
          focoAoFechar={gatilho}
        />
      )}
    </>
  )
}

/** Uma mesa na grade do salão: o estado de relance e, aberta, o que a mesa está consumindo. */
export function CartaoMesa({
  mesa,
  comanda,
  estado,
  alertas,
  agora,
  aoAbrir,
  aoEditar,
  aoBloquear,
}: MesaNaGrade &
  Acoes & {
    agora: Date | null
  }) {
  const ocupada = mesa.status === "ocupada"
  const itens = comanda?.itens.reduce((soma, item) => soma + item.quantidade, 0) ?? 0
  const alerta = alertas[0]
  const resumo = ocupada ? null : resumoSemComanda(mesa, estado.estado, agora)
  const garcom = comanda?.mesa?.garcom ? `Garçom ${comanda.mesa.garcom}` : null
  const pessoas = comanda?.mesa?.pessoas ? plural(comanda.mesa.pessoas, "pessoa", "pessoas") : null
  return (
    // O ⋯ fica ao lado do botão do cartão, não dentro: botão dentro de botão não vale.
    <div className="relative h-full">
      <button
        type="button"
        onClick={aoAbrir}
        aria-labelledby={`mesa-${mesa.id}`}
        aria-describedby={`mesa-${mesa.id}-detalhes`}
        data-alerta={alerta?.tipo}
        className={cn(
          "flex h-full min-h-32 w-full cursor-pointer flex-col gap-1.5 rounded-xl p-3 text-left outline-none",
          "transition-[transform,box-shadow,background-color] duration-150 ease-saida active:scale-[0.98] motion-reduce:transition-none",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          ocupada
            ? "bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1"
            : "bg-foreground/[0.03] hover:bg-foreground/[0.06]",
          // O alerta pede o olho com a cor da ação (tom novo), nunca com o vermelho de erro.
          ocupada && (alerta ? "ring-(--tom-novo)" : "ring-border/80 hover:ring-foreground/25"),
        )}
      >
        {/* À direita do título fica o ⋯, que é irmão do botão e se sobrepõe a ele. */}
        <span id={`mesa-${mesa.id}`} className="pr-8 text-[15px] font-semibold">
          Mesa {mesa.numero}
        </span>
        <span
          className={cn(
            // "Pediu a conta" numa linha só, mesmo no cartão estreito do celular.
            "flex items-center gap-2 text-[13px] font-medium whitespace-nowrap",
            !ocupada && "text-muted-foreground",
          )}
        >
          <Traco tom={estado.tom} className="h-3" />
          {estado.rotulo}
        </span>
        <span id={`mesa-${mesa.id}-detalhes`} className="sr-only">
          {[
            // Na limpeza o resumo já começa pelo estado: "Limpeza há 5 min".
            estado.estado === "limpeza" ? resumo : estado.rotulo,
            nomePadrao(mesa) ? null : mesa.nome,
            estado.estado === "limpeza" ? null : resumo,
            mesa.clienteNome,
            ocupada ? garcom : null,
            ocupada ? pessoas : null,
            // A secundária mostra a comanda da principal: o total é lido lá, não aqui.
            comanda && ocupada ? emReais(comanda.total) : null,
            ...alertas.map((item) => item.texto),
          ]
            .filter(Boolean)
            .join(", ")}
        </span>
        {!nomePadrao(mesa) && (
          <span className="truncate text-xs text-muted-foreground">{mesa.nome}</span>
        )}
        {ocupada ? (
          <>
            <span className="truncate text-sm font-medium">{mesa.clienteNome}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground tabular-nums">
              {[mesa.ocupadaEm && agora ? tempoDesde(mesa.ocupadaEm, agora) : null, garcom, pessoas]
                .filter((parte) => parte !== null)
                .map((parte, indice) => (
                  <Fragment key={parte}>
                    {indice > 0 && <span aria-hidden="true">·</span>}
                    <span>{parte}</span>
                  </Fragment>
                ))}
            </span>
            {alerta && (
              <span className="w-fit rounded-md bg-(--tom-novo)/7 px-1.5 py-0.5 text-xs font-medium tabular-nums">
                {alerta.texto}
              </span>
            )}
            {comanda && (
              <span className="mt-auto flex items-baseline justify-between gap-2 border-t border-border/70 pt-2">
                <span className="text-xs whitespace-nowrap text-muted-foreground">
                  {plural(itens, "item", "itens")}
                </span>
                <NumberFlow
                  value={comanda.total}
                  locales="pt-BR"
                  format={formatoMoeda}
                  className="text-[15px] font-semibold tabular-nums"
                />
              </span>
            )}
          </>
        ) : (
          <span className="mt-auto truncate text-xs text-muted-foreground tabular-nums">
            {resumo}
          </span>
        )}
      </button>
      <MenuMesa
        mesa={mesa}
        comanda={comanda}
        estado={estado.estado}
        aoAbrir={aoAbrir}
        aoEditar={aoEditar}
        aoBloquear={aoBloquear}
      />
    </div>
  )
}
