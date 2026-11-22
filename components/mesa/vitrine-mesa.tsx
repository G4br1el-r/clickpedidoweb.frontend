"use client"

import { BellRingIcon, MinusIcon, PlusIcon, ReceiptTextIcon, Trash2Icon } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRodada } from "@/components/admin/garcom/montar-rodada"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useAoVivo } from "@/lib/admin/dados/consultas"
import { useChamarNaMesa, useMesaQr, usePedirNaMesa } from "@/lib/admin/dados/consultas-qr"
import type { MesaQr } from "@/lib/admin/dados/servidor"
import { resumoDaConta } from "@/lib/admin/regras/conta"
import { precoDeBalcao } from "@/lib/admin/regras/pdv"
import { ehSegmentoPainel, type SegmentoPainelId } from "@/lib/admin/segmentos-painel"
import { emReais, plural } from "@/lib/formato"
import { ehLojaId, LOJAS, useLojaAtual } from "@/lib/loja-atual"

function Indisponivel() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-2 px-4 text-center">
      <h1 className="text-xl font-semibold">Mesa indisponível.</h1>
      <p className="text-sm text-muted-foreground">Chame o garçom para fazer o pedido.</p>
    </main>
  )
}

/** A conta da comanda, como a pré-conta: itens, taxa, couvert, o pago e o que falta. */
function ContaDaMesa({
  dados,
  aberta,
  aoMudar,
}: {
  dados: MesaQr
  aberta: boolean
  aoMudar: (aberta: boolean) => void
}) {
  const { comanda } = dados
  const resumo = comanda ? resumoDaConta(comanda) : null
  const linhas: [string, number][] = resumo
    ? [
        ["Itens", resumo.itens],
        ...(resumo.taxa > 0 ? [["Taxa de serviço", resumo.taxa] as [string, number]] : []),
        ...(resumo.couvert > 0 ? [["Couvert", resumo.couvert] as [string, number]] : []),
        ...(resumo.descontos > 0 ? [["Desconto", -resumo.descontos] as [string, number]] : []),
        ...(resumo.pago > 0 ? [["Já pago", resumo.pago] as [string, number]] : []),
      ]
    : []
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>A conta da mesa</DialogTitle>
          <DialogDescription>Mesa {dados.mesa.numero}. Quem recebe é o garçom.</DialogDescription>
        </DialogHeader>
        {!comanda || !resumo ? (
          <p className="text-sm text-muted-foreground">A mesa ainda não tem pedidos.</p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <ul className="flex flex-col divide-y divide-border/70">
              {comanda.itens.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span>
                    {item.quantidade}× {item.nome}
                    {item.opcoes.length > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {item.opcoes.join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">{emReais(item.total)}</span>
                </li>
              ))}
            </ul>
            <dl className="flex flex-col gap-1 border-t border-border/70 pt-3">
              {linhas.map(([rotulo, valor]) => (
                <div key={rotulo} className="flex justify-between text-muted-foreground">
                  <dt>{rotulo}</dt>
                  <dd className="tabular-nums">{emReais(valor)}</dd>
                </div>
              ))}
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{emReais(resumo.total)}</dd>
              </div>
              {resumo.pago > 0 && (
                <div className="flex justify-between font-medium">
                  <dt>Falta pagar</dt>
                  <dd className="tabular-nums">{emReais(resumo.saldo)}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Mesa({
  segmento,
  mesaId,
  dados,
}: {
  segmento: SegmentoPainelId
  mesaId: string
  dados: MesaQr
}) {
  const rodada = useRodada(segmento)
  const pedir = usePedirNaMesa(segmento, mesaId)
  const chamar = useChamarNaMesa(segmento, mesaId)
  const [aviso, setAviso] = useState("")
  const [contaAberta, setContaAberta] = useState(false)
  const total = rodada.itens.reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0)
  const avisarErro = (erro: Error) => setAviso(erro.message)

  const enviar = () =>
    pedir.mutate(rodada.lancados(), {
      onSuccess: ({ pedido }) => {
        rodada.limpar()
        setAviso(
          pedido ? "Pedido enviado. O garçom vai confirmar." : "Pedido enviado para a cozinha.",
        )
      },
      onError: avisarErro,
    })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 pt-6 pb-10">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">{dados.loja}</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Mesa {dados.mesa.numero}</h1>
        <p className="text-sm text-muted-foreground">Peça daqui e pague na mesa, com o garçom.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={chamar.isPending}
          onClick={() =>
            chamar.mutate("garcom", {
              onSuccess: () => setAviso("O garçom já vem."),
              onError: avisarErro,
            })
          }
        >
          <BellRingIcon data-icon="inline-start" />
          Chamar o garçom
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={chamar.isPending}
          onClick={() =>
            chamar.mutate("conta", {
              onSuccess: () => setAviso("A conta foi pedida. O garçom já vem."),
              onError: avisarErro,
            })
          }
        >
          Pedir a conta
        </Button>
        <Button type="button" variant="outline" onClick={() => setContaAberta(true)}>
          <ReceiptTextIcon data-icon="inline-start" />
          Ver a conta
        </Button>
      </div>
      <p role="status" className="min-h-5 text-sm font-medium empty:min-h-0">
        {aviso}
      </p>

      {dados.categorias.map((categoria) => {
        const produtos = dados.produtos.filter((produto) => produto.categoriaId === categoria.id)
        return (
          <section
            key={categoria.id}
            aria-labelledby={`categoria-${categoria.id}`}
            className="flex flex-col gap-1"
          >
            <h2 id={`categoria-${categoria.id}`} className="text-lg font-semibold">
              {categoria.nome}
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 md:gap-x-8">
              {produtos.map((produto) => (
                <li
                  key={produto.id}
                  className="flex items-center gap-3 border-b border-border/70 py-3"
                >
                  {produto.imagem && (
                    <Image
                      src={produto.imagem}
                      alt=""
                      width={56}
                      height={56}
                      className="size-14 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{produto.nome}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {produto.descricao}
                    </span>
                    <span className="text-sm tabular-nums">
                      {emReais(precoDeBalcao(produto, segmento))}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="shrink-0 rounded-full"
                    aria-label={`Adicionar ${produto.nome}`}
                    onClick={() => rodada.tocarProduto(produto)}
                  >
                    <PlusIcon />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <section
        aria-label="Seu pedido"
        className="sticky bottom-0 flex flex-col gap-3 rounded-t-2xl border border-border/70 bg-card p-4 shadow-[0_-8px_24px_-16px_rgb(0_0_0/0.3)]"
      >
        <h2 className="flex items-baseline gap-2 text-[15px] font-semibold">
          Seu pedido
          {rodada.itens.length > 0 && (
            <span className="text-[13px] font-medium text-muted-foreground">
              {plural(
                rodada.itens.reduce((soma, item) => soma + item.quantidade, 0),
                "item",
                "itens",
              )}
            </span>
          )}
        </h2>
        {rodada.itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Toque nos produtos para pedir.</p>
        ) : (
          <ul className="flex max-h-48 flex-col divide-y divide-border/70 overflow-y-auto">
            {rodada.itens.map((item) => (
              <li key={item.chave} className="flex items-center gap-2 py-2 text-sm">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{item.nome}</span>
                  {item.opcoes.length > 0 && (
                    <span className="text-xs text-muted-foreground">{item.opcoes.join(" · ")}</span>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {emReais(item.precoUnitario * item.quantidade)}
                  </span>
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label={`Menos um ${item.nome}`}
                  onClick={() =>
                    item.quantidade <= 1
                      ? rodada.remover(item.chave)
                      : rodada.mudarQuantidade(item.chave, item.quantidade - 1)
                  }
                >
                  {item.quantidade <= 1 ? <Trash2Icon /> : <MinusIcon />}
                </Button>
                <span className="w-6 text-center tabular-nums">{item.quantidade}</span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label={`Mais um ${item.nome}`}
                  onClick={() => rodada.mudarQuantidade(item.chave, item.quantidade + 1)}
                >
                  <PlusIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-lg font-semibold tabular-nums">{emReais(total)}</span>
          <Button
            type="button"
            size="lg"
            disabled={rodada.itens.length === 0 || pedir.isPending}
            onClick={enviar}
          >
            Pedir para a mesa
          </Button>
        </div>
      </section>

      {rodada.janela}
      <ContaDaMesa dados={dados} aberta={contaAberta} aoMudar={setContaAberta} />
    </main>
  )
}

/**
 * A vitrine em modo mesa (o QR): o cardápio da loja para pedir para a mesa, chamar o garçom,
 * pedir e ver a conta. Sem entrega e sem pagamento online: quem recebe é o garçom.
 */
export function VitrineMesa({ segmento, mesaId }: { segmento: string; mesaId: string }) {
  if (!ehSegmentoPainel(segmento)) return <Indisponivel />
  return <VitrineDaLoja segmento={segmento} mesaId={mesaId} />
}

function VitrineDaLoja({ segmento, mesaId }: { segmento: SegmentoPainelId; mesaId: string }) {
  // O que o garçom faz em outra aba aparece aqui na hora.
  useAoVivo()
  const { data, isError } = useMesaQr(segmento, mesaId, 4_000)
  const escolher = useLojaAtual((estado) => estado.escolher)
  // As cores são as da vitrine desta loja.
  useEffect(() => {
    const loja = LOJAS.find((item) => item.loja.segmento === segmento)?.loja.id
    if (ehLojaId(loja)) escolher(loja)
  }, [segmento, escolher])

  if (isError) return <Indisponivel />
  if (!data) {
    return (
      <main
        aria-label="Carregando o cardápio"
        className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-6"
      >
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </main>
    )
  }
  return <Mesa segmento={segmento} mesaId={mesaId} dados={data} />
}
