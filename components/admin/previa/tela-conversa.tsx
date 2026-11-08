"use client"

import { MessageCircleOffIcon } from "lucide-react"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Message, MessageContent } from "@/components/ui/message"
import { emReais } from "@/lib/formato"
import { Entrada, ImagemLoja, useConfigAtual, useImagensLoja } from "./comum"

/** Conversa do WhatsApp que a pessoa recebe depois do pedido. */
export function TelaConversa() {
  const config = useConfigAtual()
  const { logo } = useImagensLoja()
  const { conversa } = config

  if (!conversa.ativa) {
    return (
      <Empty className="min-h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageCircleOffIcon />
          </EmptyMedia>
          <EmptyTitle>Conversa desligada</EmptyTitle>
          <EmptyDescription>
            Ligue a conversa para a loja falar com o cliente pelo WhatsApp.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const mensagens = [
    conversa.saudacao,
    ...(conversa.resumoNoChat
      ? [`Resumo do pedido #1042:\n1x Pizza meio a meio\n1x Refrigerante 2L\nTotal: ${emReais(96)}`]
      : []),
    "Seu pedido entrou no forno! Previsão: 20:20 a 20:35.",
  ]

  return (
    <div className="flex min-h-full flex-col bg-[#ECE5DD] dark:bg-[#0B141A]">
      <header className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white dark:bg-[#1F2C34]">
        <ImagemLoja src={logo} sizes="40px" className="size-9 rounded-full bg-white" />
        <div className="leading-tight">
          <p className="text-sm font-semibold">{config.identidade.nome}</p>
          <p className="text-xs opacity-80">online</p>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-2 p-3">
        <Message align="end">
          <MessageContent>
            <Bubble variant="tinted" align="end">
              <BubbleContent>Oi! Acabei de fazer meu pedido pelo site 🍕</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
        {mensagens.map((texto, indice) => (
          <Entrada key={texto} indice={indice + 1}>
            <Message>
              <MessageContent>
                <Bubble variant="outline">
                  <BubbleContent className="bg-card whitespace-pre-line">{texto}</BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          </Entrada>
        ))}
      </div>
    </div>
  )
}
