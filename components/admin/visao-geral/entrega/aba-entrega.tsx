"use client"

import { format } from "date-fns"
import Link from "next/link"
import { useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Motoboy, Pedido } from "@/lib/admin/dados/tipos"
import { porBairro, porMotoboy, reguaDeEntregas } from "@/lib/admin/regras/dashboard/entrega"
import { SEM_MOTOBOY } from "@/lib/admin/regras/filtro-pedidos"
import type { Periodo } from "@/lib/admin/regras/periodo"
import { emReais, plural } from "@/lib/formato"
import { Indicador, Regua } from "../../regua"
import { Numero } from "../numero"
import { ListaDeFatias, Secao } from "../partes"

const dia = (data: Date) => format(data, "yyyy-MM-dd")

/** Entrega: quantas saíram, quanto rendeu de taxa e como foi cada motoboy e cada bairro. */
export function AbaEntrega({
  pedidos,
  periodo,
  motoboys,
}: {
  pedidos: Pedido[]
  periodo: Periodo
  /** Para dar nome a cada motoboy. */
  motoboys: Motoboy[]
}) {
  const regua = useMemo(() => reguaDeEntregas(pedidos, periodo), [pedidos, periodo])
  const deMotoboy = useMemo(() => porMotoboy(pedidos, periodo), [pedidos, periodo])
  const bairros = useMemo(() => porBairro(pedidos, periodo), [pedidos, periodo])
  const concluidas = deMotoboy.reduce((soma, motoboy) => soma + motoboy.entregas, 0)
  const noPeriodo = `de=${dia(periodo.de)}&ate=${dia(periodo.ate)}`
  const nomeDe = (id: string) =>
    id === SEM_MOTOBOY
      ? "Sem motoboy"
      : (motoboys.find((motoboy) => motoboy.id === id)?.nome ?? "Motoboy removido")

  return (
    <div className="flex flex-col gap-10">
      <Secao titulo="Entregas do período">
        <Regua>
          <Indicador rotulo="Entregas" detalhe="sem as canceladas">
            <Numero valor={regua.entregas} />
          </Indicador>
          <Indicador rotulo="Taxas de entrega" detalhe="cobradas dos clientes">
            <Numero valor={regua.taxas} moeda />
          </Indicador>
          <Indicador rotulo="Ticket da entrega">
            <Numero valor={regua.ticket} moeda />
          </Indicador>
          <Indicador
            rotulo="Tempo na rua"
            detalhe={
              regua.naRua.pedidos > 0
                ? `9 em 10 em até ${regua.naRua.noveEmDez} min`
                : "Nenhuma entrega concluída"
            }
          >
            {regua.naRua.pedidos > 0 ? `${regua.naRua.media} min` : "—"}
          </Indicador>
        </Regua>
      </Secao>

      <Secao titulo="Por motoboy" descricao="Entregas concluídas e as taxas delas">
        <ListaDeFatias
          vazio="Nenhuma entrega concluída no período."
          itens={deMotoboy.map((motoboy) => ({
            chave: motoboy.motoboyId,
            nome: nomeDe(motoboy.motoboyId),
            pedidos: motoboy.entregas,
            total: motoboy.taxas,
            percentual: concluidas ? (motoboy.entregas / concluidas) * 100 : 0,
            detalhe: `${plural(motoboy.entregas, "entrega", "entregas")} · ${motoboy.minutosNaRua} min na rua`,
            href: `/admin/pedidos?canal=entrega&motoboy=${motoboy.motoboyId}&${noPeriodo}`,
          }))}
        />
      </Secao>

      <Secao titulo="Por bairro" descricao="Tempo do pedido até ser entregue">
        {bairros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma entrega no período.</p>
        ) : (
          <Table aria-label="Por bairro">
            <TableHeader>
              <TableRow>
                <TableHead>Bairro</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Taxas</TableHead>
                <TableHead className="hidden text-right md:table-cell">Ticket</TableHead>
                <TableHead className="hidden text-right md:table-cell">Tempo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bairros.map((bairro) => (
                <TableRow key={bairro.bairro}>
                  <TableCell className="max-w-48 truncate">
                    <Link
                      href={`/admin/pedidos?canal=entrega&bairro=${encodeURIComponent(bairro.bairro)}&${noPeriodo}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {bairro.bairro}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{bairro.pedidos}</TableCell>
                  <TableCell className="text-right tabular-nums">{emReais(bairro.total)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {emReais(bairro.taxas)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {emReais(bairro.ticket)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {bairro.minutos ? `${bairro.minutos} min` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Secao>
    </div>
  )
}
