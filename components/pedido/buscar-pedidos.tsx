"use client"

import {
  ArrowLeftIcon,
  BikeIcon,
  ChefHatIcon,
  ChevronRightIcon,
  ClockIcon,
  MessageCircleIcon,
  PartyPopperIcon,
  PhoneIcon,
  ReceiptTextIcon,
  SearchXIcon,
} from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react"
import { PatternFormat } from "react-number-format"
import { AlternarTema } from "@/components/alternar-tema"
import { Dica } from "@/components/dica"
import { Entrada } from "@/components/entrada"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { emReais, plural } from "@/lib/formato"
import { vibrar } from "@/lib/haptico"
import { useLoja } from "@/lib/loja-atual"
import { type Pedido, pedidosDoCelular, useSacola } from "@/lib/sacola"
import { type SegmentoId, textosDoSegmento } from "@/lib/segmentos"
import { cn } from "@/lib/utils"
import { type FaseEntrega, MapaEntrega } from "./mapa-entrega"

/** Tempo da moto acelerando antes do resultado: dá a sensação de busca sem fazer esperar. */
const BUSCA_MS = 1400
/** Com um pedido só, o entregador chega na porta e só então abre o acompanhamento. */
const CHEGADA_MS = 650
const CURVA = [0.23, 1, 0.32, 1] as const

type Resultado = { tipo: "inicio" } | { tipo: "lista"; pedidos: Pedido[] } | { tipo: "nada" }

/** As etapas do acompanhamento, com o preparo e o fim no jeito do segmento. */
function etapasDe(segmento: SegmentoId): { titulo: string; texto: string; icone: ReactNode }[] {
  const textos = textosDoSegmento(segmento)
  return [
    { titulo: "Recebido", texto: "A loja confirma o pedido", icone: <ReceiptTextIcon /> },
    { ...textos.preparoCurto, icone: <ChefHatIcon /> },
    { titulo: "A caminho", texto: "O entregador saiu", icone: <BikeIcon /> },
    { titulo: "Entregue", texto: textos.fimCurto, icone: <PartyPopperIcon /> },
  ]
}

const quando = (momento?: number) =>
  momento
    ? new Date(momento).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Pedido anterior"

/** As etapas que a pessoa vai ver no acompanhamento, acendendo uma de cada vez. */
function Etapas() {
  const ETAPAS = etapasDe(useLoja().segmento)
  const reduzido = useReducedMotion()
  const [ativa, setAtiva] = useState(0)
  const total = ETAPAS.length

  useEffect(() => {
    if (reduzido) return
    const relogio = setInterval(() => setAtiva((atual) => (atual + 1) % total), 1800)
    return () => clearInterval(relogio)
  }, [reduzido, total])

  return (
    <section aria-labelledby="titulo-etapas" className="flex flex-col gap-4">
      <h2 id="titulo-etapas" className="text-center text-sm font-semibold text-muted-foreground">
        No acompanhamento, você vê cada etapa
      </h2>
      <ol className="relative grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {/* Fio que liga as etapas, enchendo até a etapa acesa. */}
        <span
          aria-hidden="true"
          className="absolute top-7 right-[12.5%] left-[12.5%] hidden h-0.5 rounded-full bg-border md:block"
        >
          <motion.span
            className="block h-full rounded-full bg-primary"
            animate={{ width: `${(ativa / (ETAPAS.length - 1)) * 100}%` }}
            transition={{ duration: 0.6, ease: CURVA }}
          />
        </span>
        {ETAPAS.map((etapa, indice) => {
          const acesa = indice <= ativa
          return (
            <li
              key={etapa.titulo}
              className="relative flex flex-col items-center gap-2 text-center"
            >
              <span
                className={cn(
                  "relative grid size-14 place-items-center rounded-2xl ring-1 transition-[background-color,color,box-shadow] duration-500 [&_svg]:size-6",
                  acesa
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-primary"
                    : "bg-card text-muted-foreground ring-border",
                )}
              >
                {indice === ativa && (
                  <motion.span
                    layoutId="etapa-acesa"
                    aria-hidden="true"
                    className="absolute -inset-1.5 rounded-[1.25rem] ring-2 ring-primary/30"
                    transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
                  />
                )}
                {etapa.icone}
              </span>
              <span className="text-sm font-semibold">{etapa.titulo}</span>
              <span className="-mt-1.5 text-xs text-muted-foreground">{etapa.texto}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/**
 * Acompanhe seu pedido: a pessoa informa o celular usado no pedido e cai direto no
 * acompanhamento. Com mais de um pedido no mesmo número, escolhe qual ver.
 */
export function BuscarPedidos() {
  const lojaEscolhida = useLoja()
  const router = useRouter()
  const hidratada = useSacola((estado) => estado.hidratada)
  const lembrado = useSacola((estado) => estado.dadosLembrados?.whatsapp)
  const verPedido = useSacola((estado) => estado.verPedido)
  const [celular, setCelular] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [fase, setFase] = useState<FaseEntrega>("parado")
  const [resultado, setResultado] = useState<Resultado>({ tipo: "inicio" })
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Com um pedido só, o botão segue ocupado até abrir o acompanhamento.
  const buscando = fase === "buscando" || (fase === "achou" && resultado.tipo === "inicio")

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
    setResultado({ tipo: "inicio" })
    espera.current = setTimeout(() => {
      const pedidos = pedidosDoCelular(celular)
      if (pedidos.length === 1) {
        setFase("achou")
        espera.current = setTimeout(() => abrir(pedidos[0]), CHEGADA_MS)
        return
      }
      setFase(pedidos.length ? "achou" : "nada")
      setResultado(pedidos.length ? { tipo: "lista", pedidos } : { tipo: "nada" })
    }, BUSCA_MS)
  }

  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-[1180px] items-center gap-2 px-4 py-3 md:px-6">
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
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{lojaEscolhida.nome}</p>
          <AlternarTema />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1180px] flex-col px-4 pt-4 pb-14 md:px-6 md:pt-8">
        <Entrada atraso={0} duracao={0.8}>
          <MapaEntrega fase={fase}>
            <div className="flex max-w-xl flex-col items-start gap-3">
              <Badge className="border-white/20 bg-white/12 text-white backdrop-blur-md">
                <ClockIcon data-icon="inline-start" />
                Entrega em {lojaEscolhida.entrega.tempo}
              </Badge>
              <h1 className="font-heading text-[2rem] leading-[1.05] font-extrabold tracking-tight text-balance md:text-5xl">
                Acompanhe seu pedido
              </h1>
              <p className="max-w-[42ch] text-sm text-white/80 md:text-base">
                Informe o celular usado no pedido e siga cada etapa, do forno até a sua porta.
              </p>
            </div>
          </MapaEntrega>
        </Entrada>

        {/* O cartão do celular sobe sobre a borda do mapa. */}
        <Entrada atraso={0.15} duracao={0.8} className="relative z-10 -mt-10 md:-mt-14">
          <Card className="mx-auto w-full max-w-2xl rounded-3xl shadow-xl shadow-black/10">
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={buscar} noValidate>
                <Field data-invalid={erro ? true : undefined}>
                  <FieldLabel htmlFor="celular-pedido">Celular (WhatsApp)</FieldLabel>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <InputGroup className="h-12 rounded-xl bg-background sm:flex-1">
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
                        className="text-base"
                        data-testid="celular-pedido"
                      />
                    </InputGroup>
                    <Button type="submit" size="cta" className="sm:w-auto" disabled={buscando}>
                      {buscando ? (
                        <>
                          <Spinner data-icon="inline-start" aria-hidden="true" />
                          Procurando…
                        </>
                      ) : (
                        <>
                          <BikeIcon data-icon="inline-start" />
                          Ver meu pedido
                        </>
                      )}
                    </Button>
                  </div>
                  {erro ? (
                    <FieldError>{erro}</FieldError>
                  ) : (
                    <FieldDescription>
                      O mesmo número que você informou ao finalizar.
                    </FieldDescription>
                  )}
                </Field>
              </form>

              <div aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  {resultado.tipo === "nada" && (
                    <motion.div
                      key="nada"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35, ease: CURVA }}
                      className="overflow-hidden"
                    >
                      <Alert data-testid="sem-pedidos">
                        <SearchXIcon />
                        <AlertTitle>Nenhum pedido com este celular</AlertTitle>
                        <AlertDescription>
                          <p>Confira o número ou fale com a loja pelo WhatsApp.</p>
                          <Button
                            asChild
                            variant="outline"
                            size="toque"
                            className="mt-2 w-auto px-4"
                          >
                            <a
                              href={`https://wa.me/55${lojaEscolhida.telefone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircleIcon data-icon="inline-start" />
                              {lojaEscolhida.telefone}
                            </a>
                          </Button>
                        </AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                  {resultado.tipo === "lista" && (
                    <motion.div
                      key="lista"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35, ease: CURVA }}
                      className="flex flex-col gap-2 overflow-hidden"
                    >
                      <p className="text-sm font-semibold">
                        {plural(
                          resultado.pedidos.length,
                          "pedido encontrado",
                          "pedidos encontrados",
                        )}
                      </p>
                      <ItemGroup className="gap-2" data-testid="lista-pedidos">
                        {resultado.pedidos.map((pedido, indice) => (
                          <motion.div
                            key={pedido.numero}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: CURVA, delay: 0.1 + indice * 0.06 }}
                          >
                            <Item
                              asChild
                              variant="outline"
                              className="rounded-2xl bg-background hover:bg-muted"
                            >
                              <button
                                type="button"
                                onClick={() => abrir(pedido)}
                                className="text-left"
                              >
                                <ItemMedia className="size-11 rounded-full bg-accent text-marca-texto">
                                  <BikeIcon className="size-5" />
                                </ItemMedia>
                                <ItemContent>
                                  <ItemTitle>Pedido nº {pedido.numero}</ItemTitle>
                                  <ItemDescription>
                                    {quando(pedido.criadoEm)} ·{" "}
                                    {plural(
                                      pedido.itens.reduce(
                                        (soma, item) => soma + item.quantidade,
                                        0,
                                      ),
                                      "item",
                                      "itens",
                                    )}{" "}
                                    · {emReais(pedido.total)}
                                  </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                                </ItemActions>
                              </button>
                            </Item>
                          </motion.div>
                        ))}
                      </ItemGroup>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </Entrada>

        <Entrada atraso={0.3} duracao={0.8} className="mt-10 md:mt-14">
          <Etapas />
        </Entrada>
      </div>
    </main>
  )
}
