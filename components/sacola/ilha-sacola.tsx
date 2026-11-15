"use client"

import NumberFlow from "@number-flow/react"
import { ShoppingBagIcon } from "lucide-react"
import { AnimatePresence, motion, useAnimationControls } from "motion/react"
import { Dialog } from "radix-ui"
import { useEffect, useRef } from "react"
import { create } from "zustand"
import { Dica } from "@/components/dica"
import { BotaoFecharPainel, VEU_DO_MODAL } from "@/components/modal"
import { Button } from "@/components/ui/button"
import { formatoMoeda, plural } from "@/lib/formato"
import { calcularSubtotal, contarItens, useSacola } from "@/lib/sacola"
import { cn } from "@/lib/utils"
import { manterToastClicavel } from "./manter-toast-clicavel"
import { ConteudoSacola } from "./sacola-sheet"

/**
 * De onde a sacola nasce: do ícone sobre a foto ("topo"), do ícone da barra grudada ("fixo")
 * ou da barra do celular ("barra", que sobe).
 */
export type OrigemIlha = "topo" | "fixo" | "barra"

type EstadoIlha = {
  aberta: boolean
  de: OrigemIlha
  /** Quem abriu a sacola; recebe o foco de volta ao fechar. */
  origem: HTMLElement | null
  abrir: (de?: OrigemIlha) => void
  fechar: () => void
}

/** Abre a sacola de qualquer lugar: o ícone do topo ou a barra do celular. */
export const useIlhaSacola = create<EstadoIlha>()((set) => ({
  aberta: false,
  de: "topo",
  origem: null,
  abrir: (de = "topo") =>
    set({
      aberta: true,
      de,
      origem: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    }),
  fechar: () => set({ aberta: false }),
}))

/** Peça compartilhada de cada origem: o fundo dela é o que cresce até virar o painel. */
export const PECA_ILHA: Record<OrigemIlha, string> = {
  topo: "ilha-topo",
  fixo: "ilha-fixo",
  barra: "ilha-barra",
}

/**
 * Ao abrir, o foco vai para o painel, não para o botão de fechar: assim a dica
 * "Fechar sacola" não aparece sozinha e o Esc fecha a sacola de primeira.
 */
export function focarPainel(evento: Event) {
  evento.preventDefault()
  if (evento.currentTarget instanceof HTMLElement)
    evento.currentTarget.focus({ preventScroll: true })
}

function devolverFoco(evento: Event) {
  evento.preventDefault()
  const { origem } = useIlhaSacola.getState()
  const alvo =
    origem?.isConnected && origem.getClientRects().length > 0
      ? origem
      : document.querySelector<HTMLElement>("[data-alvo-sacola]")
  alvo?.focus({ preventScroll: true })
}

/** Mola da transformação ícone ou barra ⇄ painel: rápida, com um assentamento quase imperceptível. */
export const MOLA_ILHA = { type: "spring", duration: 0.5, bounce: 0.14 } as const
/** Tempo do voo do produto até o ícone. */
const CHEGADA_S = 0.3

/**
 * Ícone da sacola: sobre a foto ("topo") com a barra parada, e na barra grudada ("fixo").
 * Na barra grudada, do tablet em diante, vira a pílula principal da barra, com quantidade
 * e valor na cor da marca (vazia, fica só contornada). O fundo é a mesma peça que vira
 * o painel ao abrir, por isso a sacola parece crescer de dentro do botão.
 */
export function IconeSacola({ origemIcone = "topo" }: { origemIcone?: "topo" | "fixo" }) {
  const noTopo = origemIcone === "topo"
  const abertaAqui = useIlhaSacola((estado) => estado.aberta && estado.de === origemIcone)
  const algumaAberta = useIlhaSacola((estado) => estado.aberta)
  const abrir = useIlhaSacola((estado) => estado.abrir)
  const hidratada = useSacola((estado) => estado.hidratada)
  const quantidade = useSacola((estado) => (hidratada ? contarItens(estado.itens) : 0))
  const subtotal = useSacola((estado) => (hidratada ? calcularSubtotal(estado.itens) : 0))
  const cheia = quantidade > 0
  const destaque = !noTopo && cheia
  const balanco = useAnimationControls()
  const anterior = useRef(quantidade)

  // Quando a etiqueta chega, a sacola cresce um instante: recebeu o item.
  useEffect(() => {
    const aumentou = quantidade > anterior.current
    anterior.current = quantidade
    if (!aumentou) return
    void balanco.start({
      scale: [1, 1.14, 1],
      transition: { duration: 0.35, delay: CHEGADA_S, ease: [0.23, 1, 0.32, 1] },
    })
  }, [quantidade, balanco])

  return (
    <Dica texto="Sua sacola" desligada={algumaAberta}>
      <button
        type="button"
        onClick={() => abrir(origemIcone)}
        aria-haspopup="dialog"
        aria-label={
          quantidade > 0 ? `Abrir sacola, ${plural(quantidade, "item", "itens")}` : "Abrir sacola"
        }
        data-testid={noTopo ? "icone-sacola" : "icone-sacola-fixo"}
        data-alvo-sacola
        className={cn(
          "group/sacola relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
          !noTopo && "md:w-auto md:gap-2 md:px-4",
          noTopo ? "text-white" : destaque ? "text-primary-foreground" : "text-foreground",
        )}
      >
        {!abertaAqui && (
          <motion.span
            layoutId={PECA_ILHA[origemIcone]}
            aria-hidden="true"
            className={cn(
              "absolute inset-0 transition-[background-color,filter] duration-200",
              noTopo
                ? "bg-white/10 ring-1 ring-white/30 group-hover/sacola:bg-white/20"
                : destaque
                  ? "bg-primary group-hover/sacola:brightness-110"
                  : "bg-card ring-1 ring-border group-hover/sacola:bg-muted",
            )}
            style={{ borderRadius: 22 }}
            transition={MOLA_ILHA}
          />
        )}
        {/* No hover a sacola sobe um pixel; o crescer da chegada fica por dentro. */}
        <span
          aria-hidden="true"
          className="relative transition-transform duration-200 ease-saida group-hover/sacola:-translate-y-px"
        >
          <motion.span animate={balanco} className="block">
            <ShoppingBagIcon className="size-5" />
          </motion.span>
        </span>
        {!noTopo && (
          <span
            aria-hidden="true"
            className="relative hidden text-sm font-semibold tabular-nums md:inline"
          >
            {cheia ? (
              <>
                {quantidade} · <NumberFlow value={subtotal} locales="pt-BR" format={formatoMoeda} />
              </>
            ) : (
              "Sacola"
            )}
          </span>
        )}
        <AnimatePresence>
          {quantidade > 0 && !abertaAqui && (
            <motion.span
              key="contador"
              aria-hidden="true"
              className={cn(
                "absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums ring-2 ring-background",
                // Na pílula, a quantidade já está escrita; o contador fica só no círculo.
                noTopo
                  ? "bg-primary text-primary-foreground"
                  : "bg-marca-acento text-white md:hidden",
              )}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.45, delay: 0.05 }}
            >
              <NumberFlow value={quantidade} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </Dica>
  )
}

/**
 * A sacola em si: cresce a partir de quem a abriu até virar um painel flutuante,
 * com o resto da tela desfocado ao fundo.
 * - Pelo ícone do topo: desce do ícone. No computador fica logo abaixo da barra.
 * - Pela barra do celular: a própria barra sobe e vira o painel, preso embaixo.
 */
export function IlhaSacola({ aoContinuar }: { aoContinuar: () => void }) {
  const aberta = useIlhaSacola((estado) => estado.aberta)
  const de = useIlhaSacola((estado) => estado.de)
  const fechar = useIlhaSacola((estado) => estado.fechar)
  const quantidade = useSacola((estado) => contarItens(estado.itens))
  const deBarra = de === "barra"

  return (
    <Dialog.Root open={aberta} onOpenChange={(abrirAgora) => !abrirAgora && fechar()}>
      <AnimatePresence>
        {aberta && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className={cn("fixed inset-0 z-50", VEU_DO_MODAL)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              onPointerDownOutside={manterToastClicavel}
              onInteractOutside={manterToastClicavel}
              onCloseAutoFocus={devolverFoco}
              onOpenAutoFocus={focarPainel}
            >
              <div
                data-testid="ilha-sacola"
                data-origem={de}
                className={cn(
                  "fixed inset-x-3 z-50 flex max-h-[calc(100dvh-24px)] outline-none md:inset-x-auto md:top-[74px] md:bottom-auto md:right-[max(1.5rem,calc((100vw-1120px)/2+1.5rem))] md:max-h-[min(680px,calc(100dvh-96px))] md:w-[420px]",
                  // Vinda da barra, a sacola fica presa embaixo, perto do polegar, e cresce para cima.
                  deBarra ? "bottom-[max(0.75rem,env(safe-area-inset-bottom))]" : "top-3",
                )}
              >
                {/*
                  O fundo é a peça que cresce a partir do botão, e o conteúdo mora dentro dele,
                  recortado: nada aparece antes do fundo chegar. O `layout` do conteúdo desfaz a
                  escala da peça, então o texto não estica; ele só é revelado enquanto o fundo cresce.
                */}
                <motion.div
                  layoutId={PECA_ILHA[de]}
                  data-parte="fundo"
                  className="relative flex min-h-0 w-full flex-col overflow-hidden bg-card shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)] ring-1 ring-border"
                  style={{ borderRadius: 20 }}
                  transition={MOLA_ILHA}
                >
                  {/* O azul da barra se dissolve no fundo do painel enquanto ele cresce. */}
                  {deBarra && (
                    <motion.span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-10 bg-primary"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 0.3, delay: 0.06, ease: "easeOut" }}
                    />
                  )}
                  <motion.div
                    layout
                    data-parte="conteudo"
                    className="relative flex min-h-0 w-full flex-col"
                    initial={{ opacity: 0, y: deBarra ? 10 : -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{
                      default: { duration: 0.26, delay: 0.12, ease: [0.23, 1, 0.32, 1] },
                      layout: MOLA_ILHA,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 pt-3 pr-2 pb-1 pl-5">
                      <div className="min-w-0">
                        <Dialog.Title className="text-lg font-semibold tracking-[-0.01em]">
                          Sua sacola
                        </Dialog.Title>
                        <Dialog.Description className="text-sm text-muted-foreground">
                          {plural(quantidade, "item", "itens")}
                        </Dialog.Description>
                      </div>
                      <Dica texto="Fechar sacola">
                        <Dialog.Close asChild>
                          <BotaoFecharPainel aria-label="Fechar sacola" />
                        </Dialog.Close>
                      </Dica>
                    </div>
                    <ConteudoSacola
                      aoContinuar={() => {
                        fechar()
                        aoContinuar()
                      }}
                      botaoVazio={
                        <Dialog.Close asChild>
                          <Button type="button" size="cta" className="w-full">
                            Ver cardápio
                          </Button>
                        </Dialog.Close>
                      }
                    />
                  </motion.div>
                </motion.div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
