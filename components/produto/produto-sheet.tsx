"use client"

import NumberFlow from "@number-flow/react"
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageSquarePlusIcon,
  XIcon,
} from "lucide-react"
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
  type Variants,
} from "motion/react"
import { type MouseEvent, type UIEvent, useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AmpliarFoto } from "@/components/ampliar-foto"
import { Dica } from "@/components/dica"
import { Foto } from "@/components/foto"
import { Painel, PainelDescricao, PainelFechar, PainelTitulo } from "@/components/painel-responsivo"
import { SeletorQuantidade } from "@/components/sacola/seletor-quantidade"
import { registroSegmentos } from "@/components/segmentos/registro"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { PESOS_EM_GRAMAS, precoDoPeso, rotuloDoPeso } from "@/lib/acougue"
import { comoVender } from "@/lib/farmacia"
import { emReais, formatoMoeda } from "@/lib/formato"
import { vibrar } from "@/lib/haptico"
import { useLoja } from "@/lib/loja-atual"
import {
  acaoDoPasso,
  avisoDeFaltantes,
  escolhidosDe,
  gruposFaltantes,
  montarItemSacola,
  precoComExtras,
  type Selecoes,
} from "@/lib/produto"
import { mascaraDaRolagem } from "@/lib/rolagem"
import { useSacola } from "@/lib/sacola"
import type { GrupoOpcao, Produto } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { lancarParaSacola } from "@/lib/voo"
import { EtiquetaFolha } from "./etiqueta-folha"
import { InfoRemedio } from "./info-remedio"
import { OpcaoCaixa, OpcaoLinha } from "./opcao-linha"

/** Curva de saída da casa: começa rápido e assenta macio. */
const SAIDA = [0.23, 1, 0.32, 1] as const
/** Movimento que atravessa a tela (o traço do passo indo de uma aba à outra). */
const NA_TELA = [0.77, 0, 0.175, 1] as const
/** O traço do passo ativo desliza até a aba escolhida. */
const TRACO_PASSO = { duration: 0.3, ease: NA_TELA } as const

type Sentido = { direcao: number; reduzido: boolean }

/**
 * Troca de passo: as duas listas se movem juntas, como páginas. A que sai desliza para trás e
 * some em 200 ms; a que chega vem do lado do caminho numa mola sem quique (450 ms), e as
 * opções dela entram em cascata curta. Um desfoque de 2 px funde o cruzamento.
 * Com movimento reduzido, só a opacidade.
 */
const PASSO_VARIANTES: Variants = {
  entra: ({ direcao, reduzido }: Sentido) =>
    reduzido ? { opacity: 0 } : { opacity: 0, x: direcao * 56, filter: "blur(2px)" },
  fica: ({ reduzido }: Sentido) => ({
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: reduzido
      ? { duration: 0.15 }
      : {
          x: { type: "spring", duration: 0.45, bounce: 0 },
          opacity: { duration: 0.22, ease: SAIDA },
          filter: { duration: 0.22, ease: SAIDA },
          delayChildren: 0.06,
          staggerChildren: 0.03,
        },
  }),
  sai: ({ direcao, reduzido }: Sentido) =>
    reduzido
      ? { opacity: 0, transition: { duration: 0.1 } }
      : {
          opacity: 0,
          x: direcao * -40,
          filter: "blur(2px)",
          transition: { duration: 0.2, ease: NA_TELA },
        },
}

/** Cada opção entra com o passo, um pouco depois da anterior (só nas primeiras oito). */
const OPCAO_VARIANTES: Variants = {
  entra: ({ reduzido }: Sentido) => (reduzido ? { opacity: 1 } : { opacity: 0, y: 8 }),
  fica: { opacity: 1, y: 0, transition: { duration: 0.28, ease: SAIDA } },
}

/**
 * A lista do passo rola sem barra: a borda que ainda tem opções esmaece (lib/rolagem.ts).
 * Mede ao montar, ao rolar e quando o tamanho muda.
 */
function useBordasDaRolagem() {
  const [mascara, setMascara] = useState<string | undefined>()
  const medir = useCallback((elemento: HTMLElement) => {
    setMascara(
      mascaraDaRolagem({
        posicao: elemento.scrollTop,
        total: elemento.scrollHeight,
        visivel: elemento.clientHeight,
      }),
    )
  }, [])
  const refCorpo = useRef<HTMLDivElement | null>(null)
  const ref = useCallback(
    (elemento: HTMLDivElement | null) => {
      refCorpo.current = elemento
      if (!elemento) return
      const quadro = requestAnimationFrame(() => medir(elemento))
      const observador = new ResizeObserver(() => medir(elemento))
      observador.observe(elemento)
      return () => {
        cancelAnimationFrame(quadro)
        observador.disconnect()
      }
    },
    [medir],
  )
  return {
    ref,
    refCorpo,
    onScroll: (evento: UIEvent<HTMLDivElement>) => medir(evento.currentTarget),
    style: { maskImage: mascara, WebkitMaskImage: mascara },
  }
}

/**
 * Abertura e fechamento da folha. No celular, a gaveta sobe com a curva de gaveta (a do vaul,
 * 500 ms) e desce mais rápido (300 ms). No computador, a janela nasce de 97% e 8 px abaixo em
 * 280 ms e sai em 160 ms. Com movimento reduzido, as duas só aparecem e somem, em 150 ms.
 */

type ProdutoSheetProps = {
  produto: Produto | null
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  /** Vizinhos na ordem do cardápio, para passar de um produto ao outro. */
  anterior?: Produto
  proximo?: Produto
  aoNavegar?: (produto: Produto) => void
}

const LIMITE_OBSERVACAO = 140
/** Curva de gaveta (a mesma do iOS): começa rápida e assenta sem quicar. */
const GAVETA = [0.32, 0.72, 0, 1] as const

/**
 * Acordeão: o cabeçalho fica parado e o campo desliza para baixo, abrindo a altura.
 * O conteúdo aparece logo depois da abertura começar. Ao fechar, o texto é apagado.
 */
function Observacao({ valor, aoMudar }: { valor: string; aoMudar: (valor: string) => void }) {
  const [aberta, setAberta] = useState(valor.length > 0)
  const refCampo = useRef<HTMLTextAreaElement>(null)
  const refBotao = useRef<HTMLButtonElement>(null)
  const alternouPelaPessoa = useRef(false)
  const restantes = LIMITE_OBSERVACAO - valor.length

  // O foco acompanha a troca: vai para o campo quando ele termina de abrir e volta ao botão ao fechar.
  useEffect(() => {
    if (!alternouPelaPessoa.current) return
    const foco = setTimeout(
      () => {
        if (aberta) refCampo.current?.focus()
        else refBotao.current?.focus({ preventScroll: true })
      },
      aberta ? 220 : 40,
    )
    return () => clearTimeout(foco)
  }, [aberta])

  function alternar(abrir: boolean) {
    alternouPelaPessoa.current = true
    if (!abrir) aoMudar("")
    setAberta(abrir)
  }

  return (
    <div
      className={cn(
        "rounded-xl border transition-[background-color,border-color] duration-200 ease-saida",
        aberta ? "border-border/70 bg-card" : "border-transparent",
      )}
    >
      {aberta ? (
        <div className="flex h-12 items-center justify-between gap-2 pr-0.5 pl-3">
          <label
            htmlFor="observacao-produto"
            className="flex items-center gap-2 text-[15px] font-medium"
          >
            <MessageSquarePlusIcon className="size-4 text-marca-texto" aria-hidden="true" />
            Observação
          </label>
          <Dica texto="Remover observação">
            <Button
              type="button"
              variant="ghost"
              size="toque"
              className="rounded-full text-muted-foreground"
              aria-label="Remover observação"
              onClick={() => alternar(false)}
            >
              <XIcon />
            </Button>
          </Dica>
        </div>
      ) : (
        <Button
          ref={refBotao}
          type="button"
          variant="ghost"
          className="h-12 w-full justify-start gap-2 rounded-xl px-3 text-[15px] font-medium text-marca-texto hover:bg-muted/60"
          onClick={() => alternar(true)}
        >
          <MessageSquarePlusIcon data-icon="inline-start" />
          Adicionar observação
        </Button>
      )}

      <AnimatePresence initial={false}>
        {aberta && (
          <motion.div
            key="campo"
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.3, ease: GAVETA }}
            className="overflow-hidden"
          >
            <motion.div
              className="flex flex-col gap-2 px-3 pb-3"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
              transition={{ duration: 0.24, delay: 0.06, ease: GAVETA }}
            >
              <Textarea
                ref={refCampo}
                id="observacao-produto"
                value={valor}
                onChange={(evento) => aoMudar(evento.target.value)}
                maxLength={LIMITE_OBSERVACAO}
                placeholder="Ex.: sem cebola, bem assada"
                aria-describedby="observacao-restante"
                className="min-h-24 resize-none rounded-xl text-base font-normal"
              />
              <p
                id="observacao-restante"
                className={cn(
                  "text-right text-xs tabular-nums transition-colors",
                  restantes <= 20 ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {restantes} {restantes === 1 ? "caractere restante" : "caracteres restantes"}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Título da folha: Geist 600, um passo acima da vitrine, com o tracking levemente fechado. */
const TITULO = "text-[22px] leading-tight font-semibold tracking-[-0.02em] wrap-anywhere"

function ConteudoProduto({
  produto,
  comNavegacao,
  aoFechar,
}: {
  produto: Produto
  comNavegacao: boolean
  aoFechar: () => void
}) {
  const lojaEscolhida = useLoja()
  const adicionar = useSacola((estado) => estado.adicionar)
  const reduzido = Boolean(useReducedMotion())
  const avisoFaltando = useAnimationControls()
  // O preço do botão: é dele que a etiqueta com o total se solta rumo à sacola.
  const refPreco = useRef<HTMLSpanElement>(null)
  const [passo, setPasso] = useState(0)
  // 1 indo para a frente, -1 voltando: decide de que lado a lista entra e para onde a outra sai.
  const [direcao, setDirecao] = useState(1)
  const [selecoes, setSelecoes] = useState<Selecoes>({})
  // Grupos obrigatórios que ficaram sem escolha quando a pessoa tentou adicionar.
  const [invalidos, setInvalidos] = useState<Set<string>>(new Set())
  const [quantidade, setQuantidade] = useState(1)
  // Açougue: o peso de cada unidade; o preço da ficha é o estimado desse peso.
  const porQuilo = produto.unidade === "kg"
  const [peso, setPeso] = useState(500)
  const [observacao, setObservacao] = useState("")

  const grupos = produto.grupos ?? []
  const temGrupos = grupos.length > 0
  const grupoAtual = grupos[passo]
  const escolhidos = escolhidosDe(grupos, selecoes)
  const faltantes = gruposFaltantes(grupos, selecoes)
  const precoUnitario = precoComExtras(produto, escolhidos)
  const total = (porQuilo ? precoDoPeso(precoUnitario, peso) : precoUnitario) * quantidade
  // Controlado da Portaria 344: a ficha explica, mas não há como pedir pelo site.
  const soBalcao = Boolean(produto.medicamento) && comoVender(produto.medicamento) === "so-balcao"
  const { PreviewProduto } = registroSegmentos[lojaEscolhida.segmento]
  const avisoAberto = useRef<string | number | null>(null)
  const sentido: Sentido = { direcao, reduzido }
  // Escolher não pula de passo: o botão diz "Avançar" até o último passo, e lá "Adicionar".
  const acao = acaoDoPasso(grupos, selecoes, passo)
  const bordas = useBordasDaRolagem()
  // As abas presas: ao trocar de passo, a lista nova começa logo abaixo delas.
  const refPassos = useRef<HTMLDivElement>(null)
  // O nome grande: quando ele sai de cena ao rolar, o pequeno aparece na barra de cima.
  const refTitulo = useRef<HTMLDivElement>(null)
  const [tituloFora, setTituloFora] = useState(false)
  const rotuloAcao = soBalcao ? "Só no balcão" : acao.rotulo

  // Com tudo escolhido, o aviso de "falta escolher" sai da tela sozinho.
  useEffect(() => {
    if (faltantes.length > 0 || avisoAberto.current === null) return
    toast.dismiss(avisoAberto.current)
    avisoAberto.current = null
  }, [faltantes.length])

  function irPara(indice: number) {
    if (indice < 0 || indice === passo) return
    const corpo = bordas.refCorpo.current
    const passos = refPassos.current
    // A barra de cima ocupa 56 px: a lista nova começa logo abaixo das abas presas.
    const alvo = passos ? passos.offsetTop - 56 : 0
    if (corpo && passos && corpo.scrollTop > alvo) {
      corpo.scrollTo({ top: alvo, behavior: reduzido ? "auto" : "smooth" })
    }
    setDirecao(indice > passo ? 1 : -1)
    setPasso(indice)
  }

  /** Grupo de várias escolhas: marca ou desmarca, sem passar do máximo. */
  function alternar(grupo: GrupoOpcao, itemId: string) {
    vibrar()
    setSelecoes((atuais) => {
      const marcados = Array.isArray(atuais[grupo.id]) ? (atuais[grupo.id] as string[]) : []
      const proximos = marcados.includes(itemId)
        ? marcados.filter((id) => id !== itemId)
        : marcados.length < (grupo.maximo ?? 1)
          ? [...marcados, itemId]
          : marcados
      return { ...atuais, [grupo.id]: proximos }
    })
  }

  function escolher(grupoId: string, valor: string) {
    setSelecoes((atuais) => ({ ...atuais, [grupoId]: valor }))
    setInvalidos((atuais) => {
      if (!atuais.has(grupoId)) return atuais
      const restantes = new Set(atuais)
      restantes.delete(grupoId)
      return restantes
    })
  }

  function aoEscolherComToque(evento: MouseEvent<HTMLLabelElement>) {
    // O toque responde no aparelho; o passo só muda pelo botão Avançar.
    if (evento.detail === 0) return
    vibrar()
  }

  function aoPressionarAcao(evento: MouseEvent<HTMLButtonElement>) {
    if (acao.tipo === "avancar") {
      vibrar()
      irPara(acao.para)
      return
    }
    if (acao.tipo === "falta") {
      // No meio dos passos, aponta só o que falta no passo; no fim, tudo o que ficou para trás.
      const apontados = acao.rotulo === "Avançar" ? [acao.grupo] : faltantes
      vibrar(20)
      setInvalidos(new Set(apontados.map((grupo) => grupo.id)))
      irPara(grupos.indexOf(acao.grupo))
      // O botão balança de leve para dizer "ainda não"; com movimento reduzido, fica o aviso.
      if (!reduzido) {
        void avisoFaltando.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.32 } })
      }
      avisoAberto.current = toast.warning(avisoDeFaltantes(apontados))
      return
    }
    vibrar()
    // A etiqueta com o total se solta do preço do botão e desliza até a sacola.
    lancarParaSacola(refPreco.current ?? evento.currentTarget, produto.imagem, emReais(total))
    adicionar(
      montarItemSacola(produto, escolhidos, quantidade, observacao, porQuilo ? peso : undefined),
    )
    aoFechar()
  }

  return (
    <>
      {temGrupos && grupoAtual ? (
        <>
          {/*
           * Uma rolagem só, como o cliente espera: a foto e o nome sobem e saem de cena, os passos
           * ficam presos no topo e a lista ganha a altura toda. Sem barra: a borda que ainda tem
           * conteúdo esmaece.
           */}
          <div
            ref={bordas.ref}
            onScroll={(evento) => {
              bordas.onScroll(evento)
              const titulo = refTitulo.current
              if (titulo)
                setTituloFora(
                  evento.currentTarget.scrollTop > titulo.offsetTop + titulo.offsetHeight - 56,
                )
            }}
            style={bordas.style}
            data-testid="corpo-folha"
            className="sem-barra min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {/*
             * A barra de cima: as setas e o X moram nela (por cima, fora da troca animada) e,
             * quando o nome grande sai de cena, o nome pequeno aparece aqui. Nada passa por baixo.
             */}
            <div
              className={cn(
                "sticky top-0 z-10 flex h-14 items-center bg-popover pl-4 transition-[box-shadow] duration-200 md:pl-5",
                comNavegacao ? "pr-40" : "pr-16",
                tituloFora && "shadow-[0_1px_0_var(--border)]",
              )}
            >
              <motion.p
                data-testid="nome-na-barra"
                aria-hidden="true"
                className="truncate text-[15px] font-semibold tracking-[-0.01em]"
                initial={false}
                animate={tituloFora ? { opacity: 1, y: 0 } : { opacity: 0, y: reduzido ? 0 : 6 }}
                transition={{ duration: 0.2, ease: SAIDA }}
              >
                {produto.nome}
              </motion.p>
            </div>
            <div className="px-4 pb-1 md:px-5">
              <div ref={refTitulo}>
                <PainelTitulo className={TITULO}>{produto.nome}</PainelTitulo>
                <PainelDescricao className="mt-1 line-clamp-2 text-sm leading-snug [@media(max-height:500px)]:line-clamp-1">
                  {produto.descricao}
                </PainelDescricao>
              </div>
              <EtiquetaFolha produto={produto} className="mt-3" />
              {/*
               * A prévia no centro, grande o bastante para ver cada metade sendo montada.
               * Em tela baixa (celular deitado) ela encolhe: as opções precisam da altura.
               */}
              <div className="mt-2 flex justify-center">
                <PreviewProduto produto={produto} selecoes={selecoes} grupoAtivo={grupoAtual} />
              </div>
            </div>

            <Tabs
              value={grupoAtual.id}
              onValueChange={(valor) => irPara(grupos.findIndex((grupo) => grupo.id === valor))}
              className="gap-0"
            >
              {grupos.length > 1 && (
                <div ref={refPassos} className="sticky top-14 z-10 bg-popover px-4 md:px-5">
                  <TabsList
                    variant="line"
                    aria-label="Passos do produto"
                    className="h-12! w-full gap-0 border-b border-border/70 px-0"
                  >
                    {grupos.map((grupo, indice) => {
                      const feito = escolhidos.some((escolha) => escolha.grupo.id === grupo.id)
                      const invalido = invalidos.has(grupo.id)
                      const ativo = indice === passo
                      return (
                        <TabsTrigger
                          key={grupo.id}
                          value={grupo.id}
                          className={cn(
                            // Nomes longos (combos da adega) encurtam em vez de alargar a ficha.
                            "h-11 min-w-0 gap-2 text-sm font-medium text-muted-foreground transition-[color,transform] duration-150 ease-saida after:hidden active:scale-[0.97] data-active:text-foreground",
                            invalido && "text-destructive data-active:text-destructive",
                          )}
                        >
                          {/* O traço do passo ativo, na cor da loja, desliza de uma aba para a outra. */}
                          {ativo && (
                            <motion.span
                              layoutId="traco-passo"
                              aria-hidden="true"
                              className={cn(
                                "absolute inset-x-1 -bottom-1 h-0.5 rounded-full",
                                invalido ? "bg-destructive" : "bg-primary",
                              )}
                              transition={reduzido ? { duration: 0 } : TRACO_PASSO}
                            />
                          )}
                          <MarcaPasso
                            numero={indice + 1}
                            estado={
                              invalido ? "invalido" : feito ? "feito" : ativo ? "ativo" : "pendente"
                            }
                            reduzido={reduzido}
                          />
                          <span className="truncate">{grupo.nome}</span>
                          {feito && <span className="sr-only">(escolhido)</span>}
                          {invalido && <span className="sr-only">(falta escolher)</span>}
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>
                </div>
              )}

              <div className="relative overflow-x-clip">
                {grupos.map((grupo, indice) => {
                  const ativo = indice === passo
                  const anterior =
                    indice > 0 ? escolhidos.find((e) => e.grupo === grupos[indice - 1]) : null
                  const invalido = invalidos.has(grupo.id)
                  return (
                    <TabsContent
                      key={grupo.id}
                      value={grupo.id}
                      forceMount
                      inert={!ativo}
                      // O passo da vez ocupa o espaço; o que está saindo fica por cima até sumir.
                      className="data-[state=inactive]:pointer-events-none data-[state=inactive]:absolute data-[state=inactive]:inset-0"
                    >
                      <AnimatePresence initial={false} custom={sentido}>
                        {ativo && (
                          <motion.div
                            key={grupo.id}
                            className="px-4 pt-4 pb-6 md:px-5"
                            custom={sentido}
                            variants={PASSO_VARIANTES}
                            initial="entra"
                            animate="fica"
                            exit="sai"
                          >
                            <div className="flex items-start justify-between gap-3 pb-3">
                              <div className="min-w-0">
                                <h3 className="font-sans text-base leading-tight font-semibold tracking-[-0.01em]">
                                  {grupo.titulo}
                                </h3>
                                <p className="mt-1 truncate text-[13px] text-muted-foreground">
                                  Passo {indice + 1} de {grupos.length}
                                  {anterior && (
                                    <span className="text-foreground/80">
                                      {" "}
                                      · {anterior.grupo.nome}: {anterior.item.nome}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                                  invalido
                                    ? "border-destructive/50 text-destructive"
                                    : "border-border text-muted-foreground",
                                )}
                              >
                                {grupo.obrigatorio ? "Obrigatório" : "Opcional"}
                              </span>
                            </div>
                            {(grupo.maximo ?? 1) > 1 ? (
                              <GrupoVarias
                                grupo={grupo}
                                marcados={
                                  Array.isArray(selecoes[grupo.id])
                                    ? (selecoes[grupo.id] as string[])
                                    : []
                                }
                                aoAlternar={(itemId) => alternar(grupo, itemId)}
                              />
                            ) : (
                              <RadioGroup
                                aria-label={grupo.titulo}
                                value={(selecoes[grupo.id] as string | undefined) ?? ""}
                                onValueChange={(valor) => escolher(grupo.id, valor)}
                                className="gap-0 border-t border-border/70"
                              >
                                {grupo.itens.map((item, posicao) => (
                                  <motion.div
                                    key={item.id}
                                    custom={sentido}
                                    variants={posicao < 8 ? OPCAO_VARIANTES : undefined}
                                  >
                                    <OpcaoLinha
                                      grupo={grupo}
                                      item={item}
                                      selecionada={selecoes[grupo.id] === item.id}
                                      invalida={invalido}
                                      aoClicar={aoEscolherComToque}
                                    />
                                  </motion.div>
                                ))}
                              </RadioGroup>
                            )}
                            {indice === grupos.length - 1 && (
                              <div className="flex flex-col gap-4 pt-4">
                                {porQuilo && <EscolhaPeso valor={peso} aoMudar={setPeso} />}
                                <Observacao valor={observacao} aoMudar={setObservacao} />
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </TabsContent>
                  )
                })}
              </div>
            </Tabs>
          </div>
        </>
      ) : (
        // Sem opções, a folha inteira rola junto: foto, nome, etiqueta e ficha.
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-3 pb-4 md:px-5 md:pt-5">
          <AmpliarFoto
            src={produto.imagem}
            nome={produto.nome}
            descricao={produto.descricao}
            className="block aspect-[16/9] max-h-[34dvh] w-full rounded-xl"
          >
            <Foto
              src={produto.imagem}
              alt=""
              sizes="(min-width: 768px) 560px, 100vw"
              className="size-full"
            />
          </AmpliarFoto>
          <PainelTitulo className={cn(TITULO, "mt-4")}>{produto.nome}</PainelTitulo>
          <PainelDescricao className="mt-1 text-sm leading-snug">
            {produto.descricao}
          </PainelDescricao>
          <EtiquetaFolha produto={produto} className="mt-3" />
          <div className="mt-5 flex flex-col gap-4">
            {produto.medicamento && <InfoRemedio medicamento={produto.medicamento} />}
            {porQuilo && <EscolhaPeso valor={peso} aoMudar={setPeso} />}
            {!soBalcao && <Observacao valor={observacao} aoMudar={setObservacao} />}
          </div>
        </div>
      )}

      {/* Quantidade e ação sempre no pé, ao alcance do polegar. */}
      <div className="flex items-center gap-2 border-t border-border/70 bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-5 md:pb-4">
        <SeletorQuantidade valor={quantidade} aoMudar={setQuantidade} nome={produto.nome} />
        <motion.div animate={avisoFaltando} className="min-w-0 flex-1">
          <Button
            type="button"
            size="cta"
            className="w-full justify-between gap-3 hover:translate-y-0 hover:bg-primary/90 hover:shadow-none"
            onClick={aoPressionarAcao}
            disabled={soBalcao}
            data-testid="cta-adicionar"
          >
            {/* O rótulo diz o próximo passo; ao mudar, troca com um crossfade curto. */}
            <span className="relative min-w-0 flex-1 overflow-hidden text-left">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={rotuloAcao}
                  className="block truncate"
                  initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduzido ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(2px)" }}
                  transition={{ duration: 0.18, ease: SAIDA }}
                >
                  {rotuloAcao}
                </motion.span>
              </AnimatePresence>
            </span>
            <span ref={refPreco} data-testid="preco-folha" className="shrink-0 tabular-nums">
              <NumberFlow
                value={total}
                locales="pt-BR"
                format={formatoMoeda}
                aria-label={emReais(total)}
                className="tabular-nums"
              />
            </span>
          </Button>
        </motion.div>
      </div>
    </>
  )
}

type EstadoPasso = "pendente" | "ativo" | "feito" | "invalido"

/** O número do passo; feito, vira um check na cor da loja, que surge de 60% em 200 ms. */
function MarcaPasso({
  numero,
  estado,
  reduzido,
}: {
  numero: number
  estado: EstadoPasso
  reduzido: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-[background-color,color,box-shadow] duration-200 ease-saida",
        estado === "invalido" && "bg-destructive text-white",
        estado === "feito" && "bg-accent text-marca-texto",
        estado === "ativo" && "text-foreground ring-1 ring-foreground/60",
        estado === "pendente" && "text-muted-foreground ring-1 ring-border",
      )}
    >
      {estado === "feito" ? (
        <motion.span
          key="feito"
          initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: SAIDA }}
        >
          <CheckIcon className="size-3" strokeWidth={3} />
        </motion.span>
      ) : (
        numero
      )}
    </span>
  )
}

/** Teclas de seta valem para trocar de produto, menos onde elas já têm uso. */
function setaLivre(evento: KeyboardEvent) {
  if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return false
  const alvo = evento.target as HTMLElement | null
  return !alvo?.closest(
    'input, textarea, select, [contenteditable="true"], [role="radio"], [role="tab"], [role="slider"], [data-testid="foto-ampliada"]',
  )
}

/**
 * Troca de produto pelas setas: o atual sai em 150 ms para o lado de onde veio a pessoa e o
 * vizinho entra do outro lado em 280 ms. Com movimento reduzido, só a opacidade.
 */
const TROCA_PRODUTO: Variants = {
  entra: ({ direcao, reduzido }: Sentido) =>
    reduzido ? { opacity: 0 } : { opacity: 0, x: direcao * 32 },
  fica: ({ reduzido }: Sentido) => ({
    opacity: 1,
    x: 0,
    transition: { duration: reduzido ? 0.15 : 0.28, ease: SAIDA },
  }),
  sai: ({ direcao, reduzido }: Sentido) => ({
    opacity: 0,
    x: reduzido ? 0 : direcao * -24,
    transition: { duration: reduzido ? 0.1 : 0.15, ease: SAIDA },
  }),
}

export function ProdutoSheet({
  produto,
  aberto,
  aoMudar,
  anterior,
  proximo,
  aoNavegar,
}: ProdutoSheetProps) {
  const temGrupos = Boolean(produto?.grupos?.length)
  const comNavegacao = Boolean(aoNavegar && (anterior || proximo))
  const reduzido = Boolean(useReducedMotion())
  // 1 indo para o próximo, -1 voltando: decide de que lado o produto novo entra.
  const [direcao, setDirecao] = useState(1)
  const sentido: Sentido = { direcao, reduzido }
  // Sobre a foto, os botões flutuam: superfície da loja e a sombra das coisas que flutuam.
  const sobreFoto = temGrupos
    ? "bg-secondary"
    : "bg-background sombra-flutuante hover:bg-background"

  function navegar(destino: Produto | undefined, sentidoDaTroca: number) {
    if (!destino || !aoNavegar) return
    setDirecao(sentidoDaTroca)
    aoNavegar(destino)
  }

  // ← e → trocam de produto, no computador e em teclados ligados ao celular.
  const navegarRef = useRef(navegar)
  navegarRef.current = navegar
  useEffect(() => {
    if (!aberto || !comNavegacao) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return
      if (!setaLivre(evento)) return
      evento.preventDefault()
      if (evento.key === "ArrowLeft") navegarRef.current(anterior, -1)
      else navegarRef.current(proximo, 1)
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [aberto, comNavegacao, anterior, proximo])

  return (
    <Painel aberto={aberto} aoMudar={aoMudar} altoFixo={temGrupos} testId="painel-produto">
      {/*
        Fora da troca animada: as setas e o X ficam parados enquanto o produto desliza.
        Com foto, eles assentam dentro do canto dela; sem foto, ao lado do nome.
      */}
      <div
        className={cn(
          "absolute z-20 flex items-center gap-1.5",
          // Com passos, alinhadas à barra de cima (na gaveta, abaixo da alça de 12 px).
          temGrupos
            ? "top-1.5 right-3 md:right-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:top-[18px]"
            : "top-8 right-6 md:top-7 md:right-7",
        )}
      >
        {comNavegacao && (
          <div className={cn("flex items-center rounded-full p-0.5", sobreFoto)}>
            <Dica texto={anterior ? `Anterior: ${anterior.nome}` : "Este é o primeiro"}>
              <Button
                type="button"
                variant="ghost"
                size="toque"
                className="rounded-full"
                aria-label="Produto anterior"
                data-testid="produto-anterior"
                disabled={!anterior}
                onClick={() => navegar(anterior, -1)}
              >
                <ChevronLeftIcon />
              </Button>
            </Dica>
            <Dica texto={proximo ? `Próximo: ${proximo.nome}` : "Este é o último"}>
              <Button
                type="button"
                variant="ghost"
                size="toque"
                className="rounded-full"
                aria-label="Próximo produto"
                data-testid="produto-proximo"
                disabled={!proximo}
                onClick={() => navegar(proximo, 1)}
              >
                <ChevronRightIcon />
              </Button>
            </Dica>
          </div>
        )}
        <Dica texto="Fechar">
          <PainelFechar asChild>
            <Button
              type="button"
              variant="secondary"
              size="toque"
              className={cn("rounded-full", sobreFoto)}
              aria-label="Fechar"
            >
              <XIcon />
            </Button>
          </PainelFechar>
        </Dica>
      </div>
      <AnimatePresence initial={false} mode="wait" custom={sentido}>
        {produto && (
          <motion.div
            key={produto.id}
            className="flex min-h-0 flex-1 flex-col"
            custom={sentido}
            variants={TROCA_PRODUTO}
            initial="entra"
            animate="fica"
            exit="sai"
          >
            <ConteudoProduto
              produto={produto}
              comNavegacao={comNavegacao}
              aoFechar={() => aoMudar(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Painel>
  )
}

/** Açougue: o peso de cada unidade, em pílulas; o valor final sai na balança. */
function EscolhaPeso({ valor, aoMudar }: { valor: number; aoMudar: (gramas: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p id="titulo-peso" className="text-[15px] font-semibold tracking-[-0.01em]">
        Peso
      </p>
      <RadioGroup
        aria-labelledby="titulo-peso"
        value={String(valor)}
        onValueChange={(gramas) => aoMudar(Number(gramas))}
        className="flex flex-wrap gap-2"
      >
        {PESOS_EM_GRAMAS.map((gramas) => (
          <Label
            key={gramas}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-medium tabular-nums transition-[background-color,border-color,color,transform] duration-150 ease-saida active:scale-[0.97] has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary has-data-[state=checked]:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <RadioGroupItem value={String(gramas)} className="sr-only" />
            {rotuloDoPeso(gramas)}
          </Label>
        ))}
      </RadioGroup>
      <p className="text-[13px] text-muted-foreground">
        O valor final sai na balança e pode variar um pouco.
      </p>
    </div>
  )
}

/** Grupo de várias escolhas: o limite, quantas saem grátis e as caixas de marcar. */
function GrupoVarias({
  grupo,
  marcados,
  aoAlternar,
}: {
  grupo: GrupoOpcao
  marcados: string[]
  aoAlternar: (itemId: string) => void
}) {
  const maximo = grupo.maximo ?? 1
  const gratis = grupo.gratisAte ?? 0
  return (
    <fieldset aria-label={grupo.titulo} className="flex min-w-0 flex-col gap-2">
      <p className="text-[13px] text-muted-foreground">
        Escolha até {maximo}
        {gratis > 0 &&
          ` · ${gratis === 1 ? "a primeira é grátis" : `as ${gratis} primeiras são grátis`}`}
      </p>
      {grupo.itens.map((item) => {
        const marcada = marcados.includes(item.id)
        const posicao = marcada ? marcados.indexOf(item.id) : marcados.length
        return (
          <OpcaoCaixa
            key={item.id}
            grupo={grupo}
            item={item}
            marcada={marcada}
            desligada={!marcada && marcados.length >= maximo}
            gratis={posicao < gratis}
            aoAlternar={() => aoAlternar(item.id)}
          />
        )
      })}
    </fieldset>
  )
}
