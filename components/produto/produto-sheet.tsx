"use client"

import NumberFlow from "@number-flow/react"
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageSquarePlusIcon,
  XIcon,
} from "lucide-react"
import { AnimatePresence, motion, useAnimationControls, type Variants } from "motion/react"
import { type MouseEvent, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AmpliarFoto } from "@/components/ampliar-foto"
import { Dica } from "@/components/dica"
import { Foto } from "@/components/foto"
import { Painel, PainelDescricao, PainelFechar, PainelTitulo } from "@/components/painel-responsivo"
import { SeletorQuantidade } from "@/components/sacola/seletor-quantidade"
import { registroSegmentos } from "@/components/segmentos/registro"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { RadioGroup } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { clienteAtual } from "@/lib/cliente"
import { emReais, formatoMoeda } from "@/lib/formato"
import { vibrar } from "@/lib/haptico"
import {
  avisoDeFaltantes,
  escolhidosDe,
  gruposFaltantes,
  montarItemSacola,
  precoComExtras,
} from "@/lib/produto"
import { useSacola } from "@/lib/sacola"
import type { Produto } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { lancarParaSacola } from "@/lib/voo"
import { OpcaoLinha } from "./opcao-linha"

// Tempo para ver a escolha marcada (e a metade da pizza preenchida) antes de ir ao próximo passo.
const ESPERA_AVANCO_MS = 700
/** Troca de passo: a lista atual sai deslizando enquanto a próxima entra, sem cortes. */
const TROCA_PASSO = { duration: 0.6, ease: [0.65, 0, 0.35, 1] } as const
// Empurra: a lista atual sai inteira por um lado enquanto a próxima entra pelo outro, lado a lado.
const PASSO_VARIANTES = {
  entra: (direcao: number) => ({ opacity: 0.4, x: `${direcao * 100}%` }),
  fica: { opacity: 1, x: "0%" },
  sai: (direcao: number) => ({ opacity: 0.4, x: `${direcao * -100}%` }),
}

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
        "mt-2 rounded-2xl border transition-[background-color,border-color] duration-200",
        aberta ? "border-border bg-card" : "border-transparent",
      )}
    >
      {aberta ? (
        <div className="flex h-12 items-center justify-between gap-2 pr-0.5 pl-3">
          <label htmlFor="observacao-produto" className="flex items-center gap-2 font-semibold">
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
          className="group/obs h-12 w-full justify-start gap-2 rounded-2xl px-3 text-[15px] font-semibold text-marca-texto hover:bg-accent active:scale-100"
          onClick={() => alternar(true)}
        >
          <MessageSquarePlusIcon
            data-icon="inline-start"
            className="transition-transform duration-300 ease-saida group-hover/obs:-rotate-6 group-hover/obs:scale-110"
          />
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
                  restantes <= 20
                    ? "font-semibold text-marca-acento-texto"
                    : "text-muted-foreground",
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

function ConteudoProduto({
  produto,
  comNavegacao,
  aoFechar,
}: {
  produto: Produto
  comNavegacao: boolean
  aoFechar: () => void
}) {
  const adicionar = useSacola((estado) => estado.adicionar)
  const avisoFaltando = useAnimationControls()
  const avanco = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [passo, setPasso] = useState(0)
  // 1 indo para a frente, -1 voltando: decide de que lado a lista entra e para onde a outra sai.
  const [direcao, setDirecao] = useState(1)
  const [selecoes, setSelecoes] = useState<Record<string, string>>({})
  // Grupos obrigatórios que ficaram sem escolha quando a pessoa tentou adicionar.
  const [invalidos, setInvalidos] = useState<Set<string>>(new Set())
  const [quantidade, setQuantidade] = useState(1)
  const [observacao, setObservacao] = useState("")

  const grupos = produto.grupos ?? []
  const temGrupos = grupos.length > 0
  const grupoAtual = grupos[passo]
  const escolhidos = escolhidosDe(grupos, selecoes)
  const faltantes = gruposFaltantes(grupos, selecoes)
  const precoUnitario = precoComExtras(produto, escolhidos)
  const { PreviewProduto } = registroSegmentos[clienteAtual.segmento]
  const avisoAberto = useRef<string | number | null>(null)

  // Com tudo escolhido, o aviso de "falta escolher" sai da tela sozinho.
  useEffect(() => {
    if (faltantes.length > 0 || avisoAberto.current === null) return
    toast.dismiss(avisoAberto.current)
    avisoAberto.current = null
  }, [faltantes.length])

  useEffect(
    () => () => {
      if (avanco.current) clearTimeout(avanco.current)
    },
    [],
  )

  function irPara(indice: number) {
    if (indice < 0 || indice === passo) return
    if (avanco.current) clearTimeout(avanco.current)
    setDirecao(indice > passo ? 1 : -1)
    setPasso(indice)
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
    // Só avança com toque ou clique; quem navega pelas setas do teclado continua no passo.
    if (evento.detail === 0) return
    vibrar()
    if (passo >= grupos.length - 1) return
    if (avanco.current) clearTimeout(avanco.current)
    avanco.current = setTimeout(() => irPara(passo + 1), ESPERA_AVANCO_MS)
  }

  function aoPressionarAcao(evento: MouseEvent<HTMLButtonElement>) {
    if (faltantes.length > 0) {
      vibrar(20)
      setInvalidos(new Set(faltantes.map((grupo) => grupo.id)))
      irPara(grupos.indexOf(faltantes[0]))
      void avisoFaltando.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.32 } })
      avisoAberto.current = toast.warning(avisoDeFaltantes(faltantes))
      return
    }
    vibrar()
    lancarParaSacola(evento.currentTarget, produto.imagem)
    adicionar(montarItemSacola(produto, escolhidos, quantidade, observacao))
    aoFechar()
  }

  return (
    <>
      {temGrupos ? (
        <div className="px-4 pt-3 pb-3">
          {/* Espaço à direita para o X e, quando há, as setas de produto. */}
          <div className={cn("min-w-0", comNavegacao ? "pr-40" : "pr-14")}>
            <PainelTitulo className="text-xl leading-tight font-bold">{produto.nome}</PainelTitulo>
            <PainelDescricao className="mt-0.5 line-clamp-2">{produto.descricao}</PainelDescricao>
          </div>
          {/* A pizza no centro, grande o bastante para ver cada metade sendo montada. */}
          <div className="mt-3 flex justify-center">
            <PreviewProduto produto={produto} selecoes={selecoes} grupoAtivo={grupoAtual} />
          </div>
        </div>
      ) : (
        <div className="px-4 pt-3 pb-2">
          <AmpliarFoto
            src={produto.imagem}
            nome={produto.nome}
            descricao={produto.descricao}
            className="block aspect-[16/9] max-h-[34dvh] w-full rounded-2xl"
          >
            <Foto
              src={produto.imagem}
              alt=""
              sizes="(min-width: 768px) 560px, 100vw"
              className="size-full"
            />
          </AmpliarFoto>
          <PainelTitulo className="mt-3 text-xl font-bold">{produto.nome}</PainelTitulo>
          <PainelDescricao className="mt-0.5">{produto.descricao}</PainelDescricao>
        </div>
      )}

      {temGrupos && grupoAtual ? (
        <Tabs
          value={grupoAtual.id}
          onValueChange={(valor) => irPara(grupos.findIndex((grupo) => grupo.id === valor))}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="px-4">
            <Progress
              value={(escolhidos.length / grupos.length) * 100}
              aria-label={`${escolhidos.length} de ${grupos.length} escolhas feitas`}
            />
            {grupos.length > 1 && (
              <TabsList variant="line" aria-label="Passos do produto" className="mt-1 h-11! w-full">
                {grupos.map((grupo, indice) => {
                  const feito = Boolean(selecoes[grupo.id])
                  const invalido = invalidos.has(grupo.id)
                  return (
                    <TabsTrigger
                      key={grupo.id}
                      value={grupo.id}
                      // O traço do passo ativo desliza de uma aba para a outra (em vez do traço fixo).
                      className={cn(
                        "h-11 gap-1.5 text-sm after:hidden",
                        invalido && "text-destructive data-active:text-destructive",
                      )}
                    >
                      {indice === passo && (
                        <motion.span
                          layoutId="traco-passo"
                          aria-hidden="true"
                          className={cn(
                            "absolute inset-x-0 -bottom-[5px] h-0.5 rounded-full",
                            invalido ? "bg-destructive" : "bg-primary",
                          )}
                          transition={TROCA_PASSO}
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-200",
                          invalido
                            ? "bg-destructive text-white"
                            : feito
                              ? "bg-sucesso text-white dark:text-[#052e16]"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {feito ? <CheckIcon className="size-3" strokeWidth={3} /> : indice + 1}
                      </span>
                      {grupo.nome}
                      {feito && <span className="sr-only">(escolhido)</span>}
                      {invalido && <span className="sr-only">(falta escolher)</span>}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            )}
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            {grupos.map((grupo, indice) => {
              const ativo = indice === passo
              const anterior =
                indice > 0 ? escolhidos.find((e) => e.grupo === grupos[indice - 1]) : null
              return (
                <TabsContent
                  key={grupo.id}
                  value={grupo.id}
                  forceMount
                  inert={!ativo}
                  // O passo da vez ocupa o espaço; o que está saindo fica por cima até sumir.
                  className="h-full data-[state=inactive]:pointer-events-none data-[state=inactive]:absolute data-[state=inactive]:inset-0"
                >
                  <AnimatePresence initial={false} custom={direcao}>
                    {ativo && (
                      <motion.div
                        key={grupo.id}
                        className="h-full overflow-y-auto px-4 pt-3 pb-3"
                        custom={direcao}
                        variants={PASSO_VARIANTES}
                        initial="entra"
                        animate="fica"
                        exit="sai"
                        transition={TROCA_PASSO}
                      >
                        <div className="flex items-center justify-between gap-2 pb-2">
                          <div className="min-w-0">
                            <h3 className="font-sans text-base font-bold">{grupo.titulo}</h3>
                            <p className="truncate text-xs text-muted-foreground">
                              Passo {indice + 1} de {grupos.length}
                              {anterior && (
                                <span className="text-foreground/80">
                                  {" "}
                                  · {anterior.grupo.nome}: {anterior.item.nome}
                                </span>
                              )}
                            </p>
                          </div>
                          <Badge variant={invalidos.has(grupo.id) ? "destructive" : "secondary"}>
                            {grupo.obrigatorio ? "Obrigatório" : "Opcional"}
                          </Badge>
                        </div>
                        <RadioGroup
                          aria-label={grupo.titulo}
                          value={selecoes[grupo.id] ?? ""}
                          onValueChange={(valor) => escolher(grupo.id, valor)}
                          className="gap-2"
                        >
                          {grupo.itens.map((item) => (
                            <OpcaoLinha
                              key={item.id}
                              grupo={grupo}
                              item={item}
                              selecionada={selecoes[grupo.id] === item.id}
                              invalida={invalidos.has(grupo.id)}
                              aoClicar={aoEscolherComToque}
                            />
                          ))}
                        </RadioGroup>
                        {indice === grupos.length - 1 && (
                          <Observacao valor={observacao} aoMudar={setObservacao} />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TabsContent>
              )
            })}
          </div>
        </Tabs>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <Observacao valor={observacao} aoMudar={setObservacao} />
        </div>
      )}

      <div className="flex items-center gap-2 border-t bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <SeletorQuantidade valor={quantidade} aoMudar={setQuantidade} nome={produto.nome} />
        <motion.div animate={avisoFaltando} className="min-w-0 flex-1">
          <Button
            type="button"
            size="cta"
            className="w-full justify-between"
            onClick={aoPressionarAcao}
            data-testid="cta-adicionar"
          >
            <span className="truncate">
              {faltantes[0] ? <span className="sr-only">Falta escolher: </span> : null}
              {faltantes[0] ? faltantes[0].nome : "Adicionar"}
            </span>
            <NumberFlow
              value={precoUnitario * quantidade}
              locales="pt-BR"
              format={formatoMoeda}
              aria-label={emReais(precoUnitario * quantidade)}
              className="tabular-nums"
            />
          </Button>
        </motion.div>
      </div>
    </>
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

const TROCA_PRODUTO: Variants = {
  entra: (direcao: number) => ({ opacity: 0, x: direcao * 48 }),
  fica: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.23, 1, 0.32, 1] } },
  sai: (direcao: number) => ({
    opacity: 0,
    x: direcao * -48,
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
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
  // 1 indo para o próximo, -1 voltando: decide de que lado o produto novo entra.
  const [direcao, setDirecao] = useState(1)

  function navegar(destino: Produto | undefined, sentido: number) {
    if (!destino || !aoNavegar) return
    setDirecao(sentido)
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
      {/* Fora da troca animada: as setas e o X ficam parados enquanto o produto desliza. */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        {comNavegacao && (
          <div className="flex items-center rounded-full bg-secondary/90 p-0.5 backdrop-blur-md">
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
              className="rounded-full"
              aria-label="Fechar"
            >
              <XIcon />
            </Button>
          </PainelFechar>
        </Dica>
      </div>
      <AnimatePresence initial={false} mode="wait" custom={direcao}>
        {produto && (
          <motion.div
            key={produto.id}
            className="flex min-h-0 flex-1 flex-col"
            custom={direcao}
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
