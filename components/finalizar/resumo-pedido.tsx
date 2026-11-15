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
import { CURVA_TELA } from "./movimento"

export type ValoresResumo = {
  itens: ItemSacola[]
  subtotal: number
  /** `null` enquanto o bairro não foi escolhido. */
  taxa: number | null
  total: number
  retirada: boolean
}

const LINK =
  "flex min-h-11 items-center text-sm font-medium text-marca-texto underline decoration-marca-texto/40 underline-offset-4 hover:decoration-marca-texto"

/** Preço na língua da etiqueta da vitrine: o traço da cor da loja e o número tabular. */
function Preco({ valor }: { valor: number }) {
  return (
    <span className="flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums">
      <span aria-hidden="true" className="h-3.5 w-[3px] rounded-full bg-primary" />
      {emReais(valor)}
    </span>
  )
}

function ListaItens({ itens }: { itens: ItemSacola[] }) {
  return (
    <ul className="flex flex-col gap-3.5">
      {itens.map((item) => (
        <li key={item.chave} className="flex items-start gap-3">
          <Foto src={item.imagem} alt="" sizes="44px" className="size-11 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug font-medium">
              <span className="text-muted-foreground tabular-nums">{item.quantidade}× </span>
              {item.nome}
            </p>
            {item.resumo.length > 0 && (
              <p className="text-[13px] leading-snug text-muted-foreground">
                {item.resumo.join(" · ")}
              </p>
            )}
            {item.observacao && (
              <p className="text-[13px] leading-snug text-muted-foreground">
                Obs.: {item.observacao}
              </p>
            )}
          </div>
          <Preco valor={totalDoItem(item)} />
        </li>
      ))}
    </ul>
  )
}

function Totais({ subtotal, taxa, total, retirada }: Omit<ValoresResumo, "itens">) {
  return (
    <dl className="flex flex-col gap-1.5 text-sm tabular-nums">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd>{emReais(subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">{retirada ? "Retirada" : "Entrega"}</dt>
        <dd>
          {retirada ? (
            <span className="font-medium text-sucesso">Grátis</span>
          ) : taxa === null ? (
            <span className="text-muted-foreground">Escolha o bairro</span>
          ) : (
            <NumberFlow value={taxa} locales="pt-BR" format={formatoMoeda} />
          )}
        </dd>
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t border-border/70 pt-3">
        <dt className="text-base font-semibold tracking-[-0.01em]">Total</dt>
        <dd
          className="text-xl font-semibold tracking-[-0.02em] tabular-nums"
          data-testid="total-resumo"
        >
          <NumberFlow value={total} locales="pt-BR" format={formatoMoeda} aria-hidden="true" />
          <span className="sr-only">{emReais(total)}</span>
        </dd>
      </div>
    </dl>
  )
}

/** No computador: o pedido sempre à vista ao lado dos passos, separado só por um fio. */
export function ResumoLateral(valores: ValoresResumo) {
  const lojaEscolhida = useLoja()
  const quantidade = contarItens(valores.itens)

  return (
    <aside
      aria-labelledby="titulo-resumo"
      className="sticky top-24 hidden flex-col gap-5 self-start border-l border-border/70 pl-8 lg:flex"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 id="titulo-resumo" className="text-lg font-semibold tracking-[-0.015em]">
            Seu pedido
          </h2>
          <p className="text-[13px] text-muted-foreground">{plural(quantidade, "item", "itens")}</p>
        </div>
        <Link href="/" className={`-my-2 ${LINK}`}>
          Alterar itens
        </Link>
      </div>
      <div className="-mr-2 max-h-[40dvh] overflow-y-auto border-t border-border/70 pt-4 pr-2">
        <ListaItens itens={valores.itens} />
      </div>
      <div className="border-t border-border/70 pt-4">
        <Totais {...valores} />
      </div>
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <ClockIcon className="size-4 shrink-0" aria-hidden="true" />
        {lojaEscolhida.aceitaEntrega === false
          ? "Atendimento no salão, no horário marcado"
          : valores.retirada
            ? `Fica pronto em ${lojaEscolhida.retirada.tempo}`
            : `Chega em ${lojaEscolhida.entrega.tempo}`}
      </p>
    </aside>
  )
}

/** No celular e no tablet: uma linha entre fios que abre a lista de itens e os valores. */
export function ResumoCompacto(valores: ValoresResumo) {
  const [aberto, setAberto] = useState(false)
  const quantidade = contarItens(valores.itens)

  return (
    <section className="border-y border-border/70 lg:hidden">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls="resumo-compacto"
        onClick={() => setAberto((atual) => !atual)}
        className="flex min-h-14 w-full items-center gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex -space-x-2" aria-hidden="true">
          {valores.itens.slice(0, 3).map((item) => (
            <Foto
              key={item.chave}
              src={item.imagem}
              alt=""
              sizes="28px"
              className="size-7 rounded-md ring-2 ring-background"
            />
          ))}
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium">
          {aberto ? "Esconder itens" : `Ver ${plural(quantidade, "item", "itens")}`}
        </span>
        <span className="text-[15px] font-semibold tabular-nums">
          <NumberFlow value={valores.total} locales="pt-BR" format={formatoMoeda} />
        </span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: aberto ? 180 : 0 }}
          transition={{ duration: 0.24, ease: CURVA_TELA }}
        >
          <ChevronDownIcon className="size-5 text-muted-foreground" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            id="resumo-compacto"
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.2, ease: CURVA_TELA } }}
            transition={{ duration: 0.3, ease: CURVA_TELA }}
          >
            <div className="flex flex-col gap-4 border-t border-border/70 pt-4 pb-3">
              <ListaItens itens={valores.itens} />
              <div className="border-t border-border/70 pt-3">
                <Totais {...valores} />
              </div>
              <Link href="/" className={`-my-1 w-fit ${LINK}`}>
                Alterar itens
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
