"use client"

import NumberFlow from "@number-flow/react"
import { MinusIcon, PlusIcon, StoreIcon, Trash2Icon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { type MouseEvent, useState } from "react"
import { toast } from "sonner"
import { Dica } from "@/components/dica"
import { comoVender } from "@/lib/farmacia"
import { emReais } from "@/lib/formato"
import { vibrar } from "@/lib/haptico"
import { montarItemSacola } from "@/lib/produto"
import { useSacola } from "@/lib/sacola"
import type { Produto } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { lancarParaSacola } from "@/lib/voo"

const MOLA = { type: "spring", duration: 0.42, bounce: 0.22 } as const
const TOQUE = { type: "spring", duration: 0.22, bounce: 0.5 } as const
const SURGIR = {
  initial: { opacity: 0, scale: 0.85, filter: "blur(2px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.85, filter: "blur(2px)", transition: { duration: 0.12 } },
  whileTap: { scale: 0.92 },
  transition: TOQUE,
} as const

const ESTILO_BOTAO =
  "relative flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring"

/** Quantas unidades deste produto já estão na sacola, somando todas as montagens. */
export function useQuantidadeNaSacola(produtoId: string) {
  return useSacola((estado) =>
    estado.hidratada
      ? estado.itens.reduce(
          (soma, item) => (item.produtoId === produtoId ? soma + item.quantidade : soma),
          0,
        )
      : 0,
  )
}

type BotaoAdicionarProps = {
  produto: Produto
  aoAbrir: () => void
  /** Dentro de um cartão: sem sombra flutuante e com fundo suave, para não brigar com o cartão. */
  embutido?: boolean
  className?: string
}

/**
 * O "+" cresce até virar o seletor completo: excluir à esquerda, diminuir, quantidade e aumentar.
 * - Sem opções, o "+" adiciona na hora.
 * - Com opções, o primeiro "+" abre o produto para montar; depois, repete a última montagem.
 * - Excluir tira tudo deste produto de uma vez, com "Desfazer" no aviso.
 */
export function BotaoAdicionar({
  produto,
  aoAbrir,
  embutido = false,
  className,
}: BotaoAdicionarProps) {
  const adicionar = useSacola((estado) => estado.adicionar)
  const alterarQuantidade = useSacola((estado) => estado.alterarQuantidade)
  const remover = useSacola((estado) => estado.remover)
  const restaurar = useSacola((estado) => estado.restaurar)
  const hidratada = useSacola((estado) => estado.hidratada)
  const itens = useSacola((estado) => estado.itens)
  // O anel só existe durante a animação: ampliado e invisível, ele alargaria a página.
  const [pulso, setPulso] = useState<number | null>(null)

  // Corte por quilo: o "+" abre a ficha para escolher o peso, como um produto com opções.
  const porQuilo = produto.unidade === "kg"
  const temOpcoes = Boolean(produto.grupos?.length) || porQuilo
  const doProduto = hidratada ? itens.filter((item) => item.produtoId === produto.id) : []
  const quantidade = doProduto.reduce((soma, item) => soma + item.quantidade, 0)
  // Diminuir e repetir mexem na montagem mais recente, que é a que a pessoa acabou de ver.
  const ultimo = doProduto.at(-1)
  const ativo = quantidade > 0

  function aoPressionarMais(evento: MouseEvent<HTMLButtonElement>) {
    vibrar()
    if (temOpcoes && !ultimo) {
      aoAbrir()
      return
    }
    // O que desliza até a sacola sai da etiqueta do produto, quando há uma à vista.
    const etiqueta =
      evento.currentTarget
        .closest("article")
        ?.querySelector<HTMLElement>(`[data-testid="etiqueta-${produto.id}"]`) ??
      evento.currentTarget
    lancarParaSacola(
      etiqueta,
      produto.imagem,
      emReais(ultimo ? ultimo.precoUnitario : produto.preco),
    )
    setPulso(Date.now())
    if (temOpcoes && ultimo) {
      alterarQuantidade(ultimo.chave, ultimo.quantidade + 1)
      return
    }
    adicionar(montarItemSacola(produto, [], 1, ""))
  }

  // Controlado (Portaria 344): não tem venda à distância. O botão abre o produto, que explica.
  if (produto.medicamento && comoVender(produto.medicamento) === "so-balcao") {
    return (
      <button
        type="button"
        onClick={aoAbrir}
        aria-label={`${produto.nome}: só no balcão`}
        className={cn(
          "z-10 flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-muted px-3.5 text-sm font-semibold text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring",
          className,
        )}
      >
        <StoreIcon className="size-4" aria-hidden="true" />
        Só no balcão
      </button>
    )
  }

  function aoPressionarMenos() {
    if (!ultimo) return
    vibrar()
    if (ultimo.quantidade <= 1) remover(ultimo.chave)
    else alterarQuantidade(ultimo.chave, ultimo.quantidade - 1)
  }

  function excluirTudo() {
    vibrar(20)
    // Guarda as posições para o "Desfazer" devolver tudo exatamente onde estava.
    const removidos = itens.flatMap((item, posicao) =>
      item.produtoId === produto.id ? [{ item, posicao }] : [],
    )
    for (const { item } of removidos) remover(item.chave)
    toast(`${produto.nome} saiu da sacola`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          for (const { item, posicao } of removidos) restaurar(item, posicao)
        },
      },
    })
  }

  return (
    <motion.div
      layout
      transition={MOLA}
      style={{ borderRadius: 22 }}
      className={cn(
        "group/botao z-10 flex h-11 items-center transition-colors duration-200",
        embutido ? "relative shadow-none" : "shadow-lg shadow-black/25",
        ativo
          ? "bg-primary text-primary-foreground"
          : embutido
            ? "bg-accent text-marca-texto hover:bg-primary hover:text-primary-foreground"
            : "bg-card text-marca-texto hover:bg-primary hover:text-primary-foreground",
        className,
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {ativo && (
          <motion.button
            key="excluir"
            type="button"
            className={ESTILO_BOTAO}
            onClick={excluirTudo}
            aria-label={`Remover ${produto.nome}`}
            {...SURGIR}
          >
            <Trash2Icon className="size-4" />
          </motion.button>
        )}
        {quantidade > 1 && (
          <motion.button
            key="menos"
            type="button"
            className={ESTILO_BOTAO}
            onClick={aoPressionarMenos}
            aria-label={`Diminuir quantidade de ${produto.nome}`}
            {...SURGIR}
          >
            <MinusIcon />
          </motion.button>
        )}
        {ativo && (
          <motion.span
            key="quantidade"
            data-testid={`quantidade-${produto.id}`}
            aria-label={`${quantidade} na sacola`}
            className="flex min-w-5 items-center justify-center text-sm font-bold tabular-nums"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <NumberFlow value={quantidade} />
          </motion.span>
        )}
      </AnimatePresence>

      <Dica texto={temOpcoes && !ultimo ? "Escolher opções" : ativo ? "Mais um" : "Adicionar"}>
        <motion.button
          layout="position"
          type="button"
          className={ESTILO_BOTAO}
          onClick={aoPressionarMais}
          data-testid={`adicionar-${produto.id}`}
          aria-label={
            porQuilo && !ultimo
              ? `Escolher o peso de ${produto.nome}`
              : temOpcoes && !ultimo
                ? `Escolher opções de ${produto.nome}`
                : ativo
                  ? `Aumentar quantidade de ${produto.nome}`
                  : `Adicionar ${produto.nome}`
          }
          whileTap={{ scale: 0.92 }}
          transition={TOQUE}
        >
          {pulso !== null && (
            <motion.span
              key={pulso}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary-foreground"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 1.7, opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              onAnimationComplete={() => setPulso(null)}
            />
          )}
          <PlusIcon strokeWidth={2.5} className="size-5" />
        </motion.button>
      </Dica>
    </motion.div>
  )
}
