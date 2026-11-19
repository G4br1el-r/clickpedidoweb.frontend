"use client"

import NumberFlow from "@number-flow/react"
import Link from "next/link"
import type { ReactNode } from "react"
import type { FiltroDaFila, MetricasDaFila } from "@/lib/admin/regras/metricas-fila"
import { cn } from "@/lib/utils"
import { Traco } from "../traco"

/**
 * Um fato da régua da fila. Os fios entre os fatos saem de cada item (fio à esquerda e em
 * cima, recolhidos 1 px): a régua corta o que sobra na borda, em qualquer número de colunas.
 */
const FATO =
  "-mt-px -ml-px flex basis-1/2 flex-col gap-1.5 border-t border-l border-border/70 px-3 py-3 text-left @md:basis-1/4 @5xl:basis-1/8"
const TOCAVEL =
  "transition-colors duration-150 hover:bg-foreground/[0.025] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"

function Conteudo({
  rotulo,
  valor,
  sufixo,
  tom,
  escolhido,
  lerValor,
}: {
  rotulo: string
  valor: number | null
  sufixo?: string
  tom?: string | undefined
  escolhido?: boolean
  lerValor?: boolean
}) {
  return (
    <>
      <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
        {escolhido && <Traco tom="novo" />}
        <span className={cn(escolhido && "font-medium text-foreground")}>{rotulo}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "text-[22px] leading-none font-semibold tracking-[-0.025em] tabular-nums",
          tom,
        )}
      >
        {valor === null ? "—" : <NumberFlow value={valor} suffix={sufixo} />}
      </span>
      {/* Fora de botão e link, o número vai por escrito para o leitor de tela. */}
      {lerValor && (
        <span className="sr-only">{valor === null ? "sem dados" : `${valor}${sufixo ?? ""}`}</span>
      )}
    </>
  )
}

const comValor = (rotulo: string, valor: number | null, sufixo = "") =>
  `${rotulo}, ${valor === null ? "sem dados" : `${valor}${sufixo}`}`

/**
 * A régua da fila: números ao vivo entre fios, sem cartões. Os de pedidos em andamento
 * filtram as colunas (tocar de novo tira o filtro); concluídos e cancelados levam à lista de
 * pedidos. Quatro por linha num contêiner a partir de 448 px, oito do largo em diante.
 */
export function MetricasFila({
  metricas,
  filtro,
  aoFiltrar,
}: {
  metricas: MetricasDaFila
  filtro: FiltroDaFila | null
  aoFiltrar: (filtro: FiltroDaFila | null) => void
}) {
  const filtros: { id: FiltroDaFila | null; rotulo: string; valor: number; tom?: string }[] = [
    { id: null, rotulo: "Em andamento", valor: metricas.emAndamento },
    {
      id: "atrasados",
      rotulo: "Atrasados",
      valor: metricas.atrasados,
      ...(metricas.atrasados > 0 ? { tom: "text-destructive dark:text-(--tom-cancelado)" } : {}),
    },
    {
      id: "aceite",
      rotulo: "Esperando aceite",
      valor: metricas.esperandoAceite,
      ...(metricas.esperandoAceite > 0 ? { tom: "text-(--tom-preparo-texto)" } : {}),
    },
    { id: "ultima-hora", rotulo: "Na última hora", valor: metricas.ultimaHora },
  ]
  const fatos: { rotulo: string; valor: number | null; href?: string; sufixo?: string }[] = [
    { rotulo: "Preparo médio", valor: metricas.preparoMedioMin, sufixo: " min" },
    { rotulo: "Até a entrega", valor: metricas.entregaMedioMin, sufixo: " min" },
    { rotulo: "Concluídos", valor: metricas.concluidos, href: "/admin/pedidos?status=concluido" },
    { rotulo: "Cancelados", valor: metricas.cancelados, href: "/admin/pedidos?status=cancelado" },
  ]

  const itens: ReactNode[] = [
    ...filtros.map(({ id, rotulo, valor, tom }) => {
      const escolhido = filtro === id
      return (
        <button
          key={rotulo}
          type="button"
          aria-pressed={escolhido}
          aria-label={comValor(rotulo, valor)}
          className={cn(FATO, TOCAVEL, escolhido && "bg-foreground/[0.04]")}
          // "Em andamento" mostra tudo; os outros alternam o próprio filtro.
          onClick={() => aoFiltrar(id === null || escolhido ? null : id)}
        >
          <Conteudo rotulo={rotulo} valor={valor} tom={tom} escolhido={escolhido} />
        </button>
      )
    }),
    ...fatos.map(({ rotulo, valor, href, sufixo }) =>
      href ? (
        <Link
          key={rotulo}
          href={href}
          aria-label={comValor(rotulo, valor)}
          className={cn(FATO, TOCAVEL)}
        >
          <Conteudo rotulo={rotulo} valor={valor} />
        </Link>
      ) : (
        <div key={rotulo} className={FATO}>
          <Conteudo rotulo={rotulo} valor={valor} lerValor {...(sufixo ? { sufixo } : {})} />
        </div>
      ),
    ),
  ]

  return (
    <section aria-label="Métricas de hoje" className="@container">
      <div className="flex flex-wrap overflow-hidden border-y border-border/70">{itens}</div>
    </section>
  )
}
