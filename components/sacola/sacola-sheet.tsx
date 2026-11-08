"use client"

import NumberFlow from "@number-flow/react"
import { CheckCircle2Icon, ShoppingBagIcon } from "lucide-react"
import { AnimatePresence, motion, useAnimationControls } from "motion/react"
import { useState } from "react"
import { toast } from "sonner"
import { Foto } from "@/components/foto"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { clienteAtual } from "@/lib/cliente"
import { emReais, formatoMoeda } from "@/lib/formato"
import { vibrar } from "@/lib/haptico"
import {
  calcularSubtotal,
  faltaParaMinimo,
  type ItemSacola,
  totalDoItem,
  useSacola,
} from "@/lib/sacola"
import { SeletorQuantidade } from "./seletor-quantidade"

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

  function removerComDesfazer() {
    remover(item.chave)
    const aviso = `${item.nome} saiu da sacola`
    aoAvisar(aviso)
    toast(aviso, {
      action: { label: "Desfazer", onClick: () => restaurar(item, posicao) },
    })
  }

  return (
    <motion.li
      layout="position"
      className="flex gap-3 py-3"
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <Foto src={item.imagem} alt="" sizes="56px" className="size-14 shrink-0 rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{item.nome}</p>
          {item.resumo.length > 0 && (
            <p className="text-sm text-muted-foreground">{item.resumo.join(" · ")}</p>
          )}
          {item.observacao && (
            <p className="text-sm text-muted-foreground">Observação: {item.observacao}</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <SeletorQuantidade
            tamanho="linha"
            nome={item.nome}
            valor={item.quantidade}
            aoMudar={(valor) => alterarQuantidade(item.chave, valor)}
            aoRemover={removerComDesfazer}
          />
          <span className="font-semibold tabular-nums">{emReais(totalDoItem(item))}</span>
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
  const itens = useSacola((estado) => estado.itens)
  const avisoMinimo = useAnimationControls()
  // Com um painel aberto, leitores de tela não alcançam o toast; o aviso é repetido aqui.
  const [avisoLeitor, setAvisoLeitor] = useState("")
  const subtotal = calcularSubtotal(itens)
  const { pedidoMinimo } = clienteAtual
  const falta = faltaParaMinimo(subtotal, pedidoMinimo)
  // A entrega depende do bairro e entra no total no checkout; aqui, só os itens.
  const total = subtotal

  function continuar() {
    if (falta > 0) {
      const aviso = `Faltam ${emReais(falta)} para o pedido mínimo`
      vibrar(20)
      void avisoMinimo.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.32 } })
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
        <Empty className="px-4 pb-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingBagIcon />
            </EmptyMedia>
            <EmptyTitle>Sua sacola está vazia</EmptyTitle>
            <EmptyDescription>Escolha algo do cardápio para começar.</EmptyDescription>
          </EmptyHeader>
          {botaoVazio}
        </Empty>
      ) : (
        <>
          <motion.div animate={avisoMinimo} className="px-4 pb-2" data-testid="pedido-minimo">
            {falta > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Faltam {emReais(falta)} para o pedido mínimo</p>
                <Progress
                  value={(subtotal / pedidoMinimo) * 100}
                  aria-label="Progresso até o pedido mínimo"
                />
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-medium text-sucesso">
                <CheckCircle2Icon className="size-4" aria-hidden="true" />
                Pedido mínimo atingido
              </p>
            )}
          </motion.div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <ul className="divide-y">
              <AnimatePresence initial={false} mode="popLayout">
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

          <div className="flex flex-col gap-3 border-t bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{emReais(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Entrega</dt>
                <dd className="text-muted-foreground">No próximo passo</dd>
              </div>
              <div className="mt-1 flex justify-between border-t pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">
                  <NumberFlow value={total} locales="pt-BR" format={formatoMoeda} />
                </dd>
              </div>
            </dl>
            <Button
              type="button"
              size="cta"
              className="w-full"
              onClick={continuar}
              data-testid="continuar"
            >
              Continuar
            </Button>
          </div>
        </>
      )}
    </>
  )
}
