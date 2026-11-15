"use client"

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisIcon,
  MoonIcon,
  ReceiptTextIcon,
  SearchIcon,
  Share2Icon,
  StoreIcon,
  SunIcon,
  XIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"
import { Dica } from "@/components/dica"
import { Entrada } from "@/components/entrada"
import { IconeSacola } from "@/components/sacola/ilha-sacola"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import { compartilharLoja } from "@/lib/compartilhar"
import { useLoja } from "@/lib/loja-atual"
import { distanciaDaSeta, setasDaRolagem } from "@/lib/rolagem"
import type { Categoria, Produto } from "@/lib/tipos"
import { cn } from "@/lib/utils"

type CategoriaNav = Pick<Categoria, "id" | "nome"> & { produtos?: Pick<Produto, "imagem">[] }

const ESPERA_RECOLHER_MS = 3000

type BarraNavegacaoProps = {
  categorias: CategoriaNav[]
  ativa: string | null
  aoEscolher: (id: string) => void
  buscando: boolean
  aoAlternarBusca: (buscando: boolean) => void
  termo: string
  aoBuscar: (termo: string) => void
  aoVerDetalhes: () => void
  /** Fecha o campo sem apagar o texto (a lista continua filtrada). */
  aoRecolherBusca: () => void
  /** Avisa quando a barra gruda ou solta do topo (no celular, as ações vão para a barra de baixo). */
  aoGrudar?: (grudada: boolean) => void
}

/** Detecta quando a barra encosta no topo, para ela mudar de visual. */
function useGrudada() {
  const refMarcador = useRef<HTMLDivElement>(null)
  const [grudada, setGrudada] = useState(false)

  useEffect(() => {
    const marcador = refMarcador.current
    if (!marcador) return
    // Mede a posição a cada rolagem, num quadro só. Um observador de interseção perde o caso
    // em que o marcador nasce abaixo da dobra (celular deitado, com a foto da loja) e salta
    // para acima da tela sem cruzá-la.
    let quadro = 0
    const medir = () => {
      quadro = 0
      setGrudada(marcador.getBoundingClientRect().top < 0)
    }
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir)
    }
    medir()
    window.addEventListener("scroll", agendar, { passive: true })
    window.addEventListener("resize", agendar)
    return () => {
      window.removeEventListener("scroll", agendar)
      window.removeEventListener("resize", agendar)
      cancelAnimationFrame(quadro)
    }
  }, [])

  return { refMarcador, grudada }
}

/**
 * Parada, a barra é transparente e as categorias são abas de texto.
 * Ao grudar no topo, ganha o fundo da página, um fio embaixo e a marca da loja. Sem vidro nem sombra.
 */
export function BarraNavegacao({
  categorias,
  ativa,
  aoEscolher,
  buscando,
  aoAlternarBusca,
  termo,
  aoBuscar,
  aoVerDetalhes,
  aoRecolherBusca,
  aoGrudar,
}: BarraNavegacaoProps) {
  const lojaEscolhida = useLoja()
  const refCategorias = useRef<HTMLDivElement>(null)
  const refChips = useRef(new Map<string, HTMLButtonElement>())
  const refCampo = useRef<HTMLInputElement>(null)
  const { refMarcador, grudada } = useGrudada()
  // No celular, as ações (busca, mais opções, sacola) moram na barra de baixo; aqui só as categorias.
  const telaGrande = useTelaGrande()
  useEffect(() => aoGrudar?.(grudada), [grudada, aoGrudar])
  // A busca da barra só existe com a barra grudada; parada, a busca é a do painel da loja.
  const buscaAberta = buscando && grudada

  useEffect(() => {
    if (buscaAberta) refCampo.current?.focus()
  }, [buscaAberta])

  // A busca aberta cobre as categorias; sem foco por 3 s, ela se recolhe sozinha.
  // O texto continua valendo: a lista segue filtrada e a lupa ganha um pontinho.
  const recolher = useRef<ReturnType<typeof setTimeout> | null>(null)
  function cancelarRecolher() {
    if (recolher.current) clearTimeout(recolher.current)
    recolher.current = null
  }
  function agendarRecolher() {
    cancelarRecolher()
    recolher.current = setTimeout(aoRecolherBusca, ESPERA_RECOLHER_MS)
  }
  useEffect(
    () => () => {
      if (recolher.current) clearTimeout(recolher.current)
    },
    [],
  )

  // Quais setas fazem sentido agora: medido ao rolar, ao mudar o tamanho e ao trocar as categorias.
  const [setas, setSetas] = useState({ anterior: false, proxima: false })
  function medirSetas() {
    const lista = refCategorias.current
    if (!lista) return
    const novas = setasDaRolagem({
      posicao: lista.scrollLeft,
      total: lista.scrollWidth,
      visivel: lista.clientWidth,
    })
    setSetas((atuais) =>
      atuais.anterior === novas.anterior && atuais.proxima === novas.proxima ? atuais : novas,
    )
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: mede de novo quando as categorias mudam ou a busca fecha.
  useEffect(() => {
    const lista = refCategorias.current
    if (!lista) return
    medirSetas()
    const observador = new ResizeObserver(medirSetas)
    observador.observe(lista)
    return () => observador.disconnect()
  }, [categorias, buscaAberta])

  function rolarCategorias(direcao: 1 | -1) {
    const lista = refCategorias.current
    if (!lista) return
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    lista.scrollBy({
      left: direcao * distanciaDaSeta(lista.clientWidth),
      behavior: reduzido ? "auto" : "smooth",
    })
  }

  useEffect(() => {
    const lista = refCategorias.current
    const chip = ativa ? refChips.current.get(ativa) : null
    if (!lista || !chip) return
    // Rola só a lista de categorias, e só quando a ativa sai de vista: o mínimo para ela
    // aparecer com uma folga. Assim o sublinhado não disputa o movimento com o trilho.
    const folga = 24
    const inicio = chip.offsetLeft - folga
    const fim = chip.offsetLeft + chip.offsetWidth + folga - lista.clientWidth
    const destino = lista.scrollLeft > inicio ? inicio : Math.max(lista.scrollLeft, fim)
    if (destino === lista.scrollLeft) return
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    lista.scrollTo({ left: Math.max(0, destino), behavior: reduzido ? "auto" : "smooth" })
  }, [ativa])

  // Entrada e saída discretas dos botões da barra: sem quique, só um leve crescer.
  const surgir = {
    initial: { opacity: 0, width: 0, scale: 0.85 },
    animate: { opacity: 1, width: "auto", scale: 1 },
    exit: { opacity: 0, width: 0, scale: 0.85 },
    transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] },
  } as const

  return (
    <>
      <div ref={refMarcador} aria-hidden="true" className="h-px" />
      <nav
        aria-label="Categorias do cardápio"
        data-testid="barra-navegacao"
        data-grudada={grudada || undefined}
        className={cn(
          "sticky top-0 z-30 mt-2 overflow-x-clip border-b py-2.5 transition-[background-color,border-color] duration-200 md:mt-4",
          grudada ? "border-border bg-background" : "border-border/70 bg-background",
        )}
      >
        {/*
         * Três zonas do tablet em diante: marca toda à esquerda, categorias no centro e
         * ações toda à direita. No celular, as categorias ocupam o espaço e as ações vêm à direita.
         */}
        <Entrada
          atraso={0.1}
          // As laterais nunca ficam menores que o que têm dentro (as ações não cobrem as categorias);
          // havendo espaço, ficam iguais e as categorias ficam no centro exato.
          // Parada, as abas ocupam a coluna, alinhadas à esquerda como o resto da página.
          // Grudada, viram três zonas: marca, categorias no centro e ações.
          className={cn(
            "mx-auto flex h-11 w-full max-w-[1120px] items-center gap-2 px-4 md:gap-4 md:px-6",
            grudada && "md:grid md:grid-cols-[1fr_minmax(0,560px)_1fr]",
          )}
        >
          <div className={cn("hidden min-w-0 md:justify-self-start", grudada && "md:flex")}>
            <AnimatePresence initial={false}>
              {grudada && (
                <motion.div
                  key="marca"
                  // Só onde cabe sem encostar nas categorias (computador de 1280 px em diante).
                  className="hidden shrink-0 items-center gap-2.5 overflow-hidden xl:flex"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
                >
                  <span className="relative size-8 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-border">
                    <Image src={lojaEscolhida.logo} alt="" fill sizes="32px" />
                  </span>
                  <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">
                    {lojaEscolhida.nome}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="min-w-0 flex-1 md:w-full">
            {/*
             * Troca suave entre a busca e as categorias: a busca recolhe em direção à lupa,
             * com um leve desfoque, e só então as categorias voltam, deslizando de leve.
             */}
            <AnimatePresence mode="wait" initial={false}>
              {buscaAberta ? (
                <motion.div
                  key="busca"
                  className="w-full origin-right"
                  // O campo só entra depois que as categorias saem: o foco vem quando ele aparece.
                  onAnimationStart={() => refCampo.current?.focus()}
                  initial={{ opacity: 0, scaleX: 0.94, filter: "blur(3px)" }}
                  animate={{ opacity: 1, scaleX: 1, filter: "blur(0px)" }}
                  exit={{
                    opacity: 0,
                    scaleX: 0.94,
                    filter: "blur(3px)",
                    transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
                  }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <InputGroup className="h-11 w-full rounded-xl border-transparent bg-secondary dark:bg-secondary">
                    <InputGroupAddon className="pl-4">
                      <SearchIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      ref={refCampo}
                      type="search"
                      aria-label="Buscar no cardápio"
                      placeholder="Buscar no cardápio"
                      value={termo}
                      onChange={(evento) => aoBuscar(evento.target.value)}
                      onFocus={cancelarRecolher}
                      onBlur={agendarRecolher}
                      onKeyDown={(evento) => {
                        if (evento.key === "Escape") aoRecolherBusca()
                      }}
                      className="h-full text-base"
                    />
                  </InputGroup>
                </motion.div>
              ) : (
                <motion.div
                  key="categorias"
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                >
                  {/*
                   * No celular, a faixa corre de borda a borda da tela (o respiro interno alinha o texto
                   * da primeira aba à coluna). No computador, parada, o texto encosta na margem da coluna.
                   */}
                  <div
                    className={cn(
                      "-mx-4 flex min-w-0 md:mx-0",
                      grudada ? "md:justify-center" : "md:-ml-3",
                    )}
                  >
                    <div className="relative flex max-w-full min-w-0">
                      {/*
                       * Trilho: as categorias ganham uma superfície em vez de flutuar soltas. Ele mesmo
                       * rola de lado, então termina sempre arredondado dentro da coluna. Tem a altura
                       * do campo de busca (44 px): trocar um pelo outro não mexe em nada.
                       * As pontas terminam retas: as categorias seguem corridas até a borda.
                       */}
                      <motion.div
                        // A pílula e as vizinhas animam dentro de um trilho que rola: o motion
                        // precisa medir essa rolagem, senão a pílula volta no meio do caminho.
                        layoutScroll
                        ref={refCategorias}
                        onScroll={medirSetas}
                        className="sem-barra flex h-11 max-w-full min-w-0 gap-1 overflow-x-auto overscroll-x-contain px-1 md:px-0"
                      >
                        {categorias.map((categoria) => {
                          const selecionada = ativa === categoria.id
                          return (
                            <button
                              key={categoria.id}
                              ref={(elemento) => {
                                if (elemento) refChips.current.set(categoria.id, elemento)
                                else refChips.current.delete(categoria.id)
                              }}
                              type="button"
                              aria-current={selecionada ? "true" : undefined}
                              onClick={() => aoEscolher(categoria.id)}
                              className={cn(
                                "relative flex h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap outline-none transition-[color,transform] duration-150 ease-saida focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:scale-[0.97]",
                                selecionada
                                  ? "text-foreground"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {/* A barra na cor da loja é o único marcador; só ela viaja entre as abas. */}
                              {selecionada && (
                                <motion.span
                                  layoutId="categoria-ativa"
                                  aria-hidden="true"
                                  // Barra curta e centrada: só desliza entre as abas, sem mudar de largura.
                                  className="absolute bottom-0 left-[calc(50%-10px)] h-0.5 w-5 rounded-full bg-primary"
                                  transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                                />
                              )}
                              {categoria.nome}
                            </button>
                          )
                        })}
                      </motion.div>
                      {/* Setas só com mouse: no toque, a pessoa arrasta o trilho com o dedo. */}
                      {setas.anterior && (
                        <SetaDoTrilho lado="anterior" aoClicar={() => rolarCategorias(-1)} />
                      )}
                      {setas.proxima && (
                        <SetaDoTrilho lado="proxima" aoClicar={() => rolarCategorias(1)} />
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/*
           * Ações da barra grudada em dois grupos, com respiro e um fio entre eles:
           * utilidades leves (busca e mais opções) e as ações (Pedidos e a sacola, em destaque).
           */}
          {telaGrande && (
            <div className="flex shrink-0 items-center gap-2 md:justify-self-end">
              <div className="flex shrink-0 items-center gap-1">
                {/* Um só botão: a lupa vira X no mesmo lugar, sem deslizar. */}
                <AnimatePresence initial={false}>
                  {grudada && (
                    <motion.div key="busca" className="shrink-0" {...surgir}>
                      <Dica
                        texto={
                          buscaAberta
                            ? "Fechar busca"
                            : termo
                              ? `Buscando “${termo}”`
                              : "Buscar no cardápio"
                        }
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="toque"
                          className="relative rounded-full"
                          aria-label={
                            buscaAberta
                              ? "Fechar busca"
                              : termo
                                ? `Abrir busca, buscando ${termo}`
                                : "Abrir busca"
                          }
                          onClick={() => aoAlternarBusca(!buscaAberta)}
                        >
                          <AnimatePresence initial={false} mode="popLayout">
                            <motion.span
                              key={buscaAberta ? "fechar" : "lupa"}
                              className="grid place-items-center"
                              initial={{ opacity: 0, scale: 0.8, filter: "blur(3px)" }}
                              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                              exit={{ opacity: 0, scale: 0.8, filter: "blur(3px)" }}
                              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                            >
                              {buscaAberta ? <XIcon /> : <SearchIcon />}
                            </motion.span>
                          </AnimatePresence>
                          {/* Busca recolhida com texto: o pontinho lembra que a lista está filtrada. */}
                          {!buscaAberta && termo && (
                            <span
                              aria-hidden="true"
                              className="absolute top-2 right-2 size-2 rounded-full bg-marca-acento ring-2 ring-background"
                            />
                          )}
                        </Button>
                      </Dica>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence initial={false}>
                  {grudada && (
                    <motion.div key="mais" className="shrink-0" {...surgir}>
                      <MenuMais aoVerDetalhes={aoVerDetalhes} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence initial={false}>
                {grudada && (
                  <motion.div key="acoes" className="flex shrink-0 items-center gap-2" {...surgir}>
                    <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-border md:block" />
                    <IconeSacola origemIcone="fixo" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </Entrada>
      </nav>
    </>
  )
}

/** Seta sobre a ponta do trilho, do mesmo tamanho dele. Só existe para quem usa mouse. */
function SetaDoTrilho({ lado, aoClicar }: { lado: "anterior" | "proxima"; aoClicar: () => void }) {
  const anterior = lado === "anterior"
  return (
    <button
      type="button"
      aria-label={anterior ? "Ver categorias anteriores" : "Ver próximas categorias"}
      onClick={aoClicar}
      className={cn(
        "absolute top-0 hidden size-11 place-items-center rounded-full bg-background text-foreground ring-1 ring-border transition-[background-color,transform] duration-150 ease-saida outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] pointer-fine:grid [&_svg]:size-5",
        anterior ? "left-0" : "right-0",
      )}
    >
      {anterior ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </button>
  )
}

/**
 * Três pontinhos do cabeçalho grudado: "A loja", "Compartilhar" e o tema.
 * Traz também o tema; no celular, onde não cabem mais botões, traz ainda "Pedidos".
 */
export function MenuMais({
  aoVerDetalhes,
  lado = "bottom",
}: {
  aoVerDetalhes: () => void
  /** Na barra de baixo do celular, o menu abre para cima. */
  lado?: "top" | "bottom"
}) {
  const lojaEscolhida = useLoja()
  const { resolvedTheme, setTheme } = useTheme()
  const escuro = resolvedTheme === "dark"
  // A dica fica quieta com o menu aberto e logo depois de fechar: ela nasceria em cima
  // do menu e voltaria a aparecer quando o foco retorna ao botão.
  const [aberto, setAberto] = useState(false)
  const [recemFechado, setRecemFechado] = useState(false)
  const pausa = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (pausa.current) clearTimeout(pausa.current)
    },
    [],
  )
  function mudarAberto(valor: boolean) {
    setAberto(valor)
    if (pausa.current) clearTimeout(pausa.current)
    if (!valor) {
      setRecemFechado(true)
      pausa.current = setTimeout(() => setRecemFechado(false), 700)
    }
  }

  return (
    <DropdownMenu modal={false} open={aberto} onOpenChange={mudarAberto}>
      <Dica texto="Mais opções" desligada={aberto || recemFechado}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="toque"
            className="rounded-full aria-expanded:bg-muted"
            aria-label="Mais opções"
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
      </Dica>
      <DropdownMenuContent
        align="end"
        side={lado}
        sideOffset={8}
        className="w-56 rounded-2xl p-1.5"
      >
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          {lojaEscolhida.nome}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            asChild
            className="h-11 gap-3 rounded-xl text-[15px] font-semibold text-marca-texto"
          >
            <Link href="/pedidos">
              <ReceiptTextIcon />
              Pedidos
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="h-11 gap-3 rounded-xl text-[15px]" onSelect={aoVerDetalhes}>
            <StoreIcon />A loja
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-11 gap-3 rounded-xl text-[15px]"
            onSelect={() => void compartilharLoja()}
          >
            <Share2Icon />
            Compartilhar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="h-11 gap-3 rounded-xl text-[15px]"
            onSelect={() => setTheme(escuro ? "light" : "dark")}
          >
            {escuro ? <SunIcon /> : <MoonIcon />}
            {escuro ? "Tema claro" : "Tema escuro"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
