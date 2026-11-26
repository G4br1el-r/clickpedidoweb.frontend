"use client"

import NumberFlow from "@number-flow/react"
import { ArrowRightIcon, CheckIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react"
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react"
import { useState } from "react"
import { toast } from "sonner"
import { Foto } from "@/components/foto"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { emReais, formatoMoeda } from "@/lib/formato"
import { vibrar } from "@/lib/haptico"
import { useLoja } from "@/lib/loja-atual"
import {
  calcularSubtotal,
  faltaParaMinimo,
  type ItemSacola,
  totalDoItem,
  useSacola,
} from "@/lib/sacola"
import { SeletorQuantidade } from "./seletor-quantidade"

/** Curva de algo que se mexe na tela (a linha fechando). */
const CURVA_TELA = [0.77, 0, 0.175, 1] as const

/**
 * Preço da linha na língua da etiqueta da vitrine: o traço da cor da loja e o número
 * tabular. Com mais de uma unidade, o preço de cada uma vem logo acima, em tom suave.
 */
function PrecoLinha({ item }: { item: ItemSacola }) {
  return (
    <p className="flex shrink-0 flex-col items-end gap-0.5 leading-tight tabular-nums">
      {item.quantidade > 1 && (
        <span className="text-[13px] text-muted-foreground">
          {item.quantidade} × {emReais(item.precoUnitario)}
        </span>
      )}
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="h-3.5 w-[3px] shrink-0 rounded-full bg-primary" />
        <NumberFlow
          value={totalDoItem(item)}
          locales="pt-BR"
          format={formatoMoeda}
          className="text-[15px] font-semibold tracking-[-0.01em]"
        />
      </span>
    </p>
  )
}

function LinhaSacola({
  item,
  posicao,
  aoAvisar,
}: {
  item: ItemSacola
  posicao: number
  aoAvisar: (aviso: string) => void
}) {
  const alterarQuantidade = useSacola((estado) => estado.alterarQuantidade)
  const remover = useSacola((estado) => estado.remover)
  const restaurar = useSacola((estado) => estado.restaurar)
  const reduzido = useReducedMotion()

  function removerComDesfazer() {
    remover(item.chave)
    const aviso = `${item.nome} saiu da sacola`
    aoAvisar(aviso)
    toast(aviso, {
      action: { label: "Desfazer", onClick: () => restaurar(item, posicao) },
    })
  }

  return (
    // Ao sair, a linha some depressa e fecha o espaço; as de baixo sobem junto, sem salto.
    <motion.li
      className="overflow-hidden"
      initial={reduzido ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={
        reduzido
          ? { opacity: 0, transition: { duration: 0.12 } }
          : {
              opacity: 0,
              height: 0,
              transition: {
                opacity: { duration: 0.1 },
                height: { duration: 0.22, ease: CURVA_TELA },
              },
            }
      }
      transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="flex gap-3 py-3.5">
        <Foto src={item.imagem} alt="" sizes="56px" className="size-14 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="min-w-0">
            <p className="text-[15px] leading-snug font-medium tracking-[-0.01em] wrap-anywhere">
              {item.nome}
            </p>
            {item.resumo.length > 0 && (
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                {item.resumo.join(" · ")}
              </p>
            )}
            {item.observacao && (
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                Observação: {item.observacao}
              </p>
            )}
          </div>
          <div className="flex items-end justify-between gap-3">
            <SeletorQuantidade
              tamanho="linha"
              nome={item.nome}
              valor={item.quantidade}
              aoMudar={(valor) => alterarQuantidade(item.chave, valor)}
              aoRemover={removerComDesfazer}
            />
            <PrecoLinha item={item} />
          </div>
        </div>
      </div>
    </motion.li>
  )
}

/** Itens, pedido mínimo e totais da sacola; usado dentro da ilha da sacola. */
export function ConteudoSacola({
  aoContinuar,
  botaoVazio,
}: {
  aoContinuar: () => void
  botaoVazio?: React.ReactNode
}) {
  const lojaEscolhida = useLoja()
  const itens = useSacola((estado) => estado.itens)
  const esvaziar = useSacola((estado) => estado.esvaziar)
  const restaurarItens = useSacola((estado) => estado.restaurarItens)
  const avisoMinimo = useAnimationControls()
  const reduzido = useReducedMotion()
  // Com um painel aberto, leitores de tela não alcançam o toast; o aviso é repetido aqui.
  const [avisoLeitor, setAvisoLeitor] = useState("")
  const subtotal = calcularSubtotal(itens)
  const { pedidoMinimo } = lojaEscolhida
  const falta = faltaParaMinimo(subtotal, pedidoMinimo)
  // A entrega depende do bairro e entra no total no checkout; aqui, só os itens.
  const total = subtotal

  function esvaziarComDesfazer() {
    const anteriores = itens
    esvaziar()
    const aviso = "Sacola esvaziada"
    setAvisoLeitor(aviso)
    toast(aviso, { action: { label: "Desfazer", onClick: () => restaurarItens(anteriores) } })
  }

  function continuar() {
    if (falta > 0) {
      const aviso = `Faltam ${emReais(falta)} para o pedido mínimo`
      vibrar(20)
      // Um empurrão curto no aviso do mínimo, sem tremer a sacola inteira.
      void avisoMinimo.start(
        reduzido
          ? { opacity: [1, 0.4, 1], transition: { duration: 0.3 } }
          : { x: [0, -4, 4, -2, 0], transition: { duration: 0.28, ease: "easeOut" } },
      )
      setAvisoLeitor(aviso)
      toast.warning(aviso)
      return
    }
    vibrar()
    aoContinuar()
  }

  return (
    <>
      <span className="sr-only" aria-live="assertive">
        {avisoLeitor}
      </span>
      {itens.length === 0 ? (
        <Empty className="gap-5 px-5 pt-6 pb-8">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-11 rounded-full [&_svg]:size-5">
              <ShoppingBagIcon />
            </EmptyMedia>
            <EmptyTitle className="text-base font-semibold tracking-[-0.01em]">
              Sua sacola está vazia
            </EmptyTitle>
            <EmptyDescription>Escolha algo do cardápio para começar.</EmptyDescription>
          </EmptyHeader>
          {botaoVazio}
        </Empty>
      ) : (
        <>
          <motion.div animate={avisoMinimo} className="px-5 pt-1 pb-3" data-testid="pedido-minimo">
            {falta > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium tabular-nums">
                  Faltam {emReais(falta)} para o pedido mínimo
                </p>
                <Progress
                  value={Math.min(100, (subtotal / pedidoMinimo) * 100)}
                  aria-label="Progresso até o pedido mínimo"
                  className="[&_[data-slot=progress-indicator]]:duration-500 [&_[data-slot=progress-indicator]]:ease-saida"
                />
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-medium text-sucesso">
                <CheckIcon className="size-4" strokeWidth={2.5} aria-hidden="true" />
                Pedido mínimo atingido
              </p>
            )}
          </motion.div>

          {/* Com vários itens, esvazia de uma vez (com desfazer); com um só, ele já sai com um toque. */}
          {itens.length > 1 && (
            <div className="flex items-center justify-end border-t border-border/70 px-5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-mr-2.5 text-muted-foreground pointer-coarse:h-11"
                onClick={esvaziarComDesfazer}
              >
                <Trash2Icon data-icon="inline-start" />
                Esvaziar sacola
              </Button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/70 px-5">
            <ul className="divide-y divide-border/70">
              <AnimatePresence initial={false}>
                {itens.map((item, posicao) => (
                  <LinhaSacola
                    key={item.chave}
                    item={item}
                    posicao={posicao}
                    aoAvisar={setAvisoLeitor}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </div>

          <div className="flex flex-col gap-3.5 border-t border-border/70 px-5 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <dl className="flex flex-col gap-1 text-sm tabular-nums">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{emReais(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Entrega</dt>
                <dd className="text-muted-foreground">No próximo passo</dd>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <dt className="text-base font-semibold tracking-[-0.01em]">Total</dt>
                <dd className="text-lg font-semibold tracking-[-0.015em]">
                  <NumberFlow value={total} locales="pt-BR" format={formatoMoeda} />
                </dd>
              </div>
            </dl>
            <Button
              type="button"
              size="cta"
              className="w-full justify-between"
              onClick={continuar}
              data-testid="continuar"
            >
              Continuar
              <ArrowRightIcon className="size-5" aria-hidden="true" />
            </Button>
          </div>
        </>
      )}
    </>
  )
}
