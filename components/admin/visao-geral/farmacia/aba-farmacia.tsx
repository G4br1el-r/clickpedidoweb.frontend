"use client"

import { useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Lote, MovimentoControlado, Pedido, Produto, Receita } from "@/lib/admin/dados/tipos"
import {
  receitasPorCanal,
  saldoDosControlados,
  type TipoDeVenda,
  valorEmRisco,
  vendasPorTipoDeMedicamento,
} from "@/lib/admin/regras/dashboard/farmacia"
import type { Periodo } from "@/lib/admin/regras/periodo"
import { plural } from "@/lib/formato"
import { Indicador, Regua } from "../../regua"
import { Numero } from "../numero"
import { ListaDeFatias, Secao } from "../partes"

const CANAL: Record<Receita["canal"], string> = {
  site: "Site",
  whatsapp: "WhatsApp",
  balcao: "Balcão",
}

const TIPO: Record<TipoDeVenda, string> = {
  generico: "Genérico",
  similar: "Similar",
  referencia: "Referência",
  livre: "Venda livre",
}

/** Farmácia: o estoque que pode vencer, as receitas, os controlados e o que se vende de cada tipo. */
export function AbaFarmacia({
  pedidos,
  periodo,
  agora,
  produtos,
  receitas,
  decisoes,
  lotes,
  movimentos,
}: {
  pedidos: Pedido[]
  periodo: Periodo
  agora: Date
  produtos: Produto[]
  receitas: Receita[]
  /** A conferência do farmacêutico, por receita. */
  decisoes: Record<string, { situacao: string } | undefined>
  lotes: Lote[]
  /** A escrituração completa dos controlados. */
  movimentos: MovimentoControlado[]
}) {
  const risco = useMemo(() => valorEmRisco(lotes, produtos, agora), [lotes, produtos, agora])
  const canais = useMemo(
    () => receitasPorCanal(receitas, decisoes, periodo),
    [receitas, decisoes, periodo],
  )
  const tipos = useMemo(
    () => vendasPorTipoDeMedicamento(pedidos, produtos, periodo),
    [pedidos, produtos, periodo],
  )
  const controlados = useMemo(
    () => saldoDosControlados(movimentos, produtos),
    [movimentos, produtos],
  )
  const faturamento = tipos.reduce((soma, tipo) => soma + tipo.total, 0)
  const faixas = [
    { rotulo: "Vencidos", risco: risco.vencidos },
    { rotulo: "Vencem em 30 dias", risco: risco.em30 },
    { rotulo: "Vencem em 31 a 90 dias", risco: risco.em90 },
  ]

  return (
    <div className="flex flex-col gap-10">
      <Secao titulo="Validade dos lotes" descricao="Estoque de hoje, pelo preço de venda">
        <Regua>
          {faixas.map(({ rotulo, risco: faixa }) => (
            <Indicador
              key={rotulo}
              rotulo={rotulo}
              detalhe={`${plural(faixa.lotes, "lote", "lotes")} · ${faixa.unidades} un.`}
            >
              <Numero valor={faixa.valor} moeda />
            </Indicador>
          ))}
          <Indicador rotulo="Total em risco">
            <Numero valor={risco.vencidos.valor + risco.em30.valor + risco.em90.valor} moeda />
          </Indicador>
        </Regua>
      </Secao>

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2">
        <Secao titulo="Receitas por canal" descricao="Recebidas no período">
          {canais.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma receita recebida no período.</p>
          ) : (
            <Table aria-label="Receitas por canal">
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Recebidas</TableHead>
                  <TableHead className="text-right">Aprovadas</TableHead>
                  <TableHead className="text-right">Recusadas</TableHead>
                  <TableHead className="text-right">A conferir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {canais.map((canal) => (
                  <TableRow key={canal.canal}>
                    <TableCell className="font-medium">{CANAL[canal.canal]}</TableCell>
                    <TableCell className="text-right tabular-nums">{canal.recebidas}</TableCell>
                    <TableCell className="text-right tabular-nums">{canal.aprovadas}</TableCell>
                    <TableCell className="text-right tabular-nums">{canal.recusadas}</TableCell>
                    <TableCell className="text-right tabular-nums">{canal.aguardando}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Secao>

        <Secao titulo="Vendas por tipo" descricao="Itens vendidos no período">
          <ListaDeFatias
            vazio="Nenhuma venda no período."
            itens={tipos.map((tipo) => ({
              chave: tipo.tipo,
              nome: TIPO[tipo.tipo],
              pedidos: tipo.itens,
              total: tipo.total,
              percentual: faturamento ? (tipo.total / faturamento) * 100 : 0,
              detalhe: plural(tipo.itens, "item", "itens"),
            }))}
          />
        </Secao>
      </div>

      <Secao titulo="Saldo dos controlados" descricao="Pela escrituração, hoje">
        {controlados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum controlado no cardápio.</p>
        ) : (
          <Table aria-label="Saldo dos controlados">
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Lista</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {controlados.map((controlado) => (
                <TableRow key={controlado.produtoId}>
                  <TableCell className="max-w-64 truncate font-medium">{controlado.nome}</TableCell>
                  <TableCell>
                    {controlado.lista === "antimicrobiano" ? "Antimicrobiano" : controlado.lista}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{controlado.saldo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Secao>
    </div>
  )
}
