"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import NumberFlow from "@number-flow/react"
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon, SendIcon, ShoppingBagIcon } from "lucide-react"
import { AnimatePresence, motion, useAnimationControls } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { type FieldErrors, FormProvider, useForm, useWatch } from "react-hook-form"
import { AlternarTema } from "@/components/alternar-tema"
import { Dica } from "@/components/dica"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { duracaoDaSacola } from "@/lib/agendar"
import {
  CAMPOS_DO_PASSO,
  type DadosCheckout,
  dadosDoPedido,
  dadosParaLembrar,
  esquemaCheckout,
  taxaDaEntrega,
  valoresIniciais,
} from "@/lib/checkout"
import { receitaDaSacola } from "@/lib/farmacia"
import { emReais, formatoMoeda } from "@/lib/formato"
import { vibrar } from "@/lib/haptico"
import { useLoja } from "@/lib/loja-atual"
import { calcularSubtotal, type DadosLembrados, faltaParaMinimo, useSacola } from "@/lib/sacola"
import { AnexarReceita, type ReceitaAnexada } from "./anexar-receita"
import { CarregamentoEnvio, DURACAO_ENVIO_MS } from "./carregamento-envio"
import { PassoDados } from "./passo-dados"
import { PassoEntrega } from "./passo-entrega"
import { PassoHorario } from "./passo-horario"
import { PassoPagamento } from "./passo-pagamento"
import { PassoRevisao } from "./passo-revisao"
import { PASSOS, type PassoId, Passos } from "./passos"
import { ResumoCompacto, ResumoLateral } from "./resumo-pedido"

const CURVA = [0.23, 1, 0.32, 1] as const
const TREMOR = { x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.32 } }

function Cabecalho() {
  const lojaEscolhida = useLoja()
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-2 px-2 md:px-6">
        <Dica texto="Voltar ao cardápio">
          <Button asChild variant="ghost" size="toque" className="rounded-full">
            <Link href="/" aria-label="Voltar ao cardápio">
              <ArrowLeftIcon />
            </Link>
          </Button>
        </Dica>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg leading-tight font-extrabold tracking-tight md:text-xl">
            Finalizar pedido
          </h1>
          <p className="truncate text-sm text-muted-foreground">{lojaEscolhida.nome}</p>
        </div>
        <AlternarTema />
        <span className="relative mr-2 size-10 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-border">
          <Image src={lojaEscolhida.logo} alt="" fill sizes="40px" />
        </span>
      </div>
    </header>
  )
}

function SacolaVazia({ falta }: { falta: number }) {
  return (
    <Empty className="min-h-[60dvh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShoppingBagIcon />
        </EmptyMedia>
        <EmptyTitle>
          {falta > 0 ? "Falta pouco para o pedido mínimo" : "Sua sacola está vazia"}
        </EmptyTitle>
        <EmptyDescription>
          {falta > 0
            ? `Adicione mais ${emReais(falta)} para finalizar.`
            : "Escolha algo do cardápio para fazer o pedido."}
        </EmptyDescription>
      </EmptyHeader>
      <Button asChild size="cta">
        <Link href="/">Ver cardápio</Link>
      </Button>
    </Empty>
  )
}

function FormularioCheckout({ lembrados }: { lembrados: DadosLembrados | null }) {
  const lojaEscolhida = useLoja()
  const router = useRouter()
  const itens = useSacola((estado) => estado.itens)
  const finalizar = useSacola((estado) => estado.finalizar)
  const tremor = useAnimationControls()
  const refConteudo = useRef<HTMLDivElement>(null)
  const [passo, setPasso] = useState(0)
  const [alcancado, setAlcancado] = useState(0)
  const [direcao, setDirecao] = useState(1)
  const [enviando, setEnviando] = useState(false)
  // Os itens são guardados no envio: a sacola esvazia ao final, mas a arte do envio não muda.
  const [itensEnviados, setItensEnviados] = useState<typeof itens>([])
  // Farmácia: a foto da receita, quando a sacola tem remédio de tarja vermelha.
  const exigida = receitaDaSacola(itens)
  const [receita, setReceita] = useState<ReceitaAnexada | null>(null)
  const [semReceita, setSemReceita] = useState(false)

  const formulario = useForm<DadosCheckout>({
    resolver: zodResolver(esquemaCheckout),
    defaultValues: valoresIniciais(lembrados),
    mode: "onTouched",
  })
  const { control, trigger, setValue, handleSubmit } = formulario
  const tipo = useWatch({ control, name: "tipo" })
  const bairro = useWatch({ control, name: "bairro" })

  const subtotal = calcularSubtotal(itens)
  const retirada = tipo === "retirada"
  const taxa = taxaDaEntrega(tipo, bairro)
  const total = subtotal + (taxa ?? 0)
  const ultimo = passo === PASSOS.length - 1

  // O troco é conferido contra o total do momento.
  useEffect(() => {
    setValue("total", total)
  }, [total, setValue])

  // A cada troca de passo, o título recebe o foco e a tela volta para o começo do passo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: o efeito existe para rodar a cada troca de passo.
  useEffect(() => {
    const titulo = refConteudo.current?.querySelector<HTMLElement>("[data-titulo-passo]")
    if (!titulo) return
    const espera = setTimeout(() => titulo.focus({ preventScroll: true }), 260)
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "smooth" })
    return () => clearTimeout(espera)
  }, [passo])

  function irPara(indice: number) {
    if (indice === passo || indice > alcancado) return
    setDirecao(indice > passo ? 1 : -1)
    setPasso(indice)
  }

  function irParaId(id: PassoId) {
    irPara(PASSOS.findIndex((item) => item.id === id))
  }

  function avisarErro() {
    vibrar(20)
    void tremor.start(TREMOR)
  }

  async function avancar() {
    const campos = CAMPOS_DO_PASSO[PASSOS[passo].id]
    const valido = await trigger(campos, { shouldFocus: true })
    if (!valido) {
      avisarErro()
      return
    }
    vibrar()
    const proximo = passo + 1
    setDirecao(1)
    setPasso(proximo)
    setAlcancado((atual) => Math.max(atual, proximo))
  }

  function enviar(dados: DadosCheckout) {
    // Um toque a mais durante o envio não manda o pedido duas vezes.
    if (enviando) return
    if (!lojaEscolhida.status.aberta) {
      avisarErro()
      return
    }
    if (exigida && !receita) {
      setSemReceita(true)
      avisarErro()
      return
    }
    vibrar()
    setItensEnviados(itens)
    setEnviando(true)
    router.prefetch("/pedido")
    window.setTimeout(() => {
      finalizar(
        {
          ...dadosDoPedido(dados, taxa),
          ...(exigida && receita
            ? { receita: { arquivo: receita.nome, retida: exigida.retida } }
            : {}),
          ...(dados.agendamento
            ? { agendamento: { inicio: dados.agendamento, duracaoMin: duracaoDaSacola(itens) } }
            : {}),
        },
        dadosParaLembrar(dados),
      )
      router.push("/pedido")
    }, DURACAO_ENVIO_MS)
  }

  /** Algum erro em outro passo: volta direto para ele. */
  function aoFalhar(erros: FieldErrors<DadosCheckout>) {
    const indice = PASSOS.findIndex(({ id }) => CAMPOS_DO_PASSO[id].some((campo) => campo in erros))
    if (indice >= 0 && indice !== passo) {
      setDirecao(-1)
      setPasso(indice)
    }
    avisarErro()
  }

  const rotuloAcao = enviando ? "Enviando…" : ultimo ? "Enviar pedido" : "Continuar"
  const iconeEnvio = enviando ? <Loader2Icon className="animate-spin" /> : <SendIcon />
  const valores = { itens, subtotal, taxa, total, retirada }

  return (
    <FormProvider {...formulario}>
      <div className="mx-auto w-full max-w-[1180px] px-4 pt-4 pb-36 md:px-6 md:pt-8 md:pb-16 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <Passos
            atual={passo}
            alcancado={alcancado}
            aoIr={irPara}
            rotulos={lojaEscolhida.segmento === "salao" ? { entrega: "Horário" } : undefined}
          />
          <ResumoCompacto {...valores} />

          <form
            id="formulario-checkout"
            noValidate
            onSubmit={(evento) => {
              evento.preventDefault()
              if (ultimo) void handleSubmit(enviar, aoFalhar)(evento)
              else void avancar()
            }}
            // `overflow-clip` corta o deslize entre passos sem impedir as ações de grudarem embaixo.
            className="sombra-flutuante relative overflow-clip rounded-3xl bg-card"
          >
            <div ref={refConteudo} className="relative p-4 md:p-7">
              <AnimatePresence mode="wait" initial={false} custom={direcao}>
                <motion.div
                  key={PASSOS[passo].id}
                  custom={direcao}
                  initial={{ opacity: 0, x: direcao * 36, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: direcao * -36, filter: "blur(4px)" }}
                  transition={{ duration: 0.24, ease: CURVA }}
                >
                  {PASSOS[passo].id === "dados" && <PassoDados lembrado={Boolean(lembrados)} />}
                  {PASSOS[passo].id === "entrega" &&
                    (lojaEscolhida.segmento === "salao" ? <PassoHorario /> : <PassoEntrega />)}
                  {PASSOS[passo].id === "pagamento" && <PassoPagamento total={total} />}
                  {PASSOS[passo].id === "revisao" && (
                    <div className="flex flex-col gap-5">
                      {exigida && (
                        <AnexarReceita
                          exigida={exigida}
                          receita={receita}
                          aoMudar={setReceita}
                          invalida={semReceita}
                        />
                      )}
                      <PassoRevisao total={total} aoIr={irParaId} />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* No tablet e no computador, as ações ficam no fim do cartão. */}
            <div className="sticky bottom-0 z-10 hidden items-center justify-between gap-3 rounded-b-3xl border-t bg-card/90 px-7 py-4 backdrop-blur-xl md:flex">
              {passo > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 rounded-full px-4 text-base font-semibold"
                  onClick={() => irPara(passo - 1)}
                >
                  <ArrowLeftIcon data-icon="inline-start" />
                  Voltar
                </Button>
              ) : (
                <span />
              )}
              <motion.div animate={tremor}>
                <Button
                  type="submit"
                  size="cta"
                  className="min-w-56 justify-between gap-4"
                  data-testid="acao-checkout"
                  aria-busy={enviando || undefined}
                >
                  <span>{rotuloAcao}</span>
                  {ultimo ? (
                    <span className="flex items-center gap-2 tabular-nums">
                      <NumberFlow
                        value={total}
                        locales="pt-BR"
                        format={formatoMoeda}
                        aria-hidden="true"
                      />
                      <span className="sr-only">{emReais(total)}</span>
                      {iconeEnvio}
                    </span>
                  ) : (
                    <ArrowRightIcon />
                  )}
                </Button>
              </motion.div>
            </div>
          </form>
        </div>

        <ResumoLateral {...valores} />
      </div>

      {/* No celular, a ação fica na área do polegar. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-[640px] items-center gap-3">
          {passo > 0 && (
            <Dica texto="Passo anterior" lado="top">
              <Button
                type="button"
                variant="secondary"
                size="toque"
                className="size-12 shrink-0 rounded-full"
                aria-label="Voltar ao passo anterior"
                onClick={() => irPara(passo - 1)}
              >
                <ArrowLeftIcon />
              </Button>
            </Dica>
          )}
          <motion.div animate={tremor} className="min-w-0 flex-1">
            <Button
              type="submit"
              form="formulario-checkout"
              size="cta"
              className="w-full justify-between"
              data-testid="acao-checkout-celular"
              aria-busy={enviando || undefined}
            >
              <span>{rotuloAcao}</span>
              <span className="flex items-center gap-2 tabular-nums">
                <NumberFlow
                  value={total}
                  locales="pt-BR"
                  format={formatoMoeda}
                  aria-hidden="true"
                />
                <span className="sr-only">{emReais(total)}</span>
                {ultimo ? iconeEnvio : <ArrowRightIcon />}
              </span>
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Envio temático de 5 segundos: na pizzaria, a pizza é montada e vai ao forno. */}
      <AnimatePresence>
        {enviando && <CarregamentoEnvio key="envio" itens={itensEnviados} />}
      </AnimatePresence>
    </FormProvider>
  )
}

/** Checkout em quatro passos curtos, com o pedido sempre à vista. */
export function Finalizar() {
  const lojaEscolhida = useLoja()
  const hidratada = useSacola((estado) => estado.hidratada)
  const subtotal = useSacola((estado) => calcularSubtotal(estado.itens))
  const lembrados = useSacola((estado) => estado.dadosLembrados)
  const falta = faltaParaMinimo(subtotal, lojaEscolhida.pedidoMinimo)
  const pode = subtotal > 0 && falta === 0
  // Depois de enviar, a sacola esvazia; a tela de envio não pode virar "sacola vazia".
  const [jaPodia, setJaPodia] = useState(false)

  useEffect(() => {
    if (hidratada && pode) setJaPodia(true)
  }, [hidratada, pode])

  return (
    <div className="min-h-dvh bg-background">
      <Cabecalho />
      {!hidratada ? null : !pode && !jaPodia ? (
        <SacolaVazia falta={subtotal > 0 ? falta : 0} />
      ) : (
        <FormularioCheckout lembrados={lembrados} />
      )}
    </div>
  )
}
