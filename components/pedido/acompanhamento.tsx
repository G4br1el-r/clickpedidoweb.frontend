"use client"

import { CheckIcon, CopyIcon, InfoIcon, MessageCircleIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { type ReactNode, useEffect, useState } from "react"
import { toast } from "sonner"
import { Entrada } from "@/components/entrada"
import { Foto } from "@/components/foto"
import { registroSegmentos } from "@/components/segmentos/registro"
import { Button } from "@/components/ui/button"
import { prazoDoAcompanhamento } from "@/lib/acompanhamento"
import { textoDoHorario } from "@/lib/agendar"
import { FORMAS_PAGAMENTO } from "@/lib/checkout"
import { emReais, plural } from "@/lib/formato"
import { vibrar } from "@/lib/haptico"
import { useLoja } from "@/lib/loja-atual"
import {
  codigoPix,
  descricaoDoTroco,
  type EtapaPedido,
  etapasDoPedido,
  horario,
  situacaoDoPedido,
  tempoRestantePix,
} from "@/lib/pedido"
import { type Pedido, totalDoItem, useSacola } from "@/lib/sacola"
import { cn } from "@/lib/utils"
import { Motoboy } from "./motoboy"
import { Preco } from "./preco"
import { TopoPedido } from "./topo-pedido"

/** Saída rápida: o que entra ou sai da tela. */
const CURVA = [0.23, 1, 0.32, 1] as const
/** O preenchimento da linha do tempo leva este tempo até a etapa nova; só então o marcador assenta. */
const PREENCHER_S = 0.5

function useAgora() {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(relogio)
  }, [])
  return agora
}

function BlocoPix({ pedido, agora }: { pedido: Pedido; agora: number }) {
  const [copiado, setCopiado] = useState(false)
  const reduzido = useReducedMotion()
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
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-border/70 p-4 text-center sm:flex-row sm:items-start sm:p-5 sm:text-left">
      <div className="shrink-0 rounded-xl bg-white p-2.5 ring-1 ring-border/70">
        <QRCodeSVG
          value={codigo}
          size={168}
          level="M"
          marginSize={0}
          role="img"
          aria-label="QR Code do Pix"
        />
      </div>
      <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
        <div>
          <p className="text-[17px] font-semibold tracking-[-0.015em]">
            Pague <span className="tabular-nums">{emReais(pedido.total)}</span> com Pix
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Abra o app do banco, escolha Pix e leia o QR Code ou cole o código.
          </p>
        </div>
        <p className="truncate rounded-lg bg-secondary px-3 py-2.5 font-mono text-xs text-muted-foreground">
          {codigo}
        </p>
        <Button type="button" size="cta" className="w-full sm:w-fit" onClick={copiar}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={copiado ? "copiado" : "copiar"}
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: reduzido ? 0 : 8, filter: reduzido ? "none" : "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "none" }}
              exit={{ opacity: 0, y: reduzido ? 0 : -8, filter: reduzido ? "none" : "blur(2px)" }}
              transition={{ duration: 0.18, ease: CURVA }}
            >
              {copiado ? <CheckIcon /> : <CopyIcon />}
              {copiado ? "Código copiado" : "Copiar código Pix"}
            </motion.span>
          </AnimatePresence>
        </Button>
        <p className="text-sm text-muted-foreground">
          Expira em{" "}
          <strong className="font-semibold text-foreground tabular-nums">{restante}</strong>. Esta
          tela atualiza sozinha quando o banco confirmar.
        </p>
      </div>
    </div>
  )
}

/** Três fatos entre dois fios, como a régua da vitrine. */
function Regua({ fatos }: { fatos: { rotulo: string; valor: string }[] }) {
  return (
    <dl className="grid grid-cols-[1.35fr_1fr_1fr] border-y border-border/70 md:flex">
      {fatos.map(({ rotulo, valor }) => (
        <div
          key={rotulo}
          className="flex min-w-0 flex-col gap-0.5 border-l border-border/70 py-3 pl-3 first:border-l-0 first:pl-0 md:pr-8 md:pl-8 md:first:pl-0"
        >
          <dt className="text-xs leading-tight text-muted-foreground">{rotulo}</dt>
          <dd className="text-[15px] leading-tight font-semibold whitespace-nowrap tabular-nums md:text-[17px]">
            {valor}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** A etapa nova espera o preenchimento chegar até ela para assentar. */
const CHEGADA_S = PREENCHER_S * 0.8

function Marcador({ estado }: { estado: "feita" | "ativa" | "pendente" }) {
  const reduzido = useReducedMotion()
  const atraso = estado === "ativa" && !reduzido ? CHEGADA_S : 0
  return (
    <span aria-hidden="true" className="relative grid size-6 shrink-0 place-items-center">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={estado}
          className={cn(
            "grid place-items-center rounded-full",
            estado === "feita" && "size-6 bg-primary text-primary-foreground",
            estado === "ativa" && "size-6 border-2 border-primary bg-background",
            estado === "pendente" && "size-3 border-2 border-border bg-background",
          )}
          initial={{ opacity: 0, scale: reduzido ? 1 : 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ type: "spring", duration: 0.45, bounce: 0.2, delay: atraso }}
        >
          {estado === "feita" && <CheckIcon className="size-3.5" strokeWidth={3} />}
          {estado === "ativa" && <span className="size-2.5 rounded-full bg-primary" />}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/**
 * As etapas numa coluna, com um fio que enche na cor da loja até a etapa em andamento.
 * Todas as linhas têm a mesma altura: o fio é um só e o preenchimento corre direto até o marcador.
 */
function LinhaDoTempo({
  etapas,
  atual,
  momentos,
}: {
  etapas: EtapaPedido[]
  atual: number
  momentos: number[]
}) {
  const reduzido = useReducedMotion()
  const ultima = etapas.length - 1
  const progresso = Math.max(0, Math.min(atual, ultima)) / ultima
  // A ênfase da linha (cor do título e o "agora") chega junto com o marcador.
  const chegada = reduzido ? 0 : CHEGADA_S

  return (
    <ol className="relative" aria-label="Andamento do pedido">
      <span aria-hidden="true" className="absolute top-6 bottom-6 left-[11px] w-0.5 bg-border">
        <span
          className="absolute inset-0 origin-top bg-primary transition-transform ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none"
          style={{ transform: `scaleY(${progresso})`, transitionDuration: `${PREENCHER_S}s` }}
        />
      </span>
      {etapas.map((etapa, indice) => {
        const estado = indice < atual ? "feita" : indice === atual ? "ativa" : "pendente"
        return (
          <li
            key={etapa.titulo}
            aria-current={estado === "ativa" ? "step" : undefined}
            className="relative flex h-12 items-center gap-3.5"
          >
            <Marcador estado={estado} />
            <p
              className={cn(
                "min-w-0 flex-1 truncate text-[15px] transition-colors duration-200",
                estado === "pendente" ? "text-muted-foreground" : "text-foreground",
                estado === "ativa" ? "font-semibold" : "font-medium",
              )}
              style={{ transitionDelay: estado === "ativa" ? `${chegada}s` : undefined }}
            >
              {etapa.titulo}
              {estado === "feita" && <span className="sr-only"> (concluído)</span>}
            </p>
            {estado === "feita" && (
              <span className="text-[13px] text-muted-foreground tabular-nums">
                {horario(momentos[indice])}
              </span>
            )}
            <AnimatePresence initial={false} mode="popLayout">
              {estado === "ativa" && (
                <motion.span
                  key="agora"
                  className="text-[13px] font-medium text-marca-texto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2, delay: chegada }}
                >
                  agora
                </motion.span>
              )}
            </AnimatePresence>
          </li>
        )
      })}
    </ol>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-[15px] leading-snug wrap-anywhere">{children}</dd>
    </div>
  )
}

/** O resumo do pedido como um recibo: itens com a etiqueta, totais entre fios e os combinados. */
function Resumo({ pedido }: { pedido: Pedido }) {
  const forma = pedido.pagamento ? FORMAS_PAGAMENTO[pedido.pagamento] : null
  const retirada = pedido.tipo === "retirada"
  const quantidade = pedido.itens.reduce((soma, item) => soma + item.quantidade, 0)

  return (
    <section aria-labelledby="titulo-resumo">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="titulo-resumo" className="text-[17px] font-semibold tracking-[-0.015em] md:text-lg">
          Seu pedido
        </h2>
        <span className="text-[13px] text-muted-foreground tabular-nums">
          {plural(quantidade, "item", "itens")}
        </span>
      </div>

      <ul className="mt-2 divide-y divide-border/70">
        {pedido.itens.map((item) => (
          <li key={item.chave} className="flex gap-3.5 py-3.5">
            <Foto src={item.imagem} alt="" sizes="56px" className="size-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-snug font-medium tracking-[-0.01em] wrap-anywhere">
                <span className="text-muted-foreground tabular-nums">{item.quantidade}× </span>
                {item.nome}
              </p>
              {item.resumo.length > 0 && (
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {item.resumo.join(" · ")}
                </p>
              )}
              {item.observacao && (
                <p className="mt-0.5 text-[13px] text-muted-foreground">Obs.: {item.observacao}</p>
              )}
              <Preco valor={totalDoItem(item)} className="mt-1.5 text-[15px]" />
            </div>
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-1.5 border-t border-border/70 pt-3.5 text-sm">
        <Linha rotulo="Subtotal">{emReais(pedido.subtotal)}</Linha>
        <Linha rotulo={retirada ? "Retirada" : "Entrega"}>
          {pedido.taxaEntrega > 0 ? emReais(pedido.taxaEntrega) : "Grátis"}
        </Linha>
        <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-border/70 pt-3">
          <dt className="text-[15px] font-semibold">Total</dt>
          <dd>
            <Preco valor={pedido.total} className="text-[17px]" />
          </dd>
        </div>
      </dl>

      <dl className="mt-5 grid gap-4 border-t border-border/70 pt-5 sm:grid-cols-2 lg:grid-cols-1">
        {forma && (
          <Dado rotulo="Pagamento">
            {forma.titulo}
            {pedido.pagamento === "dinheiro" && (
              <span className="block text-muted-foreground">
                {descricaoDoTroco(pedido.troco, pedido.total)}
              </span>
            )}
          </Dado>
        )}
        {pedido.endereco && (
          <Dado rotulo={retirada ? "Retirada no balcão" : "Entrega em"}>{pedido.endereco}</Dado>
        )}
        {pedido.agendamento && (
          <Dado rotulo="Horário marcado">{textoDoHorario(pedido.agendamento.inicio)}</Dado>
        )}
        {pedido.receita && (
          <Dado rotulo="Receita enviada">
            {pedido.receita.retida
              ? `${pedido.receita.arquivo} · tenha a via original em mãos para ${retirada ? "o balcão" : "o entregador"}`
              : `${pedido.receita.arquivo} · conferida pela farmacêutica antes de separar`}
          </Dado>
        )}
        {pedido.observacao && <Dado rotulo="Observação">{pedido.observacao}</Dado>}
      </dl>
    </section>
  )
}

/** O título é a etapa em andamento; a frase embaixo diz o que está acontecendo. Trocam juntos. */
function Status({
  chave,
  titulo,
  texto,
  arte,
}: {
  chave: string
  titulo: string
  texto: string
  /** O desenho da espera ao lado da frase; some quando o pedido termina. */
  arte?: ReactNode
}) {
  const reduzido = useReducedMotion()
  return (
    <div aria-live="polite" className="relative">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={chave}
          initial={{ opacity: 0, y: reduzido ? 0 : 10, filter: reduzido ? "none" : "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "none" }}
          exit={{
            opacity: 0,
            y: reduzido ? 0 : -8,
            filter: reduzido ? "none" : "blur(3px)",
            transition: { duration: 0.18, ease: CURVA },
          }}
          transition={{ duration: 0.32, ease: CURVA }}
        >
          <h1 className="text-[30px] leading-[1.06] font-semibold tracking-[-0.025em] md:text-[44px]">
            {titulo}
          </h1>
          <p className="mt-2 flex items-center gap-2.5 text-[15px] text-muted-foreground md:text-base">
            {arte}
            {texto}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function AvisoAprovado() {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-xl bg-sucesso/10 px-3.5 py-3 text-[15px] font-medium text-sucesso"
    >
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.15, ease: CURVA }}
        />
      </svg>
      Pagamento aprovado! A loja já começou seu pedido.
    </div>
  )
}

function Conteudo({ pedido }: { pedido: Pedido }) {
  const agora = useAgora()
  const reduzido = useReducedMotion()
  const { Carregador } = registroSegmentos[useLoja().segmento]
  const situacao = situacaoDoPedido(pedido, agora)
  const { pago, atual, concluido, atualNaLista, momentos, pagamentoAcabouDeConfirmar, criadoEm } =
    situacao
  const etapas = etapasDoPedido(pedido.tipo)
  const prazo = prazoDoAcompanhamento(pedido, situacao)

  const status = !pago
    ? pedido.pagamento === "pix"
      ? { chave: "pix", titulo: "Aguardando o Pix", texto: "Pague para a loja começar o preparo." }
      : {
          chave: "cartao",
          titulo: "Confirmando o pagamento",
          texto: "Isso leva só alguns segundos.",
        }
    : { chave: `etapa-${atual}`, titulo: etapas[atual].titulo, texto: etapas[atual].texto }
  // Toda espera da loja usa o carregador do nicho. Na rua, quem está trabalhando é o
  // entregador; pronto no balcão ou concluído, a loja não está mais fazendo nada.
  const naRua = pago && atual === 2 && pedido.tipo !== "retirada"
  const esperandoALoja = !pago || atual < 2
  const arte = concluido ? undefined : naRua ? (
    <Motoboy className="-my-2 -ml-2.5 w-16 shrink-0" />
  ) : esperandoALoja ? (
    <Carregador className="size-6" />
  ) : undefined

  // Aviso que entra ou sai do meio da coluna: abre e fecha o espaço junto, sem pular.
  const dobra = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: "auto" },
    exit: {
      opacity: 0,
      height: 0,
      filter: reduzido ? "none" : "blur(4px)",
      transition: { duration: 0.28, ease: CURVA },
    },
    transition: { duration: 0.32, ease: CURVA },
    className: "overflow-hidden",
  }

  return (
    <>
      <TopoPedido>
        <p className="px-1.5 text-[13px] text-muted-foreground tabular-nums">
          Pedido nº {pedido.numero}
        </p>
      </TopoPedido>

      <div className="mx-auto grid w-full max-w-[1120px] gap-x-16 px-4 pt-7 pb-14 md:px-6 md:pt-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col">
          <Entrada duracao={0.5}>
            <Status {...status} arte={arte} />
          </Entrada>

          <Entrada atraso={0.05} duracao={0.5} className="mt-6 md:mt-8">
            <Regua
              fatos={[
                prazo,
                { rotulo: "Feito às", valor: horario(criadoEm) },
                { rotulo: "Total", valor: emReais(pedido.total) },
              ]}
            />
          </Entrada>

          <AnimatePresence initial={false}>
            {!pago && pedido.pagamento === "pix" ? (
              <motion.div key="pix" {...dobra}>
                <div className="pt-7">
                  <BlocoPix pedido={pedido} agora={agora} />
                </div>
              </motion.div>
            ) : pagamentoAcabouDeConfirmar ? (
              <motion.div key="aprovado" {...dobra}>
                <div className="pt-7">
                  <AvisoAprovado />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <Entrada atraso={0.09} duracao={0.5} className="mt-8 md:mt-10">
            <section aria-labelledby="titulo-andamento">
              <h2
                id="titulo-andamento"
                className="mb-1 text-[17px] font-semibold tracking-[-0.015em] md:text-lg"
              >
                Andamento
              </h2>
              <LinhaDoTempo etapas={etapas} atual={pago ? atualNaLista : -1} momentos={momentos} />
            </section>
          </Entrada>

          <Entrada
            atraso={0.14}
            duracao={0.5}
            className="mt-8 flex flex-col gap-2.5 sm:flex-row md:mt-10"
          >
            <Button asChild size="cta" className="sm:px-6">
              <Link href="/whatsapp">
                <MessageCircleIcon data-icon="inline-start" />
                Falar com a loja no WhatsApp
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-full px-6 text-base font-semibold"
            >
              <Link href="/">Fazer novo pedido</Link>
            </Button>
          </Entrada>
        </div>

        <Entrada
          atraso={0.12}
          duracao={0.5}
          className="mt-10 border-t border-border/70 pt-8 lg:sticky lg:top-8 lg:row-span-2 lg:mt-0 lg:self-start lg:rounded-2xl lg:border lg:p-6"
        >
          <Resumo pedido={pedido} />
        </Entrada>

        <p className="mt-10 flex gap-2 text-[13px] text-muted-foreground lg:col-start-1 lg:row-start-2">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Protótipo: o pagamento e o andamento avançam sozinhos para mostrar o fluxo.
        </p>
      </div>
    </>
  )
}

/** Sem pedido neste aparelho: o desenho do nicho e os dois caminhos, pedir ou procurar. */
function SemPedido() {
  const { Carregador } = registroSegmentos[useLoja().segmento]
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <TopoPedido />
      <Entrada
        duracao={0.5}
        className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4 pb-24 text-center"
      >
        <Carregador className="size-12" />
        <div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em]">
            Nenhum pedido por aqui
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Monte um pedido no cardápio ou procure um que você já fez, pelo celular.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2.5">
          <Button asChild size="cta">
            <Link href="/">Ver cardápio</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 rounded-full px-6 text-base font-semibold"
          >
            <Link href="/pedidos">Buscar pelo celular</Link>
          </Button>
        </div>
      </Entrada>
    </main>
  )
}

/** Acompanhamento do pedido, como a página `/pedido/{token}` do site atual. */
export function Acompanhamento() {
  const pedido = useSacola((estado) => estado.ultimoPedido)
  const hidratada = useSacola((estado) => estado.hidratada)

  if (!hidratada) return <main className="min-h-dvh bg-background" />

  if (!pedido) return <SemPedido />

  return (
    <main className="min-h-dvh bg-background">
      <Conteudo key={pedido.numero} pedido={pedido} />
    </main>
  )
}
