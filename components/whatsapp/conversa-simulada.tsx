"use client"

import { ArrowLeftIcon, CheckCheckIcon, CheckIcon, InfoIcon, ShoppingBagIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { AlternarTema } from "@/components/alternar-tema"
import { Dica } from "@/components/dica"
import { registroSegmentos } from "@/components/segmentos/registro"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { horaDaMensagem, mensagensDaLoja, roteiroDaConversa } from "@/lib/conversa"
import { emReais } from "@/lib/formato"
import { useLoja } from "@/lib/loja-atual"
import { type Pedido, totalDoItem, useSacola } from "@/lib/sacola"
import { cn } from "@/lib/utils"

const CURVA = [0.23, 1, 0.32, 1] as const

/** Só acompanha a mensagem nova se a pessoa já estava perto do fim (não puxa quem subiu para ler). */
const PERTO_DO_FIM_PX = 240

type Lado = "loja" | "cliente"

/** O balão entra do lado de quem fala: sobe um pouco e cresce de 0,96 a partir do canto dele. */
function Entrada({
  lado,
  atraso = 0,
  children,
}: {
  lado: Lado
  atraso?: number
  children: ReactNode
}) {
  const reduzido = useReducedMotion()
  return (
    <motion.div
      className={cn("flex", lado === "cliente" ? "justify-end" : "justify-start")}
      style={{ transformOrigin: lado === "cliente" ? "100% 100%" : "0% 100%" }}
      initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduzido ? 0.16 : 0.28, ease: CURVA, delay: atraso }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Superfície plana, sem sombra: a loja fala em cartão com fio fino, a pessoa no tom da página.
 * O canto de cima, do lado de quem fala, fecha um pouco no primeiro balão da sequência,
 * no lugar do bico; os seguintes ficam redondos, como uma fala só.
 */
function Balao({
  lado,
  bico = true,
  className,
  children,
}: {
  lado: Lado
  bico?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "relative rounded-[18px] px-3.5 pt-2 pb-1.5 text-[15px] leading-[1.45]",
        lado === "loja"
          ? "border border-border/70 bg-card text-card-foreground"
          : "bg-secondary text-secondary-foreground",
        bico && (lado === "loja" ? "rounded-tl-md" : "rounded-tr-md"),
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Hora no canto do balão, em números tabulares. */
function Hora({ hora, children }: { hora?: string; children?: ReactNode }) {
  if (!hora) return null
  return (
    <span className="flex items-center justify-end gap-1 text-[11px] leading-none text-muted-foreground tabular-nums">
      {hora}
      {children}
    </span>
  )
}

function MensagemLoja({ texto, hora, bico }: { texto: string; hora?: string; bico: boolean }) {
  return (
    <Entrada lado="loja">
      <article className="max-w-[85%] md:max-w-md">
        <Balao lado="loja" bico={bico}>
          <p>
            {texto}
            {/* Reserva o canto para a hora, que fica presa embaixo à direita. */}
            {hora && <span aria-hidden="true" className="inline-block w-10" />}
          </p>
          {hora && (
            <span className="absolute right-3 bottom-2">
              <Hora hora={hora} />
            </span>
          )}
        </Balao>
      </article>
    </Entrada>
  )
}

/** Os três pontos: uma onda curta, em laço, só enquanto a loja digita. */
function Digitando({ bico }: { bico: boolean }) {
  const loja = useLoja()
  const reduzido = useReducedMotion()
  return (
    <Entrada lado="loja">
      <div role="status" aria-label={`${loja.nome} está digitando`}>
        <Balao lado="loja" bico={bico} className="px-4 py-3.5">
          <span className="flex h-2 items-center gap-1" aria-hidden="true">
            {[0, 0.16, 0.32].map((atraso) => (
              <motion.span
                key={atraso}
                className="size-1.5 rounded-full bg-muted-foreground"
                animate={
                  reduzido ? { opacity: [0.4, 1, 0.4] } : { opacity: [0.4, 1, 0.4], y: [0, -3, 0] }
                }
                transition={{
                  duration: 1,
                  delay: atraso,
                  ease: "easeInOut",
                  repeat: Number.POSITIVE_INFINITY,
                }}
              />
            ))}
          </span>
        </Balao>
      </div>
    </Entrada>
  )
}

/** Confirmação de leitura: um tique ao enviar; dois, na cor da loja, quando ela lê. */
function Recibo({ lida }: { lida: boolean }) {
  const reduzido = useReducedMotion()
  return (
    <span role="img" aria-label={lida ? "Lida" : "Enviada"} className="inline-flex size-4">
      <motion.span
        key={lida ? "lida" : "enviada"}
        className={cn("inline-flex", lida && "text-marca-texto")}
        initial={lida ? (reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.8 }) : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: CURVA }}
      >
        {lida ? (
          <CheckCheckIcon aria-hidden="true" className="size-4" />
        ) : (
          <CheckIcon aria-hidden="true" className="size-4" />
        )}
      </motion.span>
    </span>
  )
}

/** O pedido como a pessoa mandou, na linguagem da etiqueta: valores tabulares e o traço da loja. */
function ResumoPedido({ pedido, lida }: { pedido: Pedido; lida: boolean }) {
  const suave = "text-[13px] leading-snug text-muted-foreground"

  return (
    <Entrada lado="cliente" atraso={0.05}>
      <article aria-label="Seu pedido" className="w-[min(88%,22rem)]">
        <Balao lado="cliente" className="pt-2.5 pb-2">
          <p className="font-medium">Olá! Quero fazer este pedido:</p>
          <ul className="mt-2 flex flex-col gap-2 border-t border-border/70 pt-2">
            {pedido.itens.map((item) => (
              <li key={item.chave} className="flex items-start justify-between gap-4">
                <div className="min-w-0 wrap-anywhere">
                  <span className="block font-medium">
                    {item.quantidade}× {item.nome}
                  </span>
                  {item.resumo.length > 0 && (
                    <span className={cn(suave, "block")}>{item.resumo.join(" · ")}</span>
                  )}
                  {item.observacao && (
                    <span className={cn(suave, "block")}>Observação: {item.observacao}</span>
                  )}
                </div>
                <span className="shrink-0 text-sm tabular-nums">{emReais(totalDoItem(item))}</span>
              </li>
            ))}
          </ul>
          <div className={cn(suave, "mt-2 border-t border-border/70 pt-2")}>
            {pedido.tipo === "retirada" ? (
              <p>Retirada no balcão</p>
            ) : (
              <>
                <p className="flex justify-between gap-4">
                  <span>Entrega</span>{" "}
                  <span className="tabular-nums">{emReais(pedido.taxaEntrega)}</span>
                </p>
                {pedido.endereco && <p className="wrap-anywhere">{pedido.endereco}</p>}
              </>
            )}
          </div>
          <p className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span
              aria-hidden="true"
              className="h-3.5 w-[3px] shrink-0 self-center rounded-full bg-primary"
            />
            <span className="font-medium">
              Total<span className="sr-only">:</span>
            </span>{" "}
            <span className="ml-auto text-base font-semibold tracking-[-0.01em]">
              {emReais(pedido.total)}
            </span>
          </p>
          <div className="mt-1">
            <Hora hora={horaDaMensagem(pedido.criadoEm)}>
              <Recibo lida={lida} />
            </Hora>
          </div>
        </Balao>
      </article>
    </Entrada>
  )
}

/** O pedido salvo neste aparelho ainda não chegou: espera com o carregador do ofício. */
function Esperando() {
  const loja = useLoja()
  const { Carregador } = registroSegmentos[loja.segmento]
  return (
    <motion.div
      role="status"
      aria-label="Abrindo a conversa"
      className="flex flex-1 items-center justify-center"
      // Só aparece se a espera durar: na maioria das vezes o pedido chega antes.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: 0.2 }}
    >
      <Carregador className="size-10" />
    </motion.div>
  )
}

/** "online" ou "digitando…" embaixo do nome: troca na hora e o novo esmaece para dentro. */
function Situacao({ digitando }: { digitando: boolean }) {
  return (
    <motion.p
      key={digitando ? "digitando" : "online"}
      className={cn(
        "mt-0.5 flex items-center gap-1.5 text-[13px] leading-tight",
        digitando ? "text-marca-texto" : "text-sucesso",
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: CURVA }}
    >
      {digitando ? (
        "digitando…"
      ) : (
        <>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          online
        </>
      )}
    </motion.p>
  )
}

/** Protótipo: nada aqui fala com o WhatsApp; serve para mostrar o fluxo completo ao dono. */
export function ConversaSimulada() {
  const pedido = useSacola((estado) => estado.ultimoPedido)
  const hidratada = useSacola((estado) => estado.hidratada)
  const loja = useLoja()
  const reduzido = useReducedMotion()

  const mensagens = useMemo(() => (pedido ? mensagensDaLoja(pedido, loja) : []), [pedido, loja])
  const roteiro = useMemo(() => roteiroDaConversa(mensagens), [mensagens])
  const [passo, setPasso] = useState(0)
  const marco = roteiro[Math.min(passo, roteiro.length - 1)]
  const terminou = Boolean(pedido) && passo >= roteiro.length - 1

  // Todos os marcos agendados a partir da abertura: o ritmo não escorrega a cada passo.
  useEffect(() => {
    if (!pedido) return
    setPasso(0)
    const agendados = roteiro.map(({ em }, indice) => setTimeout(() => setPasso(indice), em))
    return () => agendados.forEach(clearTimeout)
  }, [pedido, roteiro])

  // A rolagem acompanha o "digitando…" e cada resposta, como numa conversa de verdade.
  const novidade = marco.visiveis * 2 + (marco.digitando ? 1 : 0)
  useEffect(() => {
    if (novidade === 0) return
    const fim = document.documentElement.scrollHeight
    if (fim - (window.scrollY + window.innerHeight) > PERTO_DO_FIM_PX) return
    window.scrollTo({ top: fim, behavior: reduzido ? "auto" : "smooth" })
  }, [novidade, reduzido])

  if (hidratada && !pedido) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[720px] items-center bg-background">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingBagIcon />
            </EmptyMedia>
            <EmptyTitle className="text-lg font-semibold tracking-[-0.015em]">
              Nenhum pedido por aqui
            </EmptyTitle>
            <EmptyDescription>Monte um pedido no cardápio para ver a conversa.</EmptyDescription>
          </EmptyHeader>
          <Button asChild size="cta">
            <Link href="/">Ver cardápio</Link>
          </Button>
        </Empty>
      </main>
    )
  }

  const horaResposta = horaDaMensagem(pedido?.criadoEm, 1)

  return (
    <main className="flex min-h-dvh w-full flex-col bg-background">
      <header
        data-testid="topo-conversa"
        className="sticky top-0 z-10 border-b border-border/70 bg-background"
      >
        <div className="mx-auto flex h-16 w-full max-w-[720px] items-center gap-2 px-2 md:px-4">
          <Dica texto="Voltar ao cardápio">
            <Button asChild variant="ghost" size="toque">
              <Link href="/" aria-label="Voltar ao cardápio">
                <ArrowLeftIcon />
              </Link>
            </Button>
          </Dica>
          <span className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-border/70">
            <Image src={loja.logo} alt="" fill sizes="40px" />
          </span>
          <div className="ml-1 min-w-0 flex-1">
            <h1 className="truncate text-[15px] leading-tight font-semibold tracking-[-0.015em]">
              {loja.nome}
            </h1>
            <Situacao digitando={marco.digitando} />
          </div>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Simulação
          </span>
          <AlternarTema />
        </div>
      </header>

      <div
        role="log"
        aria-label="Conversa com a loja"
        className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-1.5 px-4 pt-4 pb-6 md:px-6"
      >
        <p className="mx-auto mb-3 flex max-w-[20rem] items-start gap-2 rounded-xl bg-secondary px-3 py-2 text-center text-xs leading-snug text-muted-foreground">
          <InfoIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          Conversa simulada. Nenhuma mensagem foi enviada de verdade.
        </p>

        {!hidratada && <Esperando />}

        {pedido && <ResumoPedido pedido={pedido} lida={marco.lida} />}

        {/* As respostas da loja ficam juntas, um pouco afastadas do pedido. */}
        {pedido && (marco.visiveis > 0 || marco.digitando) && (
          <div className="mt-3 flex flex-col gap-1.5">
            {mensagens.slice(0, marco.visiveis).map((texto, indice) => (
              <MensagemLoja key={texto} texto={texto} hora={horaResposta} bico={indice === 0} />
            ))}
            {marco.digitando && (
              <Digitando key={`digitando-${marco.visiveis}`} bico={marco.visiveis === 0} />
            )}
          </div>
        )}
      </div>

      {terminou && (
        <motion.div
          className="sticky bottom-0 border-t border-border/70 bg-background"
          initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: CURVA, delay: 0.12 }}
        >
          <div className="mx-auto flex w-full max-w-[720px] justify-center px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
            <Button asChild size="cta" className="w-full md:w-80">
              <Link href="/">Fazer novo pedido</Link>
            </Button>
          </div>
        </motion.div>
      )}
    </main>
  )
}
