"use client"

import NumberFlow from "@number-flow/react"
import { ChevronDownIcon, ClockIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useState } from "react"
import { Foto } from "@/components/foto"
import { emReais, formatoMoeda, plural } from "@/lib/formato"
import { useLoja } from "@/lib/loja-atual"
import { contarItens, type ItemSacola, totalDoItem } from "@/lib/sacola"
import { cn } from "@/lib/utils"

const CURVA = [0.23, 1, 0.32, 1] as const

export type ValoresResumo = {
  itens: ItemSacola[]
  subtotal: number
  /** `null` enquanto o bairro não foi escolhido. */
  taxa: number | null
  total: number
  retirada: boolean
}

function ListaItens({ itens }: { itens: ItemSacola[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {itens.map((item) => (
        <li key={item.chave} className="flex gap-3">
          <span className="relative shrink-0">
            <Foto src={item.imagem} alt="" sizes="48px" className="size-12 rounded-xl" />
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-bold text-background tabular-nums">
              {item.quantidade}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug font-semibold">{item.nome}</p>
            {item.resumo.length > 0 && (
              <p className="text-xs text-muted-foreground">{item.resumo.join(" · ")}</p>
            )}
            {item.observacao && (
              <p className="text-xs text-muted-foreground">Obs.: {item.observacao}</p>
            )}
          </div>
          <span className="text-sm font-semibold tabular-nums">{emReais(totalDoItem(item))}</span>
        </li>
      ))}
    </ul>
  )
}

function Totais({ subtotal, taxa, total, retirada }: Omit<ValoresResumo, "itens">) {
  return (
    <dl className="flex flex-col gap-1.5 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="tabular-nums">{emReais(subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">{retirada ? "Retirada" : "Entrega"}</dt>
        <dd className="tabular-nums">
          {retirada ? (
            <span className="font-medium text-sucesso">Grátis</span>
          ) : taxa === null ? (
            <span className="text-muted-foreground">Escolha o bairro</span>
          ) : (
            <NumberFlow value={taxa} locales="pt-BR" format={formatoMoeda} />
          )}
        </dd>
      </div>
      <div className="mt-1 flex items-baseline justify-between border-t pt-3 text-base font-bold">
        <dt>Total</dt>
        <dd className="text-xl tabular-nums" data-testid="total-resumo">
          <NumberFlow value={total} locales="pt-BR" format={formatoMoeda} aria-hidden="true" />
          <span className="sr-only">{emReais(total)}</span>
        </dd>
      </div>
    </dl>
  )
}

/** No computador: o pedido sempre à vista ao lado dos passos. */
export function ResumoLateral(valores: ValoresResumo) {
  const lojaEscolhida = useLoja()
  const quantidade = contarItens(valores.itens)

  return (
    <aside
      aria-labelledby="titulo-resumo"
      className="sombra-flutuante sticky top-24 hidden flex-col gap-4 self-start rounded-3xl bg-card p-5 lg:flex"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="titulo-resumo" className="text-xl font-bold">
          Seu pedido
        </h2>
        <Link
          href="/"
          className="-my-2 flex min-h-11 items-center text-sm font-semibold text-marca-texto underline underline-offset-4"
        >
          Alterar itens
        </Link>
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">{plural(quantidade, "item", "itens")}</p>
      <div className="-mt-2 max-h-[38dvh] overflow-y-auto pt-2 pr-2">
        <ListaItens itens={valores.itens} />
      </div>
      <Totais {...valores} />
      <p className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
        <ClockIcon className="size-4 shrink-0" aria-hidden="true" />
        {valores.retirada
          ? `Fica pronto em ${lojaEscolhida.retirada.tempo}`
          : `Chega em ${lojaEscolhida.entrega.tempo}`}
      </p>
    </aside>
  )
}

/** No celular e no tablet: uma linha que abre a lista de itens e os valores. */
export function ResumoCompacto(valores: ValoresResumo) {
  const [aberto, setAberto] = useState(false)
  const quantidade = contarItens(valores.itens)

  return (
    <section className="overflow-hidden rounded-2xl border bg-card lg:hidden">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls="resumo-compacto"
        onClick={() => setAberto((atual) => !atual)}
        className="flex min-h-14 w-full items-center gap-3 px-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex -space-x-2.5" aria-hidden="true">
          {valores.itens.slice(0, 3).map((item) => (
            <Foto
              key={item.chave}
              src={item.imagem}
              alt=""
              sizes="32px"
              className="size-8 rounded-full ring-2 ring-card"
            />
          ))}
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold">
          {aberto ? "Esconder itens" : `Ver ${plural(quantidade, "item", "itens")}`}
        </span>
        <span className="text-base font-bold tabular-nums">
          <NumberFlow value={valores.total} locales="pt-BR" format={formatoMoeda} />
        </span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: aberto ? 180 : 0 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
        >
          <ChevronDownIcon className="size-5 text-muted-foreground" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            id="resumo-compacto"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: CURVA }}
          >
            <div className={cn("flex flex-col gap-4 border-t px-4 pt-4 pb-4")}>
              <ListaItens itens={valores.itens} />
              <Totais {...valores} />
              <Link
                href="/"
                className="-my-2 flex min-h-11 w-fit items-center text-sm font-semibold text-marca-texto underline underline-offset-4"
              >
                Alterar itens
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
