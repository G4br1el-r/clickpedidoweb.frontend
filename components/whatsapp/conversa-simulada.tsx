"use client"

import { ArrowLeftIcon, InfoIcon, ShoppingBagIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { type ReactNode, useEffect, useState } from "react"
import { AlternarTema } from "@/components/alternar-tema"
import { Dica } from "@/components/dica"
import { Badge } from "@/components/ui/badge"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageContent } from "@/components/ui/message"
import { clienteAtual } from "@/lib/cliente"
import { emReais } from "@/lib/formato"
import { type Pedido, useSacola } from "@/lib/sacola"

const CURVA = [0.23, 1, 0.32, 1] as const
const TEMPOS_MS = [900, 1300, 1300]

function BalaoLoja({ children }: { children: ReactNode }) {
  return (
    <Message>
      <MessageContent>
        <Bubble variant="outline">
          <BubbleContent className="bg-card text-base">{children}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

function Digitando() {
  return (
    <div role="status" aria-label={`${clienteAtual.nome} está digitando`}>
      <BalaoLoja>
        <span className="flex h-6 items-center gap-1" aria-hidden="true">
          {[0, 0.15, 0.3].map((atraso) => (
            <motion.span
              key={atraso}
              className="size-2 rounded-full bg-muted-foreground"
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 0.9, delay: atraso, repeat: Number.POSITIVE_INFINITY }}
            />
          ))}
        </span>
      </BalaoLoja>
    </div>
  )
}

function ResumoPedido({ pedido }: { pedido: Pedido }) {
  return (
    <Message align="end">
      <MessageContent>
        <Bubble variant="tinted" align="end" className="max-w-[88%]">
          <BubbleContent className="text-base">
            <p className="font-semibold">Olá! Quero fazer este pedido:</p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {pedido.itens.map((item) => (
                <li key={item.chave}>
                  <span className="font-medium">
                    {item.quantidade}× {item.nome}
                  </span>
                  {item.resumo.length > 0 && (
                    <span className="block text-sm">{item.resumo.join(" · ")}</span>
                  )}
                  {item.observacao && (
                    <span className="block text-sm">Observação: {item.observacao}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-sm">
              {pedido.tipo === "retirada"
                ? "Retirada no balcão"
                : `Entrega: ${emReais(pedido.taxaEntrega)}`}
            </p>
            {pedido.endereco && pedido.tipo !== "retirada" && (
              <p className="text-sm">{pedido.endereco}</p>
            )}
            <p className="font-bold">Total: {emReais(pedido.total)}</p>
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

/** Protótipo: nada aqui fala com o WhatsApp; serve para mostrar o fluxo completo ao dono. */
export function ConversaSimulada() {
  const pedido = useSacola((estado) => estado.ultimoPedido)
  const hidratada = useSacola((estado) => estado.hidratada)
  const [etapa, setEtapa] = useState(0)
  const loja = clienteAtual

  const mensagens = pedido
    ? [
        `Recebemos seu pedido nº ${pedido.numero}. Obrigado por escolher a ${loja.nome}!`,
        "Sua pizza já está indo para o forno a lenha.",
        pedido.tipo === "retirada"
          ? `Fica pronto em ${loja.retirada.tempo}. Avisamos por aqui quando puder buscar.`
          : `A previsão de entrega é de ${loja.entrega.tempo}. Avisamos por aqui quando sair.`,
      ]
    : []
  const terminou = etapa >= mensagens.length

  useEffect(() => {
    if (!pedido || etapa >= TEMPOS_MS.length) return
    const proxima = setTimeout(() => setEtapa((atual) => atual + 1), TEMPOS_MS[etapa])
    return () => clearTimeout(proxima)
  }, [etapa, pedido])

  useEffect(() => {
    if (etapa > 0) window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
  }, [etapa])

  if (hidratada && !pedido) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[720px] items-center bg-background">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingBagIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum pedido por aqui</EmptyTitle>
            <EmptyDescription>Monte um pedido no cardápio para ver a conversa.</EmptyDescription>
          </EmptyHeader>
          <Button asChild size="cta">
            <Link href="/">Ver cardápio</Link>
          </Button>
        </Empty>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col bg-secondary">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-2 py-2">
        <Dica texto="Voltar ao cardápio">
          <Button asChild variant="ghost" size="toque">
            <Link href="/" aria-label="Voltar ao cardápio">
              <ArrowLeftIcon />
            </Link>
          </Button>
        </Dica>
        <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-white">
          <Image src={loja.logo} alt="" fill sizes="40px" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-sans text-base font-semibold">{loja.nome}</h1>
          <p className="text-sm text-sucesso">online</p>
        </div>
        <Badge variant="secondary" className="mr-1 border-input">
          Simulação
        </Badge>
        <AlternarTema />
      </header>

      <div role="log" aria-label="Conversa com a loja" className="flex flex-1 flex-col gap-2.5 p-3">
        <Marker className="justify-center rounded-lg bg-background px-3 py-2 text-center text-sm">
          <MarkerIcon>
            <InfoIcon />
          </MarkerIcon>
          <MarkerContent>Conversa simulada. Nenhuma mensagem foi enviada de verdade.</MarkerContent>
        </Marker>

        {pedido && <ResumoPedido pedido={pedido} />}

        <AnimatePresence initial={false}>
          {mensagens.slice(0, etapa).map((texto) => (
            <motion.div
              key={texto}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: CURVA }}
            >
              <BalaoLoja>{texto}</BalaoLoja>
            </motion.div>
          ))}
        </AnimatePresence>

        {pedido && !terminou && <Digitando />}
      </div>

      <AnimatePresence>
        {pedido && terminou && (
          <motion.div
            className="sticky bottom-0 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: CURVA }}
          >
            <Button asChild size="cta" className="w-full">
              <Link href="/">Fazer novo pedido</Link>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
