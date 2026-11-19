"use client"

import { format } from "date-fns"
import { ArrowLeftIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useCaixaAtual, useFecharCaixa, useResumoTurno } from "@/lib/admin/dados/consultas-caixa"
import { useEquipe } from "@/lib/admin/dados/consultas-equipe"
import type { FormaNoCaixa, TurnoCaixa } from "@/lib/admin/dados/tipos"
import {
  CEDULAS,
  conferir,
  diferencaEmReais,
  errosDoFechamento,
  type ResumoTurno,
  totalDaContagem,
} from "@/lib/admin/regras/caixa"
import { emReais, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"
import { ContagemCedulas } from "./contagem-cedulas"

const FORMAS: { forma: FormaNoCaixa; rotulo: string }[] = [
  { forma: "dinheiro", rotulo: "Dinheiro" },
  { forma: "pix", rotulo: "Pix" },
  { forma: "cartao-na-entrega", rotulo: "Cartão" },
]

/** A diferença com o traço: verde sem diferença, vermelho com. */
export function Diferenca({ valor }: { valor: number }) {
  return (
    <span className="inline-flex items-center justify-end gap-2 tabular-nums">
      <span
        aria-hidden="true"
        className={cn(
          "h-3.5 w-[3px] rounded-full",
          valor === 0 ? "bg-(--tom-pronto)" : "bg-(--tom-cancelado)",
        )}
      />
      {diferencaEmReais(valor)}
    </span>
  )
}

/**
 * Fechamento do turno: Pix e cartão chegam conciliados; o dinheiro é contado por
 * cédula e moeda. Com diferença, só fecha com a justificativa.
 */
export function FechamentoCaixa({
  aoVoltar,
  aoFechado,
}: {
  aoVoltar: () => void
  aoFechado: () => void
}) {
  const { data: turno } = useCaixaAtual()
  const { data: resumo } = useResumoTurno(turno?.id)
  if (!turno || !resumo) {
    return (
      <div role="status" aria-label="Carregando o fechamento" className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  return <Fechamento turno={turno} resumo={resumo} aoVoltar={aoVoltar} aoFechado={aoFechado} />
}

function Fechamento({
  turno,
  resumo,
  aoVoltar,
  aoFechado,
}: {
  turno: TurnoCaixa
  resumo: ResumoTurno
  aoVoltar: () => void
  aoFechado: () => void
}) {
  const id = useId()
  const { data: equipe = [] } = useEquipe()
  const fechar = useFecharCaixa()
  const [contagem, setContagem] = useState<number[]>(CEDULAS.map(() => 0))
  const [justificativa, setJustificativa] = useState("")
  const contado = totalDaContagem(contagem)
  const conferencia = conferir(resumo, contado, justificativa)
  const diferenca = conferencia.contado.dinheiro - conferencia.esperado.dinheiro
  const erro = errosDoFechamento(conferencia)
  const operador = equipe.find((membro) => membro.id === turno.abertoPor)?.nome ?? "…"

  function confirmar() {
    if (erro || fechar.isPending) return
    fechar.mutate(
      { contadoDinheiro: contado, ...(justificativa.trim() ? { justificativa } : {}) },
      {
        onSuccess: () => {
          toast.success("Caixa fechado.")
          // A contagem é longa: a abertura do próximo turno começa do topo.
          window.scrollTo({ top: 0 })
          aoFechado()
        },
        onError: (falha) => toast.error(falha.message),
      },
    )
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1
            id={`${id}-titulo`}
            className="text-2xl leading-tight font-semibold tracking-[-0.02em]"
          >
            Fechar o caixa
          </h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            {operador} · aberto às {format(new Date(turno.abertoEm), "HH:mm")} · fundo de{" "}
            {emReais(turno.fundo)} · {plural(resumo.vendas, "venda", "vendas")},{" "}
            {emReais(resumo.total)}
          </p>
        </div>
        <Button type="button" variant="ghost" className="self-start" onClick={aoVoltar}>
          <ArrowLeftIcon data-icon="inline-start" />
          Voltar à venda
        </Button>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-0">
        <div className="flex flex-col gap-5 lg:border-r lg:border-border/70 lg:pr-8">
          <Table aria-label="Conferência por forma de pagamento">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-0">Forma</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Conferido</TableHead>
                <TableHead className="pr-0 text-right">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums">
              {FORMAS.map(({ forma, rotulo }) => (
                <TableRow key={forma}>
                  <TableCell className="py-3 pl-0 font-medium">{rotulo}</TableCell>
                  <TableCell className="text-right">
                    {emReais(conferencia.esperado[forma])}
                  </TableCell>
                  <TableCell className="text-right">
                    {emReais(conferencia.contado[forma])}
                  </TableCell>
                  <TableCell className="pr-0 text-right">
                    <Diferenca valor={conferencia.contado[forma] - conferencia.esperado[forma]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-[13px] text-muted-foreground">
            Pix e cartão chegam conciliados. O dinheiro esperado é o fundo, mais as vendas em
            dinheiro e os suprimentos, menos as sangrias.
          </p>

          {Math.round(diferenca * 100) !== 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-justificativa`}>Justificativa</Label>
              <Textarea
                id={`${id}-justificativa`}
                maxLength={280}
                rows={3}
                placeholder="O que explica a diferença? Pelo menos 5 letras."
                value={justificativa}
                onChange={(evento) => setJustificativa(evento.target.value)}
              />
            </div>
          )}
          {erro && justificativa.trim().length > 0 && (
            <p className="text-sm text-muted-foreground">{erro}</p>
          )}
          <Button
            type="button"
            size="lg"
            className="h-12 self-start rounded-full px-6"
            disabled={Boolean(erro) || fechar.isPending}
            onClick={confirmar}
          >
            Fechar caixa
          </Button>
        </div>

        <section aria-labelledby={`${id}-contagem`} className="flex flex-col gap-3 lg:pl-8">
          <div className="flex flex-col gap-0.5">
            <h2 id={`${id}-contagem`} className="text-[15px] font-semibold">
              Contagem da gaveta
            </h2>
            <p className="text-[13px] text-muted-foreground">
              Conte cédula por cédula. O total vai para o conferido do dinheiro.
            </p>
          </div>
          <ContagemCedulas quantidades={contagem} aoMudar={setContagem} />
          <div className="flex justify-between border-t border-foreground/80 pt-2 text-sm font-semibold tabular-nums">
            <span>Total contado</span>
            <span>{emReais(contado)}</span>
          </div>
        </section>
      </div>
    </section>
  )
}
