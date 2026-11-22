"use client"

import { format } from "date-fns"
import { useMemo } from "react"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { nomesDo } from "@/lib/admin/regras/dashboard/nomes"
import {
  atrasosPorHora,
  cancelamentos,
  mesasDoPeriodo,
  noPrazo,
  pontualidade,
  type Tempo,
  TOLERANCIA_DO_SALAO,
  temposPorEtapa,
} from "@/lib/admin/regras/dashboard/operacao"
import { MINUTOS_DE_ATRASO } from "@/lib/admin/regras/fila"
import type { Periodo } from "@/lib/admin/regras/periodo"
import { rotuloCanal, rotuloMotivo } from "@/lib/admin/regras/rotulos"
import { type SegmentoPainelId, temModulo } from "@/lib/admin/segmentos-painel"
import { emReais, plural } from "@/lib/formato"
import { Indicador, Regua } from "../../regua"
import { BaixarCsv } from "../exportar"
import { Numero } from "../numero"
import { ListaDeFatias, Secao } from "../partes"

const porcento = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })

const dia = (data: Date) => format(data, "yyyy-MM-dd")

/** As etapas na ordem do pedido; as que nenhum pedido do período passou ficam de fora. */
const ETAPAS = [
  ["aceite", "Aceite"],
  ["preparo", "Preparo"],
  ["espera", "Espera do motoboy"],
  ["entrega", "Entrega"],
  ["total", "Total na loja"],
] as const

/** Operação: quanto tempo os pedidos levam, quantos atrasam e quantos se perdem. */
export function AbaOperacao({
  pedidos,
  periodo,
  segmento,
}: {
  pedidos: Pedido[]
  periodo: Periodo
  segmento: SegmentoPainelId
}) {
  const n = nomesDo(segmento)
  const tempos = useMemo(() => temposPorEtapa(pedidos, periodo), [pedidos, periodo])
  const prazo = useMemo(() => noPrazo(pedidos, periodo), [pedidos, periodo])
  const perdas = useMemo(() => cancelamentos(pedidos, periodo), [pedidos, periodo])
  const considerados = perdas.porCanal.reduce((soma, canal) => soma + canal.pedidos, 0)
  const horas = useMemo(() => atrasosPorHora(pedidos, periodo), [pedidos, periodo])
  const salao = segmento === "salao"
  const comMesas = temModulo(segmento, "mesas")
  const pontual = useMemo(() => pontualidade(pedidos, periodo), [pedidos, periodo])
  const mesas = useMemo(() => mesasDoPeriodo(pedidos, periodo), [pedidos, periodo])
  const totalDasMesas = mesas.porGarcom.reduce((soma, garcom) => soma + garcom.total, 0)
  const noPeriodo = `de=${dia(periodo.de)}&ate=${dia(periodo.ate)}`
  const etapas = ETAPAS.flatMap(([chave, nome]) => {
    const tempo: Tempo = tempos[chave]
    return tempo.pedidos > 0 ? [{ chave, nome, tempo }] : []
  })

  return (
    <div className="flex flex-col gap-10">
      {salao ? (
        <Secao titulo="Pontualidade" descricao="Atendimentos concluídos">
          <Regua>
            <Indicador rotulo="Atraso para começar" detalhe="em média, depois da hora marcada">
              {pontual.atendimentos > 0 ? `${pontual.atrasoMedio} min` : "—"}
            </Indicador>
            <Indicador rotulo="Começou na hora" detalhe={`até ${TOLERANCIA_DO_SALAO} min depois`}>
              {pontual.atendimentos > 0 ? `${porcento.format(pontual.naHora)}%` : "—"}
            </Indicador>
            <Indicador
              rotulo="Duração real"
              detalhe={
                pontual.atendimentos > 0 ? `marcada: ${pontual.duracaoMarcada} min` : undefined
              }
            >
              {pontual.atendimentos > 0 ? `${pontual.duracaoReal} min` : "—"}
            </Indicador>
            <Indicador
              rotulo="Cancelados"
              detalhe={`${perdas.cancelados} de ${considerados} ${n.pedidos}`}
            >
              {`${porcento.format(perdas.taxa)}%`}
            </Indicador>
          </Regua>
        </Secao>
      ) : (
        <>
          <Secao titulo="Operação do período">
            <Regua>
              <Indicador
                rotulo="No prazo"
                detalhe={`abaixo de ${MINUTOS_DE_ATRASO} min, como na fila`}
              >
                {prazo.pedidos > 0 ? `${porcento.format(prazo.percentual)}%` : "—"}
              </Indicador>
              <Indicador
                rotulo="Tempo na loja"
                detalhe={
                  tempos.total.pedidos > 0
                    ? `9 em 10 em até ${tempos.total.noveEmDez} min`
                    : `Nenhum ${n.pedido} concluído`
                }
              >
                {tempos.total.pedidos > 0 ? `${tempos.total.media} min` : "—"}
              </Indicador>
              <Indicador
                rotulo="Cancelados"
                detalhe={`${perdas.cancelados} de ${considerados} ${n.pedidos}`}
              >
                {`${porcento.format(perdas.taxa)}%`}
              </Indicador>
              <Indicador
                rotulo="Online não pago"
                detalhe={
                  perdas.onlineNaoPago.pedidos > 0
                    ? `${emReais(perdas.onlineNaoPago.total)} que não entraram`
                    : "Todo Pix e cartão online entrou"
                }
              >
                <Numero valor={perdas.onlineNaoPago.pedidos} />
              </Indicador>
            </Regua>
          </Secao>

          <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2">
            <Secao
              titulo="Tempo por etapa"
              descricao={`${n.Pedidos} concluídos, em minutos`}
              acao={
                etapas.length > 0 && (
                  <BaixarCsv
                    tabela="Tempo por etapa"
                    linhas={etapas}
                    colunas={[
                      { titulo: "Etapa", valor: (etapa) => etapa.nome },
                      {
                        titulo: "Média (min)",
                        tipo: "numero",
                        valor: (etapa) => etapa.tempo.media,
                      },
                      {
                        titulo: "9 em 10 em até (min)",
                        tipo: "numero",
                        valor: (etapa) => etapa.tempo.noveEmDez,
                      },
                    ]}
                  />
                )
              }
            >
              {etapas.length === 0 ? (
                <p className="text-sm text-muted-foreground">{`Nenhum ${n.pedido} concluído no período.`}</p>
              ) : (
                <Table aria-label="Tempo por etapa">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Etapa</TableHead>
                      <TableHead className="text-right">Média</TableHead>
                      <TableHead className="text-right">9 em 10 em até</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {etapas.map(({ chave, nome, tempo }) => (
                      <TableRow
                        key={chave}
                        className={chave === "total" ? "font-medium" : undefined}
                      >
                        <TableCell>{nome}</TableCell>
                        <TableCell className="text-right tabular-nums">{`${tempo.media} min`}</TableCell>
                        <TableCell className="text-right tabular-nums">{`${tempo.noveEmDez} min`}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Secao>

            <Secao titulo="Atrasos por hora" descricao={`Pela hora do ${n.pedido}`}>
              {horas.length === 0 ? (
                <p className="text-sm text-muted-foreground">{`Nenhum ${n.pedido} concluído no período.`}</p>
              ) : (
                <ul className="barras-do-grafico flex flex-col gap-2">
                  {horas.map((hora) => (
                    <li
                      key={hora.hora}
                      className="grid grid-cols-[2.5rem_1fr] items-center gap-x-3 gap-y-1 text-sm"
                    >
                      <span className="text-muted-foreground tabular-nums">{hora.hora}h</span>
                      <span className="text-xs text-muted-foreground">
                        {`${hora.atrasados} de ${hora.pedidos} ${hora.atrasados === 1 ? "atrasou" : "atrasaram"}`}
                      </span>
                      <Progress
                        value={(hora.atrasados / hora.pedidos) * 100}
                        aria-hidden="true"
                        className="col-start-2 h-1.5"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Secao>
          </div>
        </>
      )}

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2">
        <Secao
          titulo="Cancelamentos por motivo"
          descricao="Toque num motivo para ver os cancelados"
        >
          <ListaDeFatias
            vazio={`Nenhum ${n.pedido} cancelado no período.`}
            itens={perdas.porMotivo.map((motivo) => ({
              chave: motivo.motivo,
              nome: rotuloMotivo(motivo.motivo === "nao-informado" ? undefined : motivo.motivo),
              pedidos: motivo.pedidos,
              total: motivo.total,
              percentual: perdas.cancelados ? (motivo.pedidos / perdas.cancelados) * 100 : 0,
              detalhe: plural(motivo.pedidos, n.pedido, n.pedidos),
              href: `/admin/pedidos?status=cancelado&motivo=${motivo.motivo}&${noPeriodo}`,
            }))}
          />
        </Secao>

        <Secao titulo="Cancelamentos por canal" descricao="Quanto de cada canal foi cancelado">
          {perdas.porCanal.length === 0 ? (
            <p className="text-sm text-muted-foreground">{`Nenhum ${n.pedido} no período.`}</p>
          ) : (
            <ul className="barras-do-grafico flex flex-col gap-3">
              {perdas.porCanal.map((canal) => (
                <li key={canal.tipo} className="flex flex-col gap-1.5 text-sm">
                  <div className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {rotuloCanal(canal.tipo)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums sm:text-sm">
                      {`${canal.cancelados} de ${canal.pedidos}`}
                    </span>
                    <span className="w-10 shrink-0 text-right tabular-nums">
                      {`${porcento.format(canal.taxa)}%`}
                    </span>
                  </div>
                  <Progress value={canal.taxa} aria-hidden="true" className="h-1.5" />
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>

      {comMesas && (
        <div className="flex flex-col gap-10">
          <Secao titulo="Mesas" descricao="Comandas fechadas no período">
            <Regua>
              <Indicador rotulo="Comandas">
                <Numero valor={mesas.comandas} />
              </Indicador>
              <Indicador rotulo="Tempo de mesa" detalhe="da abertura ao fechamento da conta">
                {mesas.comandas > 0 ? `${mesas.minutosPorMesa} min` : "—"}
              </Indicador>
              <Indicador rotulo="Ticket por mesa">
                <Numero valor={mesas.ticket} moeda />
              </Indicador>
            </Regua>
          </Secao>
          <Secao titulo="Vendas por garçom" descricao="Comandas fechadas">
            <ListaDeFatias
              vazio="Nenhuma comanda fechada no período."
              itens={mesas.porGarcom.map((garcom) => ({
                chave: garcom.garcom,
                nome: garcom.garcom,
                pedidos: garcom.comandas,
                total: garcom.total,
                percentual: totalDasMesas ? (garcom.total / totalDasMesas) * 100 : 0,
                detalhe: plural(garcom.comandas, "comanda", "comandas"),
              }))}
            />
          </Secao>
        </div>
      )}
    </div>
  )
}
