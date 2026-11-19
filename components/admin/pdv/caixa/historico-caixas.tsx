"use client"

import { format } from "date-fns"
import { ArrowLeftIcon, RotateCcwIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useCaixaAtual,
  useHistoricoCaixas,
  useReabrirCaixa,
  useVendasDoTurno,
} from "@/lib/admin/dados/consultas-caixa"
import { useEquipe, usePerfilAtual } from "@/lib/admin/dados/consultas-equipe"
import type { Autorizacao, MembroEquipe, TurnoCaixa } from "@/lib/admin/dados/tipos"
import { diferencaDinheiro, type ResumoTurno } from "@/lib/admin/regras/caixa"
import { precisaAutorizacao } from "@/lib/admin/regras/equipe"
import { rotuloPagamento } from "@/lib/admin/regras/rotulos"
import { emReais, plural } from "@/lib/formato"
import { EsqueletoLinhas } from "../../entrega/linha-animada"
import { JanelaAutorizacao } from "../../equipe/janela-autorizacao"
import { Diferenca } from "./fechamento-caixa"

const hora = (iso: string) => format(new Date(iso), "HH:mm")
const dia = (iso: string) => format(new Date(iso), "dd/MM")

function nomeDe(equipe: MembroEquipe[], id?: string) {
  return equipe.find((membro) => membro.id === id)?.nome ?? "alguém da equipe"
}

/** As vendas do turno: número, hora, forma e total; a cancelada aparece riscada. */
function VendasDoTurno({ turnoId }: { turnoId: string }) {
  const id = useId()
  const { data: vendas } = useVendasDoTurno(turnoId)
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-[13px] text-muted-foreground">
        Vendas
      </span>
      {!vendas ? (
        <p className="text-sm text-muted-foreground">Carregando as vendas…</p>
      ) : vendas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma venda neste turno.</p>
      ) : (
        <ul aria-labelledby={id} className="flex max-h-56 flex-col overflow-y-auto text-sm">
          {vendas.map((venda) => (
            <li
              key={venda.id}
              className={
                venda.status === "cancelado"
                  ? "flex justify-between gap-3 border-b border-border/60 py-1.5 text-muted-foreground line-through tabular-nums"
                  : "flex justify-between gap-3 border-b border-border/60 py-1.5 tabular-nums"
              }
            >
              <span>
                #{venda.numero} · {hora(venda.criadoEm)} · {rotuloPagamento(venda.pagamento)}
              </span>
              <span className="font-medium">{emReais(venda.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Detalhe de um turno: os números, os movimentos com quem fez e quem autorizou. */
function DetalheTurno({
  turno,
  resumo,
  equipe,
  aoFechar,
}: {
  turno: TurnoCaixa
  resumo: ResumoTurno
  equipe: MembroEquipe[]
  aoFechar: () => void
}) {
  const operador = nomeDe(equipe, turno.abertoPor)
  const numeros: [string, string][] = [
    ["Fundo", emReais(turno.fundo)],
    ["Vendas", String(resumo.vendas)],
    ["Total vendido", emReais(resumo.total)],
    ["Dinheiro esperado", emReais(turno.conferencia?.esperado.dinheiro ?? resumo.dinheiroNaGaveta)],
    ["Dinheiro contado", turno.conferencia ? emReais(turno.conferencia.contado.dinheiro) : "—"],
  ]
  return (
    <Dialog open onOpenChange={(aberta) => !aberta && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Caixa de {dia(turno.abertoEm)} · {operador}
          </DialogTitle>
          <DialogDescription className="tabular-nums">
            Aberto às {hora(turno.abertoEm)}
            {turno.fechadoEm
              ? `, fechado às ${hora(turno.fechadoEm)} por ${nomeDe(equipe, turno.fechadoPor)}.`
              : ". Ainda aberto."}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm tabular-nums">
          {numeros.map(([rotulo, valor]) => (
            <div
              key={rotulo}
              className="flex justify-between gap-3 border-b border-border/60 pb-1.5"
            >
              <dt className="text-muted-foreground">{rotulo}</dt>
              <dd className="font-medium">{valor}</dd>
            </div>
          ))}
          {turno.conferencia && (
            <div className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
              <dt className="text-muted-foreground">Diferença</dt>
              <dd className="font-medium">
                <Diferenca valor={diferencaDinheiro(turno.conferencia)} />
              </dd>
            </div>
          )}
        </dl>
        {turno.conferencia?.justificativa && (
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-muted-foreground">Justificativa</span>
            <p className="text-sm">{turno.conferencia.justificativa}</p>
          </div>
        )}
        <VendasDoTurno turnoId={turno.id} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">Sangrias e suprimentos</span>
          {turno.movimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum neste turno.</p>
          ) : (
            <ul className="flex flex-col text-sm">
              {turno.movimentos.map((movimento) => (
                <li
                  key={movimento.id}
                  className="flex justify-between gap-3 border-b border-border/60 py-1.5 tabular-nums"
                >
                  <span>
                    {movimento.tipo === "sangria" ? "Sangria" : "Suprimento"} · {movimento.motivo}
                    <span className="block text-[13px] text-muted-foreground">
                      {hora(movimento.criadoEm)} · por {nomeDe(equipe, movimento.feitoPor)}
                      {movimento.autorizadoPor &&
                        `, autorizou ${nomeDe(equipe, movimento.autorizadoPor)}`}
                    </span>
                  </span>
                  <span className="font-medium">
                    {movimento.tipo === "sangria" ? "−" : "+"}
                    {emReais(movimento.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {turno.reaberturas && turno.reaberturas.length > 0 && (
          <p className="text-[13px] text-muted-foreground">
            Reaberto{" "}
            {turno.reaberturas
              .map(
                (item) => `às ${hora(item.em)} (autorizou ${nomeDe(equipe, item.autorizadoPor)})`,
              )
              .join(", ")}
            .
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Histórico de caixas: os turnos do mais novo para o mais antigo, com esperado ×
 * contado. O último turno fechado pode ser reaberto (o Caixa precisa do gerente).
 */
export function HistoricoCaixas({
  aoVoltar,
  aoReabrir,
}: {
  aoVoltar: () => void
  aoReabrir: () => void
}) {
  const id = useId()
  const { data: historico } = useHistoricoCaixas()
  const { data: aberto } = useCaixaAtual()
  const { data: equipe = [] } = useEquipe()
  const perfil = usePerfilAtual()
  const reabrir = useReabrirCaixa()
  const [detalhe, setDetalhe] = useState<string>()
  const [autorizando, setAutorizando] = useState(false)

  const ultimo = historico?.[0]?.turno
  const podeReabrir = Boolean(ultimo?.fechadoEm) && !aberto
  const escolhido = historico?.find((item) => item.turno.id === detalhe)

  const enviar = async (autorizacao?: Autorizacao) => {
    if (!ultimo) return
    await reabrir.mutateAsync({ turnoId: ultimo.id, ...(autorizacao ? { autorizacao } : {}) })
    toast.success("Caixa reaberto.")
    aoReabrir()
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1
            id={`${id}-titulo`}
            className="text-2xl leading-tight font-semibold tracking-[-0.02em]"
          >
            Histórico de caixas
          </h1>
          <p className="text-sm text-muted-foreground">
            {historico
              ? `${plural(historico.length, "turno", "turnos")}, do mais novo para o mais antigo.`
              : "Os turnos do caixa, do mais novo para o mais antigo."}
          </p>
        </div>
        <div className="flex gap-2">
          {podeReabrir && (
            <Button
              type="button"
              variant="outline"
              disabled={reabrir.isPending}
              onClick={() =>
                perfil && precisaAutorizacao(perfil, "reabrir-caixa")
                  ? setAutorizando(true)
                  : enviar().catch((falha: Error) => toast.error(falha.message))
              }
            >
              <RotateCcwIcon data-icon="inline-start" />
              Reabrir caixa
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={aoVoltar}>
            <ArrowLeftIcon data-icon="inline-start" />
            Voltar
          </Button>
        </div>
      </div>

      {!historico ? (
        <EsqueletoLinhas rotulo="Carregando os caixas" linhas={6} />
      ) : (
        <Table aria-label="Caixas">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-0">Data</TableHead>
              <TableHead>Operador</TableHead>
              <TableHead className="hidden sm:table-cell">Horário</TableHead>
              <TableHead className="text-right">Vendido</TableHead>
              <TableHead className="pr-0 text-right">Diferença</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums">
            {historico.map(({ turno, resumo }) => {
              const operador = nomeDe(equipe, turno.abertoPor)
              return (
                <TableRow key={turno.id}>
                  <TableCell className="py-2.5 pl-0 font-medium">
                    <button
                      type="button"
                      className="rounded-sm text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      aria-label={`${dia(turno.abertoEm)} · ${operador}: ver o detalhe`}
                      onClick={() => setDetalhe(turno.id)}
                    >
                      {dia(turno.abertoEm)}
                    </button>
                  </TableCell>
                  <TableCell>{operador}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {hora(turno.abertoEm)}–{turno.fechadoEm ? hora(turno.fechadoEm) : "agora"}
                  </TableCell>
                  <TableCell className="text-right">{emReais(resumo.total)}</TableCell>
                  <TableCell className="pr-0 text-right">
                    {turno.conferencia ? (
                      <Diferenca valor={diferencaDinheiro(turno.conferencia)} />
                    ) : (
                      <span className="text-muted-foreground">Aberto</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {escolhido && (
        <DetalheTurno
          turno={escolhido.turno}
          resumo={escolhido.resumo}
          equipe={equipe}
          aoFechar={() => setDetalhe(undefined)}
        />
      )}
      <JanelaAutorizacao
        aberta={autorizando}
        acao="reabrir-caixa"
        aoFechar={() => setAutorizando(false)}
        aoAutorizar={enviar}
      />
    </section>
  )
}
