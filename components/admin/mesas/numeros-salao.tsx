"use client"

import { startOfDay } from "date-fns"
import { ChevronDownIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { usePedidos } from "@/lib/admin/dados/consultas"
import type { Chamado, Mesa, Pedido } from "@/lib/admin/dados/tipos"
import { tempoMedioDeAtendimento } from "@/lib/admin/regras/chamados"
import { indicadoresSalao } from "@/lib/admin/regras/indicadores-salao"
import { emReais } from "@/lib/formato"
import { Indicador, Regua } from "../regua"

const UMA_CASA = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const ou = <T,>(valor: T | null, formatar: (valor: T) => string) =>
  valor === null ? "—" : formatar(valor)

/** Faixa do topo: 4 números do salão hoje e, em "Ver mais", permanência, giro e ticket por mesa. */
export function NumerosSalao({
  mesas,
  abertas,
  agora,
  chamados,
}: {
  mesas: Mesa[]
  /** Comandas de mesa em aberto. */
  abertas: Pedido[]
  agora: Date
  /** Os chamados de hoje; sem eles (QR desligado), o tempo de atendimento não aparece. */
  chamados?: Chamado[]
}) {
  const [aberto, setAberto] = useState(false)
  // Início do dia, não a hora: a chave da consulta só muda na virada do dia.
  const hoje = startOfDay(agora)
  const { data: concluidos = [] } = usePedidos(
    { status: ["concluido"], concluidosEm: hoje },
    { atualizarACada: 30_000 },
  )
  const numeros = indicadoresSalao({ mesas, abertas, concluidos, agora })

  return (
    <section aria-label="Números do salão">
      <Collapsible open={aberto} onOpenChange={setAberto}>
        <Regua>
          <Indicador rotulo="Ocupação">{numeros.ocupacao.texto}</Indicador>
          <Indicador rotulo="Pessoas">{numeros.pessoas}</Indicador>
          <Indicador rotulo="Faturamento hoje">{emReais(numeros.faturamento)}</Indicador>
          <Indicador rotulo="Ticket por pessoa">{ou(numeros.ticketPorPessoa, emReais)}</Indicador>
        </Regua>
        <CollapsibleContent>
          <Regua>
            <Indicador rotulo="Permanência média">
              {ou(numeros.permanenciaMin, (minutos) => `${minutos} min`)}
            </Indicador>
            <Indicador rotulo="Giro das mesas">{ou(numeros.giro, UMA_CASA.format)}</Indicador>
            <Indicador rotulo="Ticket por mesa">{ou(numeros.ticketPorMesa, emReais)}</Indicador>
            {chamados && (
              <Indicador rotulo="Atendimento de chamado">
                {ou(tempoMedioDeAtendimento(chamados, agora), (minutos) => `${minutos} min`)}
              </Indicador>
            )}
          </Regua>
        </CollapsibleContent>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="group mt-1 -ml-2 text-muted-foreground">
            {aberto ? "Ver menos" : "Ver mais"}
            <ChevronDownIcon className="transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
      </Collapsible>
    </section>
  )
}
