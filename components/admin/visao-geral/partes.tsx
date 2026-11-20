"use client"

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"
import Link from "next/link"
import { type ReactNode, useId } from "react"
import { Progress } from "@/components/ui/progress"
import { emReais, plural } from "@/lib/formato"
import { cn } from "@/lib/utils"

const porcentagem = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})

/** Seção com título que vira região para leitores de tela. */
export function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em]">
          {titulo}
        </h2>
        {descricao && <p className="text-[13px] text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </section>
  )
}

export function ListaDeFatias({
  itens,
  vazio,
}: {
  itens: {
    chave: string
    nome: string
    pedidos: number
    total: number
    percentual: number
    /** Leva para os pedidos daquela fatia. */
    href?: string
    /** Troca a contagem de pedidos por outro texto (ex.: "4 un."). */
    detalhe?: string
  }[]
  vazio: string
}) {
  if (itens.length === 0) return <p className="text-sm text-muted-foreground">{vazio}</p>
  return (
    <ul className="barras-do-grafico flex flex-col gap-3">
      {itens.map((item) => (
        <li key={item.chave} className="flex flex-col gap-1.5">
          <div className="flex items-start gap-3 text-sm">
            {/* No celular, a contagem desce para baixo do nome. */}
            <span className="flex min-w-0 flex-1 flex-col gap-x-2 sm:flex-row sm:items-baseline">
              {item.href ? (
                <Link
                  href={item.href}
                  className="truncate font-medium underline-offset-4 hover:underline"
                >
                  {item.nome}
                </Link>
              ) : (
                <span className="truncate font-medium">{item.nome}</span>
              )}
              <span className="text-xs text-muted-foreground sm:text-sm">
                {item.detalhe ?? plural(item.pedidos, "pedido", "pedidos")}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{emReais(item.total)}</span>
            <span className="w-9 shrink-0 text-right text-muted-foreground tabular-nums">
              {Math.round(item.percentual)}%
            </span>
          </div>
          <Progress
            className="h-1.5"
            value={item.percentual}
            aria-label={`${item.nome}: ${Math.round(item.percentual)}%`}
          />
        </li>
      ))}
    </ul>
  )
}

/** Variação em %, verde para cima e vermelha para baixo, com a seta e o "sobre o quê". */
export function Variacao({ valor, texto }: { valor: number; texto: string }) {
  const Seta = valor >= 0 ? TrendingUpIcon : TrendingDownIcon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        valor >= 0 ? "text-(--tom-pronto)" : "text-(--tom-cancelado)",
      )}
    >
      <Seta className="size-3.5" aria-hidden="true" />
      {porcentagem.format(valor / 100)} {texto}
    </span>
  )
}
