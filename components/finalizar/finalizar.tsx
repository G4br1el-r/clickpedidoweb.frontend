"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, ShoppingBagIcon } from "lucide-react"
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { type FieldErrors, FormProvider, useForm, useWatch } from "react-hook-form"
import { AlternarTema } from "@/components/alternar-tema"
import { Dica } from "@/components/dica"
import { registroSegmentos } from "@/components/segmentos/registro"
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
import { emReais } from "@/lib/formato"
import { vibrar } from "@/lib/haptico"
import { useLoja } from "@/lib/loja-atual"
import { calcularSubtotal, type DadosLembrados, faltaParaMinimo, useSacola } from "@/lib/sacola"
import { textosDoSegmento } from "@/lib/segmentos"
import { AcaoCheckout } from "./acao-checkout"
import { AnexarReceita, type ReceitaAnexada } from "./anexar-receita"
import { CarregamentoEnvio, DURACAO_ENVIO_MS } from "./carregamento-envio"
import { CURVA_SAIDA, retornoDeErro, variantesDoPasso } from "./movimento"
import { PassoDados } from "./passo-dados"
import { PassoEntrega } from "./passo-entrega"
import { PassoHorario } from "./passo-horario"
import { PassoPagamento } from "./passo-pagamento"
import { PassoRevisao } from "./passo-revisao"
import { PASSOS, type PassoId, Passos } from "./passos"
import { ResumoCompacto, ResumoLateral } from "./resumo-pedido"

function Cabecalho() {
  const lojaEscolhida = useLoja()
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-2 px-2 md:px-6">
        <Dica texto="Voltar ao cardápio">
          <Button asChild variant="ghost" size="toque" className="rounded-full">
            <Link href="/" aria-label="Voltar ao cardápio">
              <ArrowLeftIcon />
            </Link>
          </Button>
        </Dica>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] leading-tight font-semibold tracking-[-0.015em] md:text-lg">
            Finalizar pedido
          </h1>
          <p className="truncate text-[13px] text-muted-foreground">{lojaEscolhida.nome}</p>
        </div>
        <AlternarTema />
        <span className="relative mr-2 size-9 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-border/70">
          <Image src={lojaEscolhida.logo} alt="" fill sizes="36px" />
        </span>
      </div>
    </header>
  )
}

/** Enquanto a sacola é lida do aparelho: o carregador do nicho e a frase do ofício. */
function Esperando() {
  const { segmento } = useLoja()
  const { Carregador } = registroSegmentos[segmento]
  const { carregando } = textosDoSegmento(segmento)
  return (
    <div role="status" aria-label={carregando} className="grid min-h-[60dvh] place-items-center">
      <p className="flex items-center gap-2.5 text-[15px] font-medium text-muted-foreground">
        <Carregador className="size-7" />
        {carregando}
      </p>
    </div>
  )
}

function SacolaVazia({ falta }: { falta: number }) {
  return (
    <Empty className="min-h-[60dvh] gap-5">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-11 rounded-full [&_svg]:size-5">
          <ShoppingBagIcon />
        </EmptyMedia>
        <EmptyTitle className="text-lg font-semibold tracking-[-0.015em]">
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
  const reduzido = useReducedMotion() ?? false
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
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reduzido ? "auto" : "smooth" })
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
    void tremor.start(retornoDeErro(reduzido))
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

  const valores = { itens, subtotal, taxa, total, retirada }
  const variantes = variantesDoPasso(reduzido)

  return (
    <FormProvider {...formulario}>
      <div className="mx-auto w-full max-w-[1120px] px-4 pt-5 pb-36 md:px-6 md:pt-10 md:pb-16 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
        <div className="flex min-w-0 flex-col gap-5 md:gap-8">
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
            className="relative"
          >
            {/* `overflow-x-clip` corta o deslize entre passos sem impedir as ações de grudarem embaixo;
                a margem negativa deixa o anel de foco dos campos inteiro. */}
            <div ref={refConteudo} className="relative -mx-2 overflow-x-clip px-2 pb-2">
              <AnimatePresence mode="wait" initial={false} custom={direcao}>
                <motion.div
                  key={PASSOS[passo].id}
                  custom={direcao}
                  variants={variantes}
                  initial="entrar"
                  animate="parado"
                  exit="sair"
                >
                  {PASSOS[passo].id === "dados" && <PassoDados lembrado={Boolean(lembrados)} />}
                  {PASSOS[passo].id === "entrega" &&
                    (lojaEscolhida.segmento === "salao" ? <PassoHorario /> : <PassoEntrega />)}
                  {PASSOS[passo].id === "pagamento" && <PassoPagamento total={total} />}
                  {PASSOS[passo].id === "revisao" && (
                    <div className="flex flex-col gap-7">
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

            {/* No tablet e no computador, as ações ficam no fim do passo, grudadas embaixo. */}
            <div className="sticky bottom-0 z-10 mt-8 hidden items-center justify-between gap-3 border-t border-border/70 bg-background py-4 md:flex">
              {passo > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 rounded-full px-4 text-[15px] font-medium"
                  onClick={() => irPara(passo - 1)}
                >
                  <ArrowLeftIcon data-icon="inline-start" />
                  Voltar
                </Button>
              ) : (
                <span />
              )}
              <motion.div animate={tremor}>
                <AcaoCheckout
                  ultimo={ultimo}
                  enviando={enviando}
                  total={total}
                  mostrarTotal
                  testId="acao-checkout"
                  className="min-w-64"
                />
              </motion.div>
            </div>
          </form>
        </div>

        <ResumoLateral {...valores} />
      </div>

      {/* No celular, a ação fica na área do polegar, sempre com o total. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="mx-auto flex max-w-[640px] items-center gap-2.5">
          <AnimatePresence initial={false}>
            {passo > 0 && (
              <motion.div
                key="voltar"
                className="shrink-0"
                initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.2, ease: CURVA_SAIDA }}
              >
                <Dica texto="Passo anterior" lado="top">
                  <Button
                    type="button"
                    variant="outline"
                    size="toque"
                    className="size-12 rounded-full border-border bg-background"
                    aria-label="Voltar ao passo anterior"
                    onClick={() => irPara(passo - 1)}
                  >
                    <ArrowLeftIcon />
                  </Button>
                </Dica>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div animate={tremor} className="min-w-0 flex-1">
            <AcaoCheckout
              ultimo={ultimo}
              enviando={enviando}
              total={total}
              mostrarTotal
              form="formulario-checkout"
              testId="acao-checkout-celular"
              className="w-full"
            />
          </motion.div>
        </div>
      </div>

      {/* Envio temático de 5 segundos: cada nicho tem a sua arte, em quatro etapas. */}
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
      {!hidratada ? (
        <Esperando />
      ) : !pode && !jaPodia ? (
        <SacolaVazia falta={subtotal > 0 ? falta : 0} />
      ) : (
        <FormularioCheckout lembrados={lembrados} />
      )}
    </div>
  )
}
