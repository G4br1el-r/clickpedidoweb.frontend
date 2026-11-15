"use client"

import { ArrowRightIcon, ChevronRightIcon, MessageCircleIcon, PhoneIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useRouter } from "next/navigation"
import { type FormEvent, useEffect, useRef, useState } from "react"
import { PatternFormat } from "react-number-format"
import { Entrada } from "@/components/entrada"
import { registroSegmentos } from "@/components/segmentos/registro"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { plural } from "@/lib/formato"
import { vibrar } from "@/lib/haptico"
import { useLoja } from "@/lib/loja-atual"
import { horario } from "@/lib/pedido"
import { type Pedido, pedidosDoCelular, useSacola } from "@/lib/sacola"
import { Preco } from "./preco"
import { TopoPedido } from "./topo-pedido"

/** A busca é local e instantânea; a pausa curta, com o carregador do nicho, diz que algo foi procurado. */
const BUSCA_MS = 900
/** Com um pedido só, ele aparece na lista e abre sozinho logo depois: a pessoa vê o que achou. */
const ABRIR_MS = 500
const CURVA = [0.23, 1, 0.32, 1] as const
/** Escalonamento da lista: curto e encolhendo, para o grupo chegar junto. */
const ATRASOS = [0, 0.05, 0.09, 0.12, 0.14]

type Fase = "parado" | "buscando" | "achou" | "nada"

const quando = (momento?: number) =>
  momento
    ? `${new Date(momento).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${horario(momento)}`
    : "Pedido anterior"

function LinhaPedido({
  pedido,
  indice,
  aoAbrir,
}: {
  pedido: Pedido
  indice: number
  aoAbrir: () => void
}) {
  const reduzido = useReducedMotion()
  const itens = pedido.itens.reduce((soma, item) => soma + item.quantidade, 0)
  return (
    <motion.li
      initial={{ opacity: 0, y: reduzido ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        ease: CURVA,
        delay: ATRASOS[Math.min(indice, ATRASOS.length - 1)],
      }}
    >
      <button
        type="button"
        onClick={aoAbrir}
        className="group/linha flex w-full items-center gap-4 rounded-xl py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-[-0.01em]">
            Pedido nº <span className="tabular-nums">{pedido.numero}</span>
          </span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground tabular-nums">
            {quando(pedido.criadoEm)} · {plural(itens, "item", "itens")}
          </span>
        </span>
        <Preco valor={pedido.total} className="text-[15px]" />
        <ChevronRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-saida group-hover/linha:translate-x-0.5"
        />
      </button>
    </motion.li>
  )
}

/**
 * Acompanhe seu pedido: a pessoa informa o celular usado no pedido e cai direto no
 * acompanhamento. Com mais de um pedido no mesmo número, escolhe qual ver.
 */
export function BuscarPedidos() {
  const loja = useLoja()
  const { Carregador } = registroSegmentos[loja.segmento]
  const router = useRouter()
  const reduzido = useReducedMotion()
  const hidratada = useSacola((estado) => estado.hidratada)
  const lembrado = useSacola((estado) => estado.dadosLembrados?.whatsapp)
  const verPedido = useSacola((estado) => estado.verPedido)
  const [celular, setCelular] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [fase, setFase] = useState<Fase>("parado")
  const [achados, setAchados] = useState<Pedido[]>([])
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Com um pedido só, o botão segue ocupado até abrir o acompanhamento.
  const buscando = fase === "buscando" || (fase === "achou" && achados.length === 1)

  // Quem já pediu neste aparelho encontra o número preenchido.
  useEffect(() => {
    if (hidratada && lembrado) setCelular((atual) => atual || lembrado)
  }, [hidratada, lembrado])

  useEffect(
    () => () => {
      if (espera.current) clearTimeout(espera.current)
    },
    [],
  )

  function abrir(pedido: Pedido) {
    if (espera.current) clearTimeout(espera.current)
    vibrar()
    verPedido(pedido.numero)
    router.push("/pedido")
  }

  function buscar(evento: FormEvent) {
    evento.preventDefault()
    if (celular.replace(/\D/g, "").length < 11) {
      setErro("Digite o celular com DDD, como no pedido.")
      vibrar(20)
      return
    }
    setErro(null)
    setFase("buscando")
    setAchados([])
    espera.current = setTimeout(() => {
      const pedidos = pedidosDoCelular(celular)
      setAchados(pedidos)
      setFase(pedidos.length ? "achou" : "nada")
      if (pedidos.length === 1) espera.current = setTimeout(() => abrir(pedidos[0]), ABRIR_MS)
    }, BUSCA_MS)
  }

  const troca = {
    initial: { opacity: 0, y: reduzido ? 0 : 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, transition: { duration: 0.14 } },
    transition: { duration: 0.24, ease: CURVA },
  }

  return (
    <main className="min-h-dvh bg-background">
      <TopoPedido />

      <div className="mx-auto w-full max-w-[560px] px-4 pt-8 pb-16 md:pt-16">
        <Entrada duracao={0.5}>
          <h1 className="text-[30px] leading-[1.06] font-semibold tracking-[-0.025em] md:text-[40px]">
            Acompanhe seu pedido
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground md:text-base">
            Informe o celular usado no pedido para ver em que etapa ele está.
          </p>
        </Entrada>

        <Entrada atraso={0.06} duracao={0.5} className="mt-7 md:mt-9">
          <form onSubmit={buscar} noValidate>
            <Field data-invalid={erro ? true : undefined}>
              <FieldLabel htmlFor="celular-pedido">Celular (WhatsApp)</FieldLabel>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <InputGroup className="h-12 rounded-xl sm:flex-1">
                  <InputGroupAddon className="pl-3.5">
                    <PhoneIcon />
                  </InputGroupAddon>
                  <PatternFormat
                    id="celular-pedido"
                    value={celular}
                    onValueChange={({ formattedValue }) => {
                      setCelular(formattedValue)
                      if (erro) setErro(null)
                    }}
                    format="(##) #####-####"
                    mask="_"
                    customInput={InputGroupInput}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="(12) 99999-9999"
                    aria-invalid={erro ? true : undefined}
                    className="text-base tabular-nums"
                    data-testid="celular-pedido"
                  />
                </InputGroup>
                <Button type="submit" size="cta" className="sm:min-w-44" disabled={buscando}>
                  {buscando ? (
                    "Procurando…"
                  ) : (
                    <>
                      Ver meu pedido
                      <ArrowRightIcon data-icon="inline-end" />
                    </>
                  )}
                </Button>
              </div>
              {erro ? (
                <FieldError>{erro}</FieldError>
              ) : (
                <FieldDescription>O mesmo número que você informou ao finalizar.</FieldDescription>
              )}
            </Field>
          </form>
        </Entrada>

        <div aria-live="polite" className="relative mt-8">
          <AnimatePresence initial={false} mode="popLayout">
            {fase === "buscando" && (
              <motion.div
                key="buscando"
                role="status"
                aria-label="Procurando seus pedidos"
                className="flex items-center gap-3 border-t border-border/70 pt-6 text-[15px] text-muted-foreground"
                {...troca}
              >
                <Carregador className="size-7" />
                Procurando seus pedidos…
              </motion.div>
            )}

            {fase === "nada" && (
              <motion.div
                key="nada"
                data-testid="sem-pedidos"
                className="flex flex-col items-start border-t border-border/70 pt-6"
                {...troca}
              >
                <Carregador className="size-10" />
                <p className="mt-4 text-[17px] font-semibold tracking-[-0.015em]">
                  Nenhum pedido com este celular
                </p>
                <p className="mt-1 text-[15px] text-muted-foreground">
                  Confira o número ou fale com a loja pelo WhatsApp.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-4 h-11 gap-2 rounded-full px-4 text-[15px] tabular-nums"
                >
                  <a
                    href={`https://wa.me/55${loja.telefone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircleIcon data-icon="inline-start" />
                    {loja.telefone}
                  </a>
                </Button>
              </motion.div>
            )}

            {fase === "achou" && (
              <motion.div key="lista" {...troca} transition={{ duration: 0.2 }}>
                <p className="text-[13px] text-muted-foreground">
                  {plural(achados.length, "pedido encontrado", "pedidos encontrados")}
                </p>
                <ul
                  data-testid="lista-pedidos"
                  className="mt-2 divide-y divide-border/70 border-y border-border/70"
                >
                  {achados.map((pedido, indice) => (
                    <LinhaPedido
                      key={pedido.numero}
                      pedido={pedido}
                      indice={indice}
                      aoAbrir={() => abrir(pedido)}
                    />
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  )
}
