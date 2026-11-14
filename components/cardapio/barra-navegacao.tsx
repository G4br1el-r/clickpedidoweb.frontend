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
}

/** Detecta quando a barra encosta no topo, para ela mudar de visual. */
function useGrudada() {
  const refMarcador = useRef<HTMLDivElement>(null)
  const [grudada, setGrudada] = useState(false)

  useEffect(() => {
    const marcador = refMarcador.current
    if (!marcador) return
    const observador = new IntersectionObserver(([entrada]) => {
      setGrudada(!entrada.isIntersecting && entrada.boundingClientRect.top < 0)
    })
    observador.observe(marcador)
    return () => observador.disconnect()
  }, [])

  return { refMarcador, grudada }
}

/**
 * Parada, a barra é transparente e deixa o painel de cima respirar.
 * Ao grudar no topo, ganha vidro fosco, sombra, borda de ponta a ponta e a marca da loja.
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
}: BarraNavegacaoProps) {
  const lojaEscolhida = useLoja()
  const refCategorias = useRef<HTMLDivElement>(null)
  const refChips = useRef(new Map<string, HTMLButtonElement>())
  const refCampo = useRef<HTMLInputElement>(null)
  const { refMarcador, grudada } = useGrudada()
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
    lista.scrollBy({ left: direcao * distanciaDaSeta(lista.clientWidth), behavior: "smooth" })
  }

  useEffect(() => {
    const lista = refCategorias.current
    const chip = ativa ? refChips.current.get(ativa) : null
    if (!lista || !chip) return
    // Rola só a lista de categorias, sem interromper a rolagem da página.
    lista.scrollTo({
      left: chip.offsetLeft - (lista.clientWidth - chip.offsetWidth) / 2,
      behavior: "smooth",
    })
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
          "sticky top-0 z-30 mt-3 overflow-x-clip border-b py-2.5 transition-[background-color,box-shadow,border-color,backdrop-filter] duration-300 md:mt-5",
          grudada
            ? "border-border bg-background/85 shadow-[0_14px_32px_-22px_rgb(14_26_43/0.55)] backdrop-blur-xl backdrop-saturate-150"
            : "border-transparent bg-transparent",
        )}
      >
        {/*
         * Três zonas do tablet em diante: marca toda à esquerda, categorias no centro e
         * ações toda à direita. No celular, as categorias ocupam o espaço e as ações vêm à direita.
         */}
        <Entrada
          atraso={0.42}
          // As laterais nunca ficam menores que o que têm dentro (as ações não cobrem as categorias);
          // havendo espaço, ficam iguais e as categorias ficam no centro exato.
          className="mx-auto flex h-11 w-full max-w-[1320px] items-center gap-2 px-4 md:grid md:grid-cols-[1fr_minmax(0,640px)_1fr] md:gap-4 md:px-6 2xl:max-w-[1640px]"
        >
          <div className="hidden min-w-0 md:flex md:justify-self-start">
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
                  <span className="relative size-9 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-border">
                    <Image src={lojaEscolhida.logo} alt="" fill sizes="36px" />
                  </span>
                  <span className="truncate font-heading text-base font-extrabold">
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
                  <InputGroup className="h-11 w-full rounded-full border-transparent bg-secondary dark:bg-secondary">
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
                  <div className="flex min-w-0 md:justify-center">
                    <div className="relative flex max-w-full min-w-0">
                      {/*
                       * Trilho: as categorias ganham uma superfície em vez de flutuar soltas. Ele mesmo
                       * rola de lado, então termina sempre arredondado dentro da coluna. Tem a altura
                       * do campo de busca (44 px): trocar um pelo outro não mexe em nada.
                       * A ponta que ainda tem categorias some num degradê, para mostrar que continua.
                       */}
                      <motion.div
                        // A pílula e as vizinhas animam dentro de um trilho que rola: o motion
                        // precisa medir essa rolagem, senão a pílula volta no meio do caminho.
                        layoutScroll
                        ref={refCategorias}
                        onScroll={medirSetas}
                        style={{
                          maskImage: mascaraDoTrilho(setas),
                          WebkitMaskImage: mascaraDoTrilho(setas),
                        }}
                        className="sem-barra flex h-11 max-w-full min-w-0 gap-1 overflow-x-auto overscroll-x-contain rounded-full bg-card/80 shadow-[0_10px_28px_-18px_rgb(14_26_43/0.45)] ring-1 ring-border/70 ring-inset dark:bg-card/60 dark:shadow-[0_10px_28px_-18px_rgb(0_0_0/0.9)]"
                      >
                        {categorias.map((categoria) => {
                          const selecionada = ativa === categoria.id
                          // A ativa ganha a foto do primeiro produto: dá cara à categoria em qualquer
                          // segmento. Só ela, porque seis fotos não cabem na coluna central.
                          const capa = selecionada ? categoria.produtos?.[0]?.imagem : undefined
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
                                "group relative flex h-11 shrink-0 items-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap outline-none transition-[color,background-color,transform] duration-150 ease-saida focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:scale-[0.96]",
                                capa ? "pr-4 pl-1.5" : "px-4",
                                selecionada
                                  ? "text-primary-foreground"
                                  : "text-foreground/70 hover:bg-muted hover:text-foreground",
                              )}
                            >
                              {selecionada && (
                                <motion.span
                                  layoutId="categoria-ativa"
                                  className="absolute inset-0 rounded-full bg-primary shadow-lg shadow-primary/35 ring-1 ring-white/15 ring-inset"
                                  transition={{ type: "spring", duration: 0.32, bounce: 0.12 }}
                                />
                              )}
                              {capa && (
                                <motion.span
                                  aria-hidden="true"
                                  className="relative size-8 shrink-0 overflow-hidden rounded-full ring-2 ring-white/45"
                                  initial={{ opacity: 0, scale: 0.6, rotate: -20 }}
                                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                  transition={{ type: "spring", duration: 0.4, bounce: 0.25 }}
                                >
                                  <Image
                                    src={capa}
                                    alt=""
                                    fill
                                    sizes="32px"
                                    className="object-cover"
                                  />
                                </motion.span>
                              )}
                              {/* Só a pílula viaja entre as categorias: os botões não animam a posição. Duas animações de
                                layout aninhadas faziam a pílula começar deslocada e voltar no meio. */}
                              <span className="relative">{categoria.nome}</span>
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
                            initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
                            animate={{ opacity: 1, rotate: 0, scale: 1 }}
                            exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
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
                  <span aria-hidden="true" className="mx-2 hidden h-6 w-px bg-border md:block" />
                  <Button
                    asChild
                    variant="outline"
                    size="toque"
                    className="hidden w-auto gap-2 rounded-full px-4 text-sm font-semibold md:inline-flex"
                  >
                    <Link href="/pedidos">
                      <ReceiptTextIcon data-icon="inline-start" />
                      Pedidos
                    </Link>
                  </Button>
                  <IconeSacola origemIcone="fixo" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Entrada>
      </nav>
    </>
  )
}

/** Degradê nas pontas do trilho que ainda têm categorias escondidas. */
function mascaraDoTrilho({ anterior, proxima }: { anterior: boolean; proxima: boolean }) {
  if (!anterior && !proxima) return undefined
  const inicio = anterior ? "transparent 0, transparent 28px, #000 64px" : "#000 0"
  const fim = proxima
    ? "#000 calc(100% - 64px), transparent calc(100% - 28px), transparent 100%"
    : "#000 100%"
  return `linear-gradient(to right, ${inicio}, ${fim})`
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
        "absolute top-0 hidden size-11 place-items-center rounded-full bg-card text-foreground shadow-md ring-1 ring-border/70 transition-[background-color,transform] duration-150 ease-saida outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.94] pointer-fine:grid [&_svg]:size-5",
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
function MenuMais({ aoVerDetalhes }: { aoVerDetalhes: () => void }) {
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
      <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-2xl p-1.5">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          {lojaEscolhida.nome}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            asChild
            className="h-11 gap-3 rounded-xl text-[15px] font-semibold text-marca-texto md:hidden"
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
