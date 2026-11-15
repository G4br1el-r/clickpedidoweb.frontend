"use client"

import NumberFlow from "@number-flow/react"
import { ChevronRightIcon, SearchIcon, ShoppingBagIcon, XIcon } from "lucide-react"
import { AnimatePresence, motion, useAnimationControls } from "motion/react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { MenuMais } from "@/components/cardapio/barra-navegacao"
import { Button } from "@/components/ui/button"
import { useTelaGrande } from "@/hooks/use-tela-grande"
import { emReais, formatoMoeda, plural } from "@/lib/formato"
import { useLoja } from "@/lib/loja-atual"
import { calcularSubtotal, contarItens, faltaParaMinimo, useSacola } from "@/lib/sacola"
import { MOLA_ILHA, PECA_ILHA, useIlhaSacola } from "./ilha-sacola"

/** Tempo do voo do produto até a barra; o pulo acontece quando ele chega. */
const CHEGADA_S = 0.3
const MOLA = { type: "spring", duration: 0.5, bounce: 0.35 } as const

type BarraSacolaProps = {
  /** Folha do produto aberta: a barra sai de cena. */
  oculta: boolean
  /** A barra de categorias grudou no topo: as ações da loja descem para cá. */
  grudada?: boolean
  buscando?: boolean
  termo?: string
  aoAlternarBusca?: (buscando: boolean) => void
  aoVerDetalhes?: () => void
}

/**
 * A barra de baixo do celular, na área do polegar. Com a barra de categorias grudada no topo,
 * as ações da loja moram aqui: busca, mais opções e a sacola. Sem itens, a sacola é um botão
 * redondo; com itens, ela cresce e vira a barra na cor da loja: as miniaturas, um fio no pé que
 * enche até o pedido mínimo e o total. Cada etiqueta que chega faz a sacola crescer um instante.
 */
export function BarraSacola({
  oculta,
  grudada = false,
  buscando = false,
  termo = "",
  aoAlternarBusca,
  aoVerDetalhes,
}: BarraSacolaProps) {
  const telaGrande = useTelaGrande()
  const lojaEscolhida = useLoja()
  const abrir = useIlhaSacola((estado) => estado.abrir)
  // Aberta pela própria barra: ela vira a sacola. Aberta pelo ícone do topo: a barra sai de cena.
  const abertaAqui = useIlhaSacola((estado) => estado.aberta && estado.de === "barra")
  const abertaNoTopo = useIlhaSacola((estado) => estado.aberta && estado.de !== "barra")
  const itens = useSacola((estado) => estado.itens)
  const hidratada = useSacola((estado) => estado.hidratada)
  const quantidade = contarItens(itens)
  const subtotal = calcularSubtotal(itens)
  const comItens = hidratada && quantidade > 0
  const comAcoes = grudada && !telaGrande
  const visivel = !telaGrande && !oculta && !abertaNoTopo && (comItens || comAcoes)
  // A busca abre no topo, no lugar das categorias; aqui fica o botão que a abre e fecha.
  const buscaAberta = buscando && grudada
  const falta = faltaParaMinimo(subtotal, lojaEscolhida.pedidoMinimo)
  const progresso = Math.min(1, subtotal / lojaEscolhida.pedidoMinimo)
  // Ao lado das ações, a sacola tem menos largura: mostra só o último item que entrou.
  const miniaturas = itens.slice(comAcoes ? -1 : -3)

  const pulo = useAnimationControls()
  const anterior = useRef(quantidade)
  const [chegadas, setChegadas] = useState(0)

  useEffect(() => {
    const aumentou = quantidade > anterior.current
    anterior.current = quantidade
    if (!aumentou || !visivel) return
    setChegadas((atual) => atual + 1)
    void pulo.start({
      scale: [1, 1.025, 1],
      transition: { duration: 0.35, delay: CHEGADA_S, ease: [0.23, 1, 0.32, 1] },
    })
  }, [quantidade, visivel, pulo])

  return (
    <>
      <span className="sr-only" aria-live="polite" data-testid="resumo-sacola">
        {quantidade > 0
          ? `Sacola com ${plural(quantidade, "item", "itens")}, ${emReais(subtotal)}`
          : "Sacola vazia"}
      </span>
      <AnimatePresence>
        {visivel && (
          <motion.div
            data-testid="doca-celular"
            className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[480px] items-center gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
            initial={{ y: "120%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "120%", opacity: 0 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.22 }}
          >
            {/* Busca e mais opções, numa pílula clara que flutua ao lado da sacola. */}
            <AnimatePresence initial={false} mode="popLayout">
              {comAcoes && (
                <motion.div
                  key="acoes"
                  className="sombra-flutuante flex h-14 shrink-0 items-center gap-0.5 rounded-full bg-card px-1.5 ring-1 ring-border"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
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
                    onClick={() => aoAlternarBusca?.(!buscaAberta)}
                  >
                    {buscaAberta ? <XIcon /> : <SearchIcon />}
                    {!buscaAberta && termo && (
                      <span
                        aria-hidden="true"
                        className="absolute top-2 right-2 size-2 rounded-full bg-marca-acento ring-2 ring-card"
                      />
                    )}
                  </Button>
                  {aoVerDetalhes && <MenuMais aoVerDetalhes={aoVerDetalhes} lado="top" />}
                </motion.div>
              )}
            </AnimatePresence>
            {comItens ? (
              <motion.button
                type="button"
                animate={pulo}
                whileTap={{ scale: 0.97 }}
                onClick={() => abrir("barra")}
                data-testid="barra-sacola"
                data-alvo-sacola="principal"
                aria-label={`Ver sacola, ${plural(quantidade, "item", "itens")}, ${emReais(subtotal)}`}
                className="relative flex h-14 min-w-0 flex-1 items-center gap-3 rounded-[16px] pr-4 pl-2.5 text-left text-primary-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
              >
                {/* O fundo azul é a peça que sobe e vira a sacola. */}
                {!abertaAqui && (
                  <motion.span
                    layoutId={PECA_ILHA.barra}
                    aria-hidden="true"
                    className="absolute inset-0 bg-primary shadow-[0_14px_32px_-14px] shadow-primary/60"
                    style={{ borderRadius: 16 }}
                    transition={MOLA_ILHA}
                  />
                )}
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-hidden rounded-[16px]"
                  animate={{ opacity: abertaAqui ? 0 : 1 }}
                  transition={{ duration: 0.12 }}
                >
                  {/* O fio do pé enche até o pedido mínimo e some quando chega lá. */}
                  <motion.span
                    className="absolute bottom-0 left-0 h-[3px] w-full origin-left bg-primary-foreground/70"
                    initial={false}
                    animate={{ scaleX: progresso, opacity: progresso >= 1 ? 0 : 1 }}
                    transition={{ type: "spring", duration: 0.7, bounce: 0.1, delay: CHEGADA_S }}
                  />
                </motion.span>

                <motion.span
                  className="relative flex min-w-0 flex-1 items-center gap-3"
                  animate={{ opacity: abertaAqui ? 0 : 1 }}
                  transition={{ duration: abertaAqui ? 0.1 : 0.25, delay: abertaAqui ? 0 : 0.2 }}
                >
                  <span className="relative flex shrink-0 items-center">
                    <span className="flex -space-x-3">
                      <AnimatePresence initial={false} mode="popLayout">
                        {miniaturas.map((item) => (
                          <motion.span
                            key={item.chave}
                            layout
                            className="relative size-9 overflow-hidden rounded-lg bg-white ring-2 ring-primary"
                            initial={{ scale: 0.3, y: -18, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.3, opacity: 0 }}
                            transition={{ ...MOLA, delay: CHEGADA_S - 0.08 }}
                          >
                            <Image
                              src={item.imagem}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </span>
                    <motion.span
                      key={quantidade}
                      aria-hidden="true"
                      className="absolute -top-1.5 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground px-1 text-[11px] font-semibold text-primary tabular-nums"
                      initial={{ scale: 0.4 }}
                      animate={{ scale: 1 }}
                      transition={{ ...MOLA, delay: CHEGADA_S }}
                    >
                      {quantidade}
                    </motion.span>
                  </span>

                  <span className="relative flex min-w-0 flex-1 flex-col pl-1">
                    <span className="truncate text-[15px] leading-tight font-semibold whitespace-nowrap">
                      Ver sacola
                    </span>
                    {/* Ao lado das ações, sem a segunda linha: o fio do pé já mostra o mínimo. */}
                    {!comAcoes && (
                      <span className="relative h-4 overflow-hidden text-xs leading-4 text-primary-foreground/80">
                        <AnimatePresence initial={false} mode="popLayout">
                          <motion.span
                            key={falta > 0 ? "falta" : "pronto"}
                            className="block truncate"
                            initial={{ y: 12, opacity: 0, filter: "blur(3px)" }}
                            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                            exit={{ y: -12, opacity: 0, filter: "blur(3px)" }}
                            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                          >
                            {falta > 0
                              ? `Faltam ${emReais(falta)} pro mínimo`
                              : "Pronto para finalizar"}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                    )}
                  </span>

                  <span className="relative flex shrink-0 items-center gap-1 text-base font-semibold">
                    <NumberFlow
                      value={subtotal}
                      locales="pt-BR"
                      format={formatoMoeda}
                      className="tabular-nums"
                    />
                    {!comAcoes && (
                      <motion.span
                        key={chegadas}
                        aria-hidden="true"
                        initial={{ x: 0 }}
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 0.5, delay: CHEGADA_S + 0.15 }}
                      >
                        <ChevronRightIcon className="size-5" />
                      </motion.span>
                    )}
                  </span>
                </motion.span>
              </motion.button>
            ) : (
              /* Sacola vazia: um botão redondo; a peça dele é a que sobe e vira a sacola. */
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => abrir("barra")}
                data-testid="icone-sacola-fixo"
                data-alvo-sacola="principal"
                aria-haspopup="dialog"
                aria-label="Abrir sacola"
                className="relative ml-auto flex size-14 shrink-0 items-center justify-center rounded-full text-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
              >
                {!abertaAqui && (
                  <motion.span
                    layoutId={PECA_ILHA.barra}
                    aria-hidden="true"
                    className="sombra-flutuante absolute inset-0 bg-card ring-1 ring-border"
                    style={{ borderRadius: 28 }}
                    transition={MOLA_ILHA}
                  />
                )}
                <ShoppingBagIcon aria-hidden="true" className="relative size-5" />
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
