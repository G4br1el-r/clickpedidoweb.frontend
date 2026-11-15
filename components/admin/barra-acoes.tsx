"use client"

import { CheckIcon, RotateCcwIcon, ShoppingBagIcon, Undo2Icon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useMemo } from "react"
import { toast } from "sonner"
import { Dica } from "@/components/dica"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useConfig, useSacolaAdmin } from "@/lib/admin/config"
import { type InfoSecao, ondeMudou, secoesAlteradas } from "@/lib/admin/secoes"
import { emReais } from "@/lib/formato"
import { Traco } from "./traco"

/** Curva da casa: sai rápido e assenta devagar. */
export const CURVA_SAIDA = [0.23, 1, 0.32, 1] as const

function quandoAplicou(iso: string | null) {
  if (!iso) return "Ainda nada aplicado no site"
  const data = new Date(iso)
  const hoje = new Date().toDateString() === data.toDateString()
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return hoje
    ? `Aplicado hoje às ${hora}`
    : `Aplicado em ${data.toLocaleDateString("pt-BR")} às ${hora}`
}

/** Seções cujas configurações diferem do que está aplicado no site, na ordem do índice. */
export function useSecoesPendentes(): InfoSecao[] {
  const config = useConfig((estado) => estado.config)
  const publicada = useConfig((estado) => estado.publicada)
  return useMemo(() => secoesAlteradas(config, publicada), [config, publicada])
}

/** Voltar o site ao visual original da loja, com confirmação. */
function VoltarAoOriginal() {
  const voltarAoOriginal = useConfig((estado) => estado.voltarAoOriginal)
  return (
    <AlertDialog>
      {/* Ação rara e com confirmação: fica só no ícone, com a dica, para a barra caber numa linha. */}
      <Dica texto="Voltar ao original" lado="top">
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Voltar ao original"
            className="text-muted-foreground"
          >
            <RotateCcwIcon />
          </Button>
        </AlertDialogTrigger>
      </Dica>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Voltar o site ao original?</AlertDialogTitle>
          <AlertDialogDescription>
            Cores, textos, imagens, ordem da página e todas as telas voltam a ser como eram, no
            painel e no site. Recursos Pro já contratados continuam seus.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              voltarAoOriginal()
              toast("O site voltou ao original")
            }}
          >
            Voltar ao original
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Barra presa embaixo das configurações: diz o que mudou e onde, e reúne as ações de
 * publicar. Com recursos Pro na sacola, o botão principal vira "Revisar e aplicar" e
 * abre a sacola antes de publicar.
 */
export function BarraAcoes() {
  const hidratada = useConfig((estado) => estado.hidratada)
  const publicadaEm = useConfig((estado) => estado.publicadaEm)
  const abrirSacola = useConfig((estado) => estado.abrirSacola)
  const aplicarNoSite = useConfig((estado) => estado.aplicarNoSite)
  const descartar = useConfig((estado) => estado.descartar)
  const secoes = useSecoesPendentes()
  const pendentes = secoes.length > 0
  const itens = useSacolaAdmin()
  const totalSacola = itens.reduce((soma, item) => soma + item.preco, 0)
  const reduzir = useReducedMotion()

  if (!hidratada) return null

  // Botões que entram e saem: crescem um pouco ao entrar e somem mais rápido ao sair.
  const botao = {
    initial: reduzir ? { opacity: 0 } : { opacity: 0, scale: 0.94 },
    animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: CURVA_SAIDA } },
    exit: reduzir
      ? { opacity: 0, transition: { duration: 0.12 } }
      : { opacity: 0, scale: 0.94, transition: { duration: 0.12, ease: CURVA_SAIDA } },
  }
  const deslocar = { duration: reduzir ? 0 : 0.2, ease: CURVA_SAIDA }

  function aplicar() {
    if (itens.length > 0) {
      abrirSacola(true, true)
      return
    }
    aplicarNoSite()
    toast.success("Configurações aplicadas no site", {
      description: "Protótipo: a loja de verdade ainda vai passar a ler estas configurações.",
    })
  }

  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-auto px-4 pt-8 pb-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
      <div
        className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-background/95 p-2 pl-3.5 shadow-[0_12px_32px_-18px_rgb(0_0_0/0.35)] ring-1 ring-border/80 backdrop-blur-sm"
        data-testid="barra-acoes"
        data-pendente={pendentes || undefined}
      >
        <div className="flex min-w-48 flex-1 items-center gap-2.5 text-sm" aria-live="polite">
          {pendentes ? (
            <Traco tom="novo" />
          ) : (
            <CheckIcon className="size-4 shrink-0 text-(--tom-pronto)" aria-hidden="true" />
          )}
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            {pendentes ? (
              <>
                <span className="font-medium">Mudanças não aplicadas</span>
                <span className="text-muted-foreground">{ondeMudou(secoes)}</span>
              </>
            ) : (
              <span className="truncate text-muted-foreground">{quandoAplicou(publicadaEm)}</span>
            )}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {itens.length > 0 && (
              <motion.div key="sacola" {...botao}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => abrirSacola(true)}
                  data-testid="botao-sacola-admin"
                  className="tabular-nums"
                >
                  <ShoppingBagIcon data-icon="inline-start" />
                  {itens.length} na sacola{" "}
                  <span className="hidden sm:inline">· {emReais(totalSacola)}/mês</span>
                </Button>
              </motion.div>
            )}
            {pendentes && (
              <motion.div key="descartar" {...botao}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    descartar()
                    toast("Alterações descartadas", {
                      description: "O painel voltou ao que está aplicado no site.",
                    })
                  }}
                >
                  <Undo2Icon data-icon="inline-start" />
                  Descartar
                </Button>
              </motion.div>
            )}
            <motion.div key="original" layout="position" transition={deslocar}>
              <VoltarAoOriginal />
            </motion.div>
            <motion.div key="aplicar" layout="position" transition={deslocar}>
              <Button
                type="button"
                size="sm"
                onClick={aplicar}
                disabled={!pendentes}
                data-testid="aplicar-no-site"
                className="active:scale-[0.97]"
              >
                {pendentes && itens.length > 0 ? "Revisar e aplicar" : "Aplicar no site"}
              </Button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
