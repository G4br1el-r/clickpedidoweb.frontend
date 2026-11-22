"use client"

import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useMemo } from "react"
import type { Pedido } from "@/lib/admin/dados/tipos"
import {
  kgVendidos,
  pesagensDoPeriodo,
  retiradasPorDia,
} from "@/lib/admin/regras/dashboard/acougue"
import { pedidosAPesar } from "@/lib/admin/regras/dashboard/contagens"
import type { Periodo } from "@/lib/admin/regras/periodo"
import { emReais, plural } from "@/lib/formato"
import { Indicador, Regua } from "../../regua"
import { Numero } from "../numero"
import { ListaDeFatias, Secao } from "../partes"

const quilos = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })
const porcento = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})
const comSinal = (valor: number) =>
  `${valor > 0 ? "+" : valor < 0 ? "−" : ""}${emReais(Math.abs(valor))}`

/** Pesagem do açougue: quanto saiu na balança, quanto o peso real mudou o valor e as retiradas. */
export function AbaPesagem({ pedidos, periodo }: { pedidos: Pedido[]; periodo: Periodo }) {
  const pesagens = useMemo(() => pesagensDoPeriodo(pedidos, periodo), [pedidos, periodo])
  const kg = useMemo(() => kgVendidos(pedidos, periodo), [pedidos, periodo])
  const retiradas = useMemo(() => retiradasPorDia(pedidos, periodo), [pedidos, periodo])
  const totalRetiradas = retiradas.reduce((soma, dia) => soma + dia.total, 0)

  return (
    <div className="flex flex-col gap-10">
      <Secao titulo="Balança do período">
        <Regua>
          <Indicador rotulo="Vendido" detalhe="pesado, ou o pedido quando não pesou">
            {`${quilos.format(kg)} kg`}
          </Indicador>
          <Indicador rotulo="Pesados" detalhe="pedidos que passaram na balança">
            <Numero valor={pesagens.pesados} />
          </Indicador>
          <Indicador
            rotulo="Diferença média"
            detalhe={
              pesagens.pesados > 0
                ? `${porcento.format(pesagens.percentual)}% sobre o estimado`
                : "Nenhum pedido pesado"
            }
          >
            {pesagens.pesados > 0 ? comSinal(pesagens.diferencaMedia) : "—"}
          </Indicador>
          <Indicador rotulo="Esperando pesagem" detalhe="agora, na fila">
            <Numero valor={pedidosAPesar(pedidos)} />
          </Indicador>
        </Regua>
      </Secao>

      <Secao titulo="Retiradas por dia" descricao="Pelo dia que o cliente marcou para buscar">
        <ListaDeFatias
          vazio="Nenhuma retirada marcada no período."
          itens={retiradas.map((dia) => ({
            chave: dia.dia,
            nome: format(parseISO(dia.dia), "EEE, dd/MM", { locale: ptBR }),
            pedidos: dia.pedidos,
            total: dia.total,
            percentual: totalRetiradas ? (dia.total / totalRetiradas) * 100 : 0,
            detalhe: plural(dia.pedidos, "pedido", "pedidos"),
          }))}
        />
      </Secao>
    </div>
  )
}
