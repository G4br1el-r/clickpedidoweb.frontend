"use client"

import { format } from "date-fns"
import Link from "next/link"
import { useMemo } from "react"
import type { Pedido, TaxasPagamento } from "@/lib/admin/dados/tipos"
import {
  aReceber,
  descontosDoPdv,
  formasDePagamento,
  reguaFinanceira,
  taxaDeServico,
  taxasEstimadas,
} from "@/lib/admin/regras/dashboard/financeiro"
import { margemDoPeriodo } from "@/lib/admin/regras/dashboard/produtos"
import type { Periodo } from "@/lib/admin/regras/periodo"
import { rotuloPagamento, rotuloTaxa } from "@/lib/admin/regras/rotulos"
import { emReais, plural } from "@/lib/formato"
import { Indicador, Regua } from "../../regua"
import { Numero } from "../numero"
import { ListaDeFatias, Secao } from "../partes"

const porcento = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })
const lista = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" })

const dia = (data: Date) => format(data, "yyyy-MM-dd")

/** Financeiro: do bruto ao líquido, o que as taxas e o custo levam e o que falta receber. */
export function AbaFinanceiro({
  pedidos,
  periodo,
  taxas,
}: {
  /** Pedidos do período (e do anterior, que esta aba não usa). */
  pedidos: Pedido[]
  periodo: Periodo
  taxas: TaxasPagamento | undefined
}) {
  const regua = useMemo(() => reguaFinanceira(pedidos, periodo), [pedidos, periodo])
  const pdv = useMemo(() => descontosDoPdv(pedidos, periodo), [pedidos, periodo])
  const estimadas = useMemo(
    () => taxasEstimadas(pedidos, periodo, taxas),
    [pedidos, periodo, taxas],
  )
  const margem = useMemo(() => margemDoPeriodo(pedidos, periodo), [pedidos, periodo])
  const receber = useMemo(() => aReceber(pedidos, periodo), [pedidos, periodo])
  const formas = useMemo(() => formasDePagamento(pedidos, periodo), [pedidos, periodo])
  const taxaServico = useMemo(() => taxaDeServico(pedidos, periodo), [pedidos, periodo])
  const noPeriodo = `de=${dia(periodo.de)}&ate=${dia(periodo.ate)}`
  const abertos = [
    receber.naEntrega.pedidos > 0 &&
      `${plural(receber.naEntrega.pedidos, "pedido", "pedidos")} na entrega`,
    receber.pendentes.pedidos > 0 && plural(receber.pendentes.pedidos, "pendente", "pendentes"),
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-10">
      <Secao titulo="Do bruto ao líquido" descricao="Vendas válidas do período">
        <Regua>
          <Indicador rotulo="Bruto" detalhe="Soma dos itens">
            <Numero valor={regua.bruto} moeda />
          </Indicador>
          <Indicador
            rotulo="Descontos"
            detalhe={
              pdv.pedidos > 0
                ? `${emReais(pdv.total)} no PDV, em ${plural(pdv.pedidos, "venda", "vendas")}`
                : "Nenhum no PDV"
            }
          >
            <Numero valor={regua.descontos} moeda />
          </Indicador>
          <Indicador rotulo="Taxas de entrega" detalhe="Cobradas dos clientes">
            <Numero valor={regua.taxasEntrega} moeda />
          </Indicador>
          <Indicador rotulo="Líquido" detalhe="Bruto − descontos + entrega">
            <Numero valor={regua.liquido} moeda />
          </Indicador>
        </Regua>
      </Secao>

      <Secao
        titulo="Depois das taxas e do custo"
        descricao="Estimativas, pelo que está configurado"
      >
        <Regua>
          <Indicador rotulo="Taxas de pagamento" detalhe="Pix online e cartões">
            <Numero valor={estimadas.total} moeda />
          </Indicador>
          <Indicador rotulo="Líquido depois das taxas" detalhe="O que fica na conta">
            <Numero valor={estimadas.liquidoDepois} moeda />
          </Indicador>
          <Indicador
            rotulo="Margem bruta"
            detalhe={
              margem.total.receita > 0
                ? `${porcento.format(margem.total.percentual)}% · custo informado em ${porcento.format(margem.cobertura)}% do faturamento`
                : "Nenhum produto com custo"
            }
          >
            <Numero valor={margem.total.margem} moeda />
          </Indicador>
          <Indicador
            rotulo="A receber"
            detalhe={abertos.length > 0 ? abertos.join(", ") : "Nada em aberto"}
          >
            <Numero valor={receber.naEntrega.total + receber.pendentes.total} moeda />
          </Indicador>
        </Regua>
      </Secao>

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2">
        <Secao
          titulo="Formas de pagamento"
          descricao={
            // O líquido fica sem a taxa; aqui é o que entrou no caixa (Q34).
            taxaServico > 0
              ? "No período. O que entrou no caixa, inclui a taxa de serviço"
              : "No período"
          }
        >
          <ListaDeFatias
            vazio="Nenhuma venda no período."
            itens={formas.map((fatia) => ({
              ...fatia,
              chave: fatia.forma,
              nome: rotuloPagamento(fatia.forma),
              href: `/admin/pedidos?pagamento=${fatia.forma}&${noPeriodo}`,
            }))}
          />
        </Secao>
        <Secao titulo="Taxas por forma" descricao="Estimadas, pela % das Configurações">
          {estimadas.formas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma venda com Pix online ou cartão no período.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/70 border-y border-border/70">
              {estimadas.formas.map((forma) => (
                <li key={forma.forma} className="flex items-start gap-3 py-2.5 text-sm">
                  {/* No celular, a % desce para baixo do nome, para o nome caber inteiro. */}
                  <span className="flex min-w-0 flex-1 flex-col gap-x-3 sm:flex-row sm:items-baseline">
                    <span className="font-medium">{rotuloTaxa(forma.forma)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums sm:ml-auto sm:text-sm">
                      {`${decimal.format(forma.taxa ?? 0)}% de ${emReais(forma.vendido)}`}
                    </span>
                  </span>
                  <span className="w-24 shrink-0 text-right tabular-nums">
                    {emReais(forma.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {estimadas.semTaxa.length > 0 && (
            <p className="text-[13px] text-muted-foreground">
              {`Sem taxa informada para ${lista.format(estimadas.semTaxa.map(rotuloTaxa))}: conta como 0%.`}{" "}
              <Link href="/admin/loja" className="underline underline-offset-4">
                Configurar as taxas
              </Link>
            </p>
          )}
        </Secao>
      </div>

      {/* A taxa de serviço é dos garçons, não da casa: aparece à parte (Q34). */}
      {taxaServico > 0 && (
        <Secao titulo="Taxa de serviço" descricao="No período, dos garçons">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {emReais(taxaServico)}
          </p>
        </Secao>
      )}
    </div>
  )
}
