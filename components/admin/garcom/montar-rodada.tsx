"use client"

import NumberFlow from "@number-flow/react"
import { ChefHatIcon, MinusIcon, PlusIcon, SendIcon, Trash2Icon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { Mesa, Produto } from "@/lib/admin/dados/tipos"
import {
  adicionarItem,
  type Escolhas,
  type ItemVenda,
  precoDeBalcao,
  totaisDaVenda,
} from "@/lib/admin/regras/pdv"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { emReais, formatoMoeda, plural } from "@/lib/formato"
import { type AvisoCaixa, linhaQueMudou } from "../pdv/caixa-pdv"
import { JanelaOpcoes } from "../pdv/janela-opcoes"

/** Item da bandeja: o que a tela mostra e as escolhas que vão para o servidor. */
export type ItemBandeja = Omit<ItemVenda, "chave"> & { escolhas: Escolhas }

/** A rodada em montagem: itens, quantidades, total e os dois jeitos de lançar. */
export function Bandeja({
  itens,
  mesa,
  enviando,
  aviso,
  mudarQuantidade,
  remover,
  aoLancar,
}: {
  itens: (ItemBandeja & { chave: string })[]
  mesa: Mesa | null
  enviando: boolean
  aviso: AvisoCaixa | null
  mudarQuantidade: (chave: string, quantidade: number) => void
  remover: (chave: string) => void
  aoLancar: (enviarParaCozinha: boolean) => void
}) {
  const semMovimento = useReducedMotion()
  const { quantidade, total } = totaisDaVenda(itens, { modo: "reais", valor: 0 })
  const bloqueado = !mesa || itens.length === 0 || enviando
  return (
    <section aria-label="Bandeja" className="flex flex-col gap-4">
      <h2 className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold">
        Rodada nova
        {mesa && <span>· Mesa {mesa.numero}</span>}
        {quantidade > 0 && (
          <span className="text-[13px] font-medium text-muted-foreground tabular-nums">
            {plural(quantidade, "item", "itens")}
          </span>
        )}
      </h2>

      {/* O que o último toque fez, para quem usa leitor de tela. */}
      <p role="status" className="sr-only">
        {aviso?.texto}
      </p>

      {itens.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-7 text-center text-[13px] text-balance text-muted-foreground">
          Toque nos produtos para montar a rodada.
        </p>
      ) : (
        <ul
          aria-label="Itens da bandeja"
          className="-mt-1 flex flex-col divide-y divide-border/70 border-b border-border/70"
        >
          <AnimatePresence initial={false}>
            {itens.map((item) => (
              <motion.li
                key={item.chave}
                aria-label={item.nome}
                layout={semMovimento ? false : "position"}
                initial={semMovimento ? { opacity: 0 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="relative flex items-start gap-2 py-2.5"
              >
                {/* Realce do toque: a linha que acabou de mudar acende e apaga sozinha. */}
                {aviso?.chave === item.chave && (
                  <motion.span
                    key={aviso.vez}
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-x-2 inset-y-0 rounded-lg bg-foreground"
                    initial={{ opacity: 0.07 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col text-sm">
                  <span className="font-medium">{item.nome}</span>
                  {item.opcoes.length > 0 && (
                    <span className="text-xs text-muted-foreground">{item.opcoes.join(" · ")}</span>
                  )}
                  {item.observacao && <span className="text-xs italic">“{item.observacao}”</span>}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {emReais(item.precoUnitario * item.quantidade)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="max-md:size-10"
                    aria-label="Menos um"
                    onClick={() =>
                      item.quantidade <= 1
                        ? remover(item.chave)
                        : mudarQuantidade(item.chave, item.quantidade - 1)
                    }
                  >
                    {item.quantidade <= 1 ? <Trash2Icon /> : <MinusIcon />}
                  </Button>
                  <span className="w-6 text-center text-sm font-medium tabular-nums">
                    {item.quantidade}
                  </span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="max-md:size-10"
                    aria-label="Mais um"
                    onClick={() => mudarQuantidade(item.chave, item.quantidade + 1)}
                  >
                    <PlusIcon />
                  </Button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Total da rodada</span>
        <NumberFlow
          value={total}
          locales="pt-BR"
          format={formatoMoeda}
          className="text-[22px] leading-none font-semibold tracking-[-0.02em] tabular-nums"
        />
      </div>
      {!mesa && <p className="-mt-2 text-sm text-muted-foreground">Escolha a mesa.</p>}
      {/* A ação mais comum por cima, inteira; a de bebida pronta logo abaixo. */}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="lg"
          className="h-11 text-[15px]"
          disabled={bloqueado}
          onClick={() => aoLancar(true)}
        >
          <ChefHatIcon data-icon="inline-start" />
          Enviar para a cozinha
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11"
          disabled={bloqueado}
          onClick={() => aoLancar(false)}
        >
          <SendIcon data-icon="inline-start" />
          Lançar na mesa
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        “Lançar na mesa” é para o que sai pronto, como bebidas; o preço é conferido pelo sistema.
      </p>
    </section>
  )
}

/**
 * A rodada que o Garçom e a comanda montam com o catálogo do balcão: inclui (com aviso para o
 * leitor de tela), abre a janela de opções e devolve os itens no formato do lançamento.
 */
export function useRodada() {
  const segmento = useSegmentoAtual((estado) => estado.segmento)
  const [itens, setItens] = useState<(ItemBandeja & { chave: string })[]>([])
  const [aviso, setAviso] = useState<AvisoCaixa | null>(null)
  const [comOpcoes, setComOpcoes] = useState<Produto | null>(null)

  const incluir = (item: ItemBandeja) => {
    const novos = adicionarItem<ItemBandeja & { chave: string }>(itens, item)
    setItens(novos)
    // A linha que entrou ou cresceu: acende na bandeja e é anunciada.
    const linha = linhaQueMudou(itens, novos)
    if (linha) {
      setAviso((atual) => ({
        chave: linha.chave,
        texto: `${linha.nome}: ${linha.quantidade} na bandeja`,
        vez: (atual?.vez ?? 0) + 1,
      }))
    }
  }

  return {
    itens,
    aviso,
    tocarProduto(produto: Produto) {
      if (produto.grupos.some((grupo) => grupo.ativo)) return setComOpcoes(produto)
      incluir({
        produtoId: produto.id,
        nome: produto.nome,
        quantidade: 1,
        precoUnitario: precoDeBalcao(produto, segmento),
        opcoes: [],
        escolhas: {},
      })
    },
    quantidadeNa: (produtoId: string) =>
      itens
        .filter((item) => item.produtoId === produtoId)
        .reduce((soma, item) => soma + item.quantidade, 0),
    mudarQuantidade: (chave: string, quantidade: number) =>
      setItens((atuais) =>
        atuais.map((item) => (item.chave === chave ? { ...item, quantidade } : item)),
      ),
    remover: (chave: string) => setItens((atuais) => atuais.filter((item) => item.chave !== chave)),
    limpar() {
      setItens([])
      setAviso(null)
    },
    /** Os itens no formato do lançamento: o preço sai do servidor. */
    lancados: () =>
      itens.map((item) => ({
        produtoId: item.produtoId as string,
        escolhas: item.escolhas,
        quantidade: item.quantidade,
        ...(item.observacao ? { observacao: item.observacao } : {}),
      })),
    /** A janela de opções do produto tocado, quando ele tem opções. */
    janela: comOpcoes && (
      <JanelaOpcoes
        key={comOpcoes.id}
        produto={comOpcoes}
        precoBase={precoDeBalcao(comOpcoes, segmento)}
        aoFechar={() => setComOpcoes(null)}
        aoAdicionar={(item, escolhas) => {
          incluir({ ...item, escolhas })
          setComOpcoes(null)
        }}
      />
    ),
  }
}
