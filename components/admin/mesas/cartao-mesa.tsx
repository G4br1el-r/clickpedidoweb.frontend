"use client"

import NumberFlow from "@number-flow/react"
import {
  EllipsisIcon,
  LockIcon,
  LockOpenIcon,
  PencilIcon,
  ReceiptTextIcon,
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
import { useDesbloquearMesa, useMarcarLimpa } from "@/lib/admin/dados/consultas-mesas"
import type { Mesa } from "@/lib/admin/dados/tipos"
import { tempoDesde } from "@/lib/admin/regras/alertas-mesa"
import type { MesaNaGrade } from "@/lib/admin/regras/filtro-mesas"
import type { EstadoMesa } from "@/lib/admin/regras/mesas"
import { emReais, formatoMoeda, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { ALVO_DE_TOQUE } from "../entrega/linha-animada"
import { Traco } from "../traco"
import { ConfirmarExclusaoMesa } from "./excluir-mesa"

const nomePadrao = (mesa: Mesa) => mesa.nome === `Mesa ${String(mesa.numero).padStart(2, "0")}`

/** A linha de baixo da mesa sem comanda: o motivo do bloqueio, a limpeza ou os lugares. */
function resumoSemComanda(mesa: Mesa, estado: EstadoMesa, agora: Date | null) {
  if (estado === "bloqueada") return mesa.bloqueio?.motivo || "Sem motivo"
  if (estado === "limpeza" && mesa.limpezaDesde) {
    return agora ? `Limpeza há ${tempoDesde(mesa.limpezaDesde, agora)}` : "Limpeza"
  }
  return plural(mesa.lugares, "lugar", "lugares")
}

type AcaoMesa = "abrir" | "limpa" | "desbloquear" | "editar" | "bloquear" | "excluir"

/** O que o menu ⋯ oferece em cada estado (decisões de detalhe da Fase 2). */
const ACOES: Record<EstadoMesa, AcaoMesa[]> = {
  livre: ["abrir", "editar", "bloquear", "excluir"],
  reservada: ["abrir", "editar", "bloquear", "excluir"],
  limpeza: ["limpa", "editar", "bloquear", "excluir"],
  ocupada: ["abrir", "editar"],
  "na-cozinha": ["abrir", "editar"],
  servir: ["abrir", "editar"],
  "conta-pedida": ["abrir", "editar"],
  bloqueada: ["desbloquear", "editar", "excluir"],
  // Na Fase 5, abre a comanda da principal.
  juntada: ["abrir"],
}

type Acoes = {
  aoAbrir: () => void
  /** Sem a função, o item aparece desligado. */
  aoEditar?: () => void
  aoBloquear?: () => void
}

function MenuMesa({
  mesa,
  estado,
  aoAbrir,
  aoEditar,
  aoBloquear,
}: Acoes & { mesa: Mesa; estado: EstadoMesa }) {
  const marcarLimpa = useMarcarLimpa()
  const desbloquear = useDesbloquearMesa()
  const [excluindo, setExcluindo] = useState(false)
  const aoErrar = (erro: Error) => toast.error(erro.message)
  const itens: Record<AcaoMesa, React.ReactNode> = {
    abrir: (
      <DropdownMenuItem key="abrir" onSelect={aoAbrir}>
        <ReceiptTextIcon />
        Abrir comanda
      </DropdownMenuItem>
    ),
    limpa: (
      <DropdownMenuItem
        key="limpa"
        onSelect={() =>
          marcarLimpa.mutate(mesa.id, {
            onSuccess: () => toast.success(`Mesa ${mesa.numero} limpa.`),
            onError: aoErrar,
          })
        }
      >
        <SprayCanIcon />
        Marcar limpa
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
      <DropdownMenuItem key="editar" disabled={!aoEditar} onSelect={aoEditar}>
        <PencilIcon />
        Editar
      </DropdownMenuItem>
    ),
    bloquear: (
      <DropdownMenuItem key="bloquear" disabled={!aoBloquear} onSelect={aoBloquear}>
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
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(ALVO_DE_TOQUE, "absolute top-2 right-2")}
            aria-label={`Ações da mesa ${mesa.numero}`}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ACOES[estado].map((acao) => itens[acao])}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmarExclusaoMesa mesa={mesa} aberta={excluindo} aoMudar={setExcluindo} />
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
            estado.rotulo,
            mesa.clienteNome,
            comanda ? emReais(comanda.total) : null,
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
              {[
                mesa.ocupadaEm && agora ? tempoDesde(mesa.ocupadaEm, agora) : null,
                comanda?.mesa?.garcom ? `Garçom ${comanda.mesa.garcom}` : null,
                comanda?.mesa?.pessoas ? plural(comanda.mesa.pessoas, "pessoa", "pessoas") : null,
              ]
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
                <span className="text-xs text-muted-foreground">
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
            {resumoSemComanda(mesa, estado.estado, agora)}
          </span>
        )}
      </button>
      <MenuMesa
        mesa={mesa}
        estado={estado.estado}
        aoAbrir={aoAbrir}
        aoEditar={aoEditar}
        aoBloquear={aoBloquear}
      />
    </div>
  )
}
