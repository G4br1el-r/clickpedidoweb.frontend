"use client"

import { useId, useState } from "react"
import { NumericFormat } from "react-number-format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useMetas } from "@/lib/admin/metas"
import type { SituacaoMeta } from "@/lib/admin/regras/dashboard/metas"
import type { SegmentoPainelId } from "@/lib/admin/segmentos-painel"
import { emReais } from "@/lib/formato"
import { Indicador, Regua } from "../regua"
import { Numero } from "./numero"

/** Campo da meta em reais, aberto ali mesmo no bloco. */
function FormularioMeta({
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  inicial?: number
  aoSalvar: (faturamento: number) => void
  aoCancelar: () => void
}) {
  const [valor, setValor] = useState<number | undefined>(inicial)
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(evento) => {
        evento.preventDefault()
        if (valor && valor > 0) aoSalvar(valor)
      }}
    >
      <NumericFormat
        customInput={Input}
        aria-label="Faturamento do mês"
        inputMode="decimal"
        prefix="R$ "
        decimalSeparator=","
        thousandSeparator="."
        decimalScale={2}
        value={valor ?? ""}
        onValueChange={({ floatValue }) => setValor(floatValue)}
        className="h-9 w-44 tabular-nums"
        autoFocus
      />
      <Button type="submit" size="sm">
        Salvar meta
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={aoCancelar}>
        Cancelar
      </Button>
    </form>
  )
}

/** A meta do mês: o convite para definir, ou o progresso, a meta de hoje e a projeção. */
export function BlocoMeta({
  segmento,
  situacao,
}: {
  segmento: SegmentoPainelId
  situacao: SituacaoMeta | null
}) {
  const id = useId()
  const definir = useMetas((estado) => estado.definir)
  const apagar = useMetas((estado) => estado.apagar)
  const [editando, setEditando] = useState(false)

  return (
    <section id="meta" aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em]">
        Meta do mês
      </h2>
      {editando ? (
        <FormularioMeta
          inicial={situacao?.mes.meta}
          aoSalvar={(faturamento) => {
            definir(segmento, { faturamento, pedidos: null })
            setEditando(false)
          }}
          aoCancelar={() => setEditando(false)}
        />
      ) : situacao ? (
        <>
          <Regua>
            <Indicador
              rotulo="Vendido no mês"
              detalhe={
                <span className="flex flex-col gap-2">
                  {`de ${emReais(situacao.mes.meta)} · ${Math.floor(situacao.mes.percentual)}%`}
                  <Progress
                    className="h-1.5"
                    value={Math.min(100, situacao.mes.percentual)}
                    aria-label={`${Math.floor(situacao.mes.percentual)}% da meta do mês`}
                  />
                </span>
              }
            >
              <Numero valor={situacao.mes.realizado} moeda />
            </Indicador>
            <Indicador
              rotulo="Meta de hoje"
              detalhe={`Vendido hoje: ${emReais(situacao.hoje.realizado)}`}
            >
              <Numero valor={situacao.hoje.meta} moeda />
            </Indicador>
            <Indicador
              rotulo="Projeção do mês"
              detalhe={
                situacao.projecao === null
                  ? "A partir do 3º dia de funcionamento"
                  : "No ritmo dos dias abertos"
              }
            >
              {situacao.projecao === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <Numero valor={situacao.projecao} moeda />
              )}
            </Indicador>
            <Indicador rotulo="Falta para a meta">
              <Numero valor={Math.max(0, situacao.mes.meta - situacao.mes.realizado)} moeda />
            </Indicador>
          </Regua>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditando(true)}>
              Mudar meta
            </Button>
            <Button size="sm" variant="ghost" onClick={() => apagar(segmento)}>
              Apagar meta
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3 border-y border-border/70 py-4 text-sm">
          <span className="text-muted-foreground">
            Defina a meta do mês para acompanhar o ritmo
          </span>
          <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
            Definir meta
          </Button>
        </div>
      )}
    </section>
  )
}
