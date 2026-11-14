"use client"

import {
  ArrowLeftIcon,
  BikeIcon,
  CalendarClockIcon,
  CheckIcon,
  ChefHatIcon,
  CopyIcon,
  CreditCardIcon,
  FileTextIcon,
  InfoIcon,
  MapPinIcon,
  MessageCircleIcon,
  PartyPopperIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  ShoppingBagIcon,
  StoreIcon,
  WalletIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { type ReactNode, useEffect, useState } from "react"
import { toast } from "sonner"
import { AlternarTema } from "@/components/alternar-tema"
import { Dica } from "@/components/dica"
import { Foto } from "@/components/foto"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { textoDoHorario } from "@/lib/agendar"
import { FORMAS_PAGAMENTO } from "@/lib/checkout"
import { emReais } from "@/lib/formato"
import { vibrar } from "@/lib/haptico"
import { useLoja } from "@/lib/loja-atual"
import {
  codigoPix,
  descricaoDoTroco,
  type EtapaPedido,
  etapasDoPedido,
  horario,
  previsaoDoPedido,
  situacaoDoPedido,
  tempoRestantePix,
} from "@/lib/pedido"
import { type Pedido, totalDoItem, useSacola } from "@/lib/sacola"
import { cn } from "@/lib/utils"

const CURVA = [0.23, 1, 0.32, 1] as const

type Etapa = EtapaPedido & { icone: ReactNode }

function etapasDo(pedido: Pedido): Etapa[] {
  const icones = [
    <ReceiptTextIcon key="recebido" />,
    <ChefHatIcon key="preparo" />,
    pedido.tipo === "retirada" ? <StoreIcon key="pronto" /> : <BikeIcon key="saiu" />,
    <PartyPopperIcon key="fim" />,
  ]
  return etapasDoPedido(pedido.tipo).map((etapa, indice) => ({ ...etapa, icone: icones[indice] }))
}

function useAgora() {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(relogio)
  }, [])
  return agora
}

function CartaoPix({ pedido, agora }: { pedido: Pedido; agora: number }) {
  const [copiado, setCopiado] = useState(false)
  const codigo = codigoPix(pedido)
  const restante = tempoRestantePix(pedido.criadoEm, agora)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
    } catch {
      // Sem permissão de área de transferência: o código continua visível para copiar à mão.
    }
    vibrar()
    setCopiado(true)
    toast.success("Código Pix copiado")
    setTimeout(() => setCopiado(false), 2200)
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-start md:text-left">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", duration: 0.6, bounce: 0.25, delay: 0.15 }}
        className="rounded-2xl bg-white p-3 ring-1 ring-border"
      >
        <QRCodeSVG
          value={codigo}
          size={176}
          level="M"
          marginSize={0}
          role="img"
          aria-label="QR Code do Pix"
        />
      </motion.div>
      <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
        <div>
          <p className="text-lg font-bold">Pague {emReais(pedido.total)} com Pix</p>
          <p className="text-sm text-muted-foreground">
            Abra o app do banco, escolha Pix e leia o QR Code ou cole o código.
          </p>
        </div>
        <p className="truncate rounded-xl bg-secondary px-3 py-2.5 font-mono text-xs text-muted-foreground">
          {codigo}
        </p>
        <Button type="button" size="cta" className="w-full md:w-fit" onClick={copiar}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={copiado ? "copiado" : "copiar"}
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(3px)" }}
              transition={{ duration: 0.2, ease: CURVA }}
            >
              {copiado ? <CheckIcon /> : <CopyIcon />}
              {copiado ? "Código copiado" : "Copiar código Pix"}
            </motion.span>
          </AnimatePresence>
        </Button>
        <p className="text-sm text-muted-foreground">
          Expira em <strong className="text-foreground tabular-nums">{restante}</strong>. Esta tela
          atualiza sozinha quando o banco confirmar.
        </p>
      </div>
    </div>
  )
}

function Cartao({
  titulo,
  children,
  className,
  atraso = 0,
}: {
  titulo?: string
  children: ReactNode
  className?: string
  atraso?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: atraso, ease: CURVA }}
      className={cn("sombra-flutuante rounded-3xl bg-card p-4 md:p-6", className)}
    >
      {titulo && <h2 className="mb-4 text-lg font-bold md:text-xl">{titulo}</h2>}
      {children}
    </motion.section>
  )
}

function LinhaDoTempo({
  etapas,
  atual,
  momentos,
}: {
  etapas: Etapa[]
  atual: number
  momentos: number[]
}) {
  return (
    <ol className="flex flex-col" aria-label="Andamento do pedido">
      {etapas.map((etapa, indice) => {
        const feita = indice < atual
        const ativa = indice === atual
        const ultima = indice === etapas.length - 1
        return (
          <li
            key={etapa.titulo}
            aria-current={ativa ? "step" : undefined}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            {!ultima && (
              <span
                aria-hidden="true"
                className="absolute top-10 bottom-0 left-5 w-0.5 -translate-x-1/2 bg-border"
              >
                <motion.span
                  className="absolute inset-0 origin-top bg-primary"
                  initial={false}
                  animate={{ scaleY: feita ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: CURVA }}
                />
              </span>
            )}
            <span className="relative block size-10 shrink-0">
              {ativa && (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-primary/30"
                  animate={{ scale: [1, 1.55], opacity: [0.7, 0] }}
                  transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeOut" }}
                />
              )}
              <motion.span
                aria-hidden="true"
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-full transition-colors duration-300 [&_svg]:size-5",
                  feita || ativa
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
                animate={{ scale: ativa ? 1.06 : 1 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0.4 }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={feita ? "feita" : "icone"}
                    initial={{ scale: 0.3, opacity: 0, rotate: -40 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.3, opacity: 0 }}
                    transition={{ type: "spring", duration: 0.45, bounce: 0.4 }}
                  >
                    {feita ? <CheckIcon strokeWidth={3} /> : etapa.icone}
                  </motion.span>
                </AnimatePresence>
              </motion.span>
            </span>
            <div className="min-w-0 flex-1 pt-1.5">
              <p
                className={cn(
                  "font-semibold transition-colors duration-300",
                  !feita && !ativa && "text-muted-foreground",
                )}
              >
                {etapa.titulo}
                {feita && <span className="sr-only"> (concluído)</span>}
              </p>
              <AnimatePresence initial={false}>
                {(ativa || feita) && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    transition={{ duration: 0.3, ease: CURVA }}
                    className="overflow-hidden text-sm text-muted-foreground"
                  >
                    {ativa ? etapa.texto : horario(momentos[indice])}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Detalhes({ pedido }: { pedido: Pedido }) {
  const forma = pedido.pagamento ? FORMAS_PAGAMENTO[pedido.pagamento] : null
  const retirada = pedido.tipo === "retirada"

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3">
        {pedido.itens.map((item) => (
          <li key={item.chave} className="flex gap-3">
            <Foto src={item.imagem} alt="" sizes="48px" className="size-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {item.quantidade}× {item.nome}
              </p>
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

      <dl className="flex flex-col gap-1.5 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{emReais(pedido.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{retirada ? "Retirada" : "Entrega"}</dt>
          <dd className="tabular-nums">
            {pedido.taxaEntrega > 0 ? emReais(pedido.taxaEntrega) : "Grátis"}
          </dd>
        </div>
        <div className="mt-1 flex justify-between border-t pt-3 text-base font-bold">
          <dt>Total</dt>
          <dd className="tabular-nums">{emReais(pedido.total)}</dd>
        </div>
      </dl>

      <div className="grid gap-4 border-t pt-4 text-sm sm:grid-cols-2">
        {forma && (
          <div className="flex gap-3">
            <WalletIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">{forma.titulo}</p>
              {pedido.pagamento === "dinheiro" && (
                <p className="text-muted-foreground">
                  {descricaoDoTroco(pedido.troco, pedido.total)}
                </p>
              )}
            </div>
          </div>
        )}
        {pedido.endereco && (
          <div className="flex gap-3">
            {retirada ? (
              <StoreIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            ) : (
              <MapPinIcon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            )}
            <div>
              <p className="font-semibold">{retirada ? "Retirada no balcão" : "Entrega em"}</p>
              <p className="text-muted-foreground">{pedido.endereco}</p>
            </div>
          </div>
        )}
        {pedido.agendamento && (
          <div className="flex gap-3 sm:col-span-2">
            <CalendarClockIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">Horário marcado</p>
              <p className="text-muted-foreground">{textoDoHorario(pedido.agendamento.inicio)}</p>
            </div>
          </div>
        )}
        {pedido.receita && (
          <div className="flex gap-3 sm:col-span-2">
            <FileTextIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">Receita enviada</p>
              <p className="text-muted-foreground">
                {pedido.receita.retida
                  ? `${pedido.receita.arquivo} · tenha a via original em mãos para ${retirada ? "o balcão" : "o entregador"}`
                  : `${pedido.receita.arquivo} · conferida pela farmacêutica antes de separar`}
              </p>
            </div>
          </div>
        )}
        {pedido.observacao && (
          <div className="flex gap-3 sm:col-span-2">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-semibold">Observação</p>
              <p className="text-muted-foreground">{pedido.observacao}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Status({
  icone,
  titulo,
  texto,
  chave,
}: {
  icone: ReactNode
  titulo: string
  texto: string
  chave: string
}) {
  return (
    <div className="flex items-center gap-4" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={chave}
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-marca-texto ring-1 ring-border [&_svg]:size-7 md:size-16"
          initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.4, opacity: 0, rotate: 25 }}
          transition={{ type: "spring", duration: 0.55, bounce: 0.4 }}
        >
          {icone}
        </motion.span>
      </AnimatePresence>
      <div className="min-w-0">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.h1
            key={titulo}
            className="text-2xl leading-tight font-extrabold tracking-tight md:text-4xl"
            initial={{ y: 16, opacity: 0, filter: "blur(4px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: -16, opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: CURVA }}
          >
            {titulo}
          </motion.h1>
        </AnimatePresence>
        <p className="text-muted-foreground md:text-lg">{texto}</p>
      </div>
    </div>
  )
}

function Conteudo({ pedido }: { pedido: Pedido }) {
  const lojaEscolhida = useLoja()
  const agora = useAgora()
  const { pago, atual, concluido, atualNaLista, momentos, pagamentoAcabouDeConfirmar, criadoEm } =
    situacaoDoPedido(pedido, agora)
  const etapas = etapasDo(pedido)

  const status = !pago
    ? pedido.pagamento === "pix"
      ? {
          chave: "pix",
          icone: <QrCodeIcon />,
          titulo: "Aguardando o Pix",
          texto: "Pague para a loja começar o preparo.",
        }
      : {
          chave: "cartao",
          icone: <CreditCardIcon />,
          titulo: "Confirmando o pagamento",
          texto: "Isso leva só alguns segundos.",
        }
    : {
        chave: `etapa-${atual}`,
        icone: etapas[atual].icone,
        titulo: etapas[atual].titulo,
        texto: concluido
          ? etapas[atual].texto
          : `Previsão: ${previsaoDoPedido(pedido.tipo, momentos[0])}`,
      }

  const dataPedido = new Date(criadoEm).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  })

  return (
    <>
      {/* Topo neutro, no tom da página: o destaque fica para o status, não para a cor. */}
      <section className="relative border-b bg-card text-card-foreground">
        <div className="relative mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pt-3 pb-16 md:px-6 md:pb-24">
          <div className="flex items-center gap-2">
            <Dica texto="Voltar ao cardápio">
              <Button asChild variant="ghost" size="toque" className="rounded-full">
                <Link href="/" aria-label="Voltar ao cardápio">
                  <ArrowLeftIcon />
                </Link>
              </Button>
            </Dica>
            <span className="relative size-9 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-border">
              <Image src={lojaEscolhida.logo} alt="" fill sizes="36px" />
            </span>
            <p className="hidden min-w-0 flex-1 truncate text-sm font-semibold sm:block">
              {lojaEscolhida.nome}
            </p>
            <p className="ml-auto text-sm text-muted-foreground tabular-nums">
              Pedido nº {pedido.numero}
              <span className="hidden sm:inline">
                {" "}
                · {dataPedido} às {horario(criadoEm)}
              </span>
            </p>
            <AlternarTema />
          </div>
          <Status {...status} />
        </div>
      </section>

      <div className="relative mx-auto -mt-10 grid w-full max-w-[1180px] gap-4 px-4 pb-12 md:-mt-14 md:gap-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
          <AnimatePresence initial={false} mode="popLayout">
            {!pago && pedido.pagamento === "pix" ? (
              <motion.div
                key="pix"
                exit={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
                transition={{ duration: 0.35, ease: CURVA }}
              >
                <Cartao>
                  <CartaoPix pedido={pedido} agora={agora} />
                </Cartao>
              </motion.div>
            ) : pagamentoAcabouDeConfirmar ? (
              <motion.div
                key="aprovado"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: CURVA }}
                role="status"
                className="flex items-center gap-3 rounded-2xl bg-sucesso px-4 py-3.5 font-semibold text-white shadow-lg dark:text-[#052e16]"
              >
                <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden="true">
                  <motion.path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.15, ease: CURVA }}
                  />
                </svg>
                Pagamento aprovado! A loja já começou seu pedido.
              </motion.div>
            ) : null}
          </AnimatePresence>

          <Cartao titulo="Andamento" atraso={0.08}>
            <LinhaDoTempo etapas={etapas} atual={pago ? atualNaLista : -1} momentos={momentos} />
          </Cartao>

          <Marker className="rounded-xl bg-secondary px-3 py-2.5 text-sm">
            <MarkerIcon>
              <InfoIcon />
            </MarkerIcon>
            <MarkerContent>
              Protótipo: o pagamento e o andamento avançam sozinhos para mostrar o fluxo.
            </MarkerContent>
          </Marker>
        </div>

        <div className="flex flex-col gap-4 md:gap-6">
          <Cartao titulo="Seu pedido" atraso={0.14}>
            <Detalhes pedido={pedido} />
          </Cartao>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2, ease: CURVA }}
            className="flex flex-col gap-2"
          >
            <Button asChild size="cta" className="w-full">
              <Link href="/whatsapp">
                <MessageCircleIcon data-icon="inline-start" />
                Falar com a loja no WhatsApp
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-12 w-full rounded-full text-base font-semibold"
            >
              <Link href="/">Fazer novo pedido</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </>
  )
}

/** Acompanhamento do pedido, como a página `/pedido/{token}` do site atual. */
export function Acompanhamento() {
  const pedido = useSacola((estado) => estado.ultimoPedido)
  const hidratada = useSacola((estado) => estado.hidratada)

  if (!hidratada) return <main className="min-h-dvh bg-background" />

  if (!pedido) {
    return (
      <main className="flex min-h-dvh items-center bg-background">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingBagIcon />
            </EmptyMedia>
            <EmptyTitle>Nenhum pedido por aqui</EmptyTitle>
            <EmptyDescription>Monte um pedido no cardápio para acompanhar.</EmptyDescription>
          </EmptyHeader>
          <Button asChild size="cta">
            <Link href="/">Ver cardápio</Link>
          </Button>
        </Empty>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-background">
      <Conteudo key={pedido.numero} pedido={pedido} />
    </main>
  )
}
