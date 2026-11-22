"use client"

import { startOfDay, subDays } from "date-fns"
import dynamic from "next/dynamic"
import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAgora } from "@/hooks/use-agora"
import { useLoja, usePedidos } from "@/lib/admin/dados/consultas"
import { useProdutos } from "@/lib/admin/dados/consultas-cardapio"
import { type ConfigCozinha, TEMPOS_PADRAO } from "@/lib/admin/regras/cozinha"
import {
  numerosDoPeriodo,
  porHora,
  porPraca,
  porTipo,
  produtosDemorados,
  type ResumoDoTurno,
  resumoDoTurno,
} from "@/lib/admin/regras/desempenho"
import { plural } from "@/lib/formato"
import { Indicador, Regua } from "../regua"

const GraficoPorHora = dynamic(() => import("./grafico-por-hora"), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full rounded-lg" />,
})

const minutos = (valor: number | null) => (valor === null ? "—" : `${valor} min`)

/** A faixa do turno, no topo do Quadro: como a cozinha está indo hoje. */
export function FaixaDoTurno({ resumo }: { resumo: ResumoDoTurno }) {
  return (
    <section aria-label="Turno de hoje">
      <Regua>
        <Indicador rotulo="Tempo médio até pronto">{minutos(resumo.tempoMedioMin)}</Indicador>
        <Indicador rotulo="Prontos hoje">{resumo.prontos}</Indicador>
        <Indicador rotulo="Atrasados agora">{resumo.atrasadosAgora}</Indicador>
        <Indicador
          rotulo="Mais pedido"
          detalhe={resumo.maisPedido ? `${resumo.maisPedido.quantidade} hoje` : undefined}
        >
          <span className="block truncate">{resumo.maisPedido?.nome ?? "—"}</span>
        </Indicador>
      </Regua>
    </section>
  )
}

/** A faixa do turno com os pedidos de hoje, conferidos junto com o quadro. */
export function FaixaDoTurnoAoVivo({
  agora,
  tempos,
  intervalo,
}: {
  agora: Date
  tempos: ConfigCozinha
  intervalo: number
}) {
  const hoje = startOfDay(agora)
  const { data: pedidos } = usePedidos({ de: hoje, ate: hoje }, { atualizarACada: intervalo })
  if (!pedidos) return <Skeleton className="h-20 w-full rounded-lg" />
  return <FaixaDoTurno resumo={resumoDoTurno(pedidos, agora, tempos)} />
}

type Numeros = ReturnType<typeof numerosDoPeriodo>

/** Os números principais do período, na régua. */
export function ReguaDoDesempenho({ numeros }: { numeros: Numeros }) {
  return (
    <Regua>
      <Indicador rotulo="Tempo até pronto">{minutos(numeros.tempoMedioMin)}</Indicador>
      <Indicador rotulo="No prazo">{numeros.noPrazoPct}%</Indicador>
      <Indicador
        rotulo="Tickets"
        detalhe={plural(
          numeros.canceladosDepoisDeIniciar,
          "cancelado depois de iniciar",
          "cancelados depois de iniciar",
        )}
      >
        {numeros.tickets}
      </Indicador>
      <Indicador rotulo="Retrabalho" detalhe={plural(numeros.refeitos, "refeito", "refeitos")}>
        {numeros.retrabalhoPct}%
      </Indicador>
    </Regua>
  )
}

export type LinhaDeTempo = {
  chave: string
  nome: string
  tickets: number
  tempoMedioMin: number | null
}

/**
 * Uma lista de tempos (por praça, por tipo, produtos): o nome, quantos tickets e o tempo
 * médio, com uma barra na cor do gráfico proporcional ao maior tempo da lista.
 */
export function ListaDeTempos({
  titulo,
  linhas,
  unidade = ["ticket", "tickets"],
}: {
  titulo: string
  linhas: LinhaDeTempo[]
  unidade?: [string, string]
}) {
  const maior = Math.max(1, ...linhas.map((linha) => linha.tempoMedioMin ?? 0))
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h3 className="text-[15px] font-semibold">{titulo}</h3>
      {linhas.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Sem movimento no período.</p>
      ) : (
        <ul aria-label={titulo} className="flex flex-col divide-y divide-border/70">
          {linhas.map((linha) => (
            <li key={linha.chave} className="flex flex-col gap-1.5 py-2.5 text-sm">
              <span className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate font-medium">{linha.nome}</span>
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {plural(linha.tickets, unidade[0], unidade[1])}
                </span>
                <span className="w-16 text-right font-medium tabular-nums">
                  {minutos(linha.tempoMedioMin)}
                </span>
              </span>
              <span aria-hidden="true" className="h-1.5 rounded-full bg-muted">
                <span
                  data-barra=""
                  className="block h-full rounded-full bg-(--grafico)"
                  style={{ width: `${((linha.tempoMedioMin ?? 0) / maior) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const PERIODOS = [
  { valor: "hoje", rotulo: "Hoje", dias: 1 },
  { valor: "7", rotulo: "7 dias", dias: 7 },
  { valor: "30", rotulo: "30 dias", dias: 30 },
] as const

const NOME_DO_TIPO = { mesa: "Mesas", entrega: "Entrega", retirada: "Retirada" } as const

/** A aba Desempenho: os números do período, por hora, por praça, por tipo e os produtos. */
export function DesempenhoCozinha() {
  const agora = useAgora(60_000)
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["valor"]>("hoje")
  const { data: loja } = useLoja()
  const { data: produtos = [] } = useProdutos()
  const dias = PERIODOS.find((opcao) => opcao.valor === periodo)?.dias ?? 1
  const ate = startOfDay(agora ?? new Date())
  const de = subDays(ate, dias - 1)
  const { data: pedidos } = usePedidos({ de, ate }, { ativo: Boolean(agora) })
  const tempos: ConfigCozinha = loja?.temposCozinha ?? TEMPOS_PADRAO
  const pracas = loja?.pracas ?? []

  return (
    <div className="flex flex-col gap-6">
      <ToggleGroup
        type="single"
        variant="segmento"
        size="sm"
        aria-label="Período"
        className="self-start"
        value={periodo}
        onValueChange={(valor) => valor && setPeriodo(valor as typeof periodo)}
      >
        {PERIODOS.map(({ valor, rotulo }) => (
          <ToggleGroupItem key={valor} value={valor}>
            {rotulo}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {!pedidos || !agora ? (
        <div role="status" aria-label="Carregando o desempenho" className="flex flex-col gap-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
      ) : (
        (() => {
          const opcoes = { agora, tempos }
          const intervalo = { de, ate }
          return (
            <>
              <ReguaDoDesempenho numeros={numerosDoPeriodo(pedidos, intervalo, opcoes)} />
              <section aria-label="Por hora do dia" className="flex flex-col gap-3">
                <h3 className="text-[15px] font-semibold">Tickets por hora do dia</h3>
                <GraficoPorHora horas={porHora(pedidos, intervalo, opcoes)} />
              </section>
              <div className="grid gap-8 lg:grid-cols-3">
                {pracas.length > 0 && (
                  <ListaDeTempos
                    titulo="Por praça"
                    linhas={porPraca(pedidos, intervalo, { ...opcoes, produtos, pracas }).map(
                      (linha) => ({ ...linha, chave: linha.id }),
                    )}
                  />
                )}
                <ListaDeTempos
                  titulo="Por tipo de pedido"
                  linhas={porTipo(pedidos, intervalo, opcoes).map((linha) => ({
                    ...linha,
                    chave: linha.tipo,
                    nome: NOME_DO_TIPO[linha.tipo],
                  }))}
                />
                <ListaDeTempos
                  titulo="Produtos mais demorados"
                  unidade={["vez", "vezes"]}
                  linhas={produtosDemorados(pedidos, intervalo, opcoes).map((linha) => ({
                    chave: linha.produtoId ?? linha.nome,
                    nome: linha.nome,
                    tickets: linha.vezes,
                    tempoMedioMin: linha.tempoMedioMin,
                  }))}
                />
              </div>
            </>
          )
        })()
      )}
    </div>
  )
}
