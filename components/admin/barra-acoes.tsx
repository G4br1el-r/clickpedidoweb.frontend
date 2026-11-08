"use client"

import { CheckIcon, RotateCcwIcon, ShoppingBagIcon, Undo2Icon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"
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
import { useConfig, useMudancasPendentes, useSacolaAdmin } from "@/lib/admin/config"
import { emReais } from "@/lib/formato"
import { cn } from "@/lib/utils"

function quandoAplicou(iso: string | null) {
  if (!iso) return "Ainda nada aplicado no site"
  const data = new Date(iso)
  const hoje = new Date().toDateString() === data.toDateString()
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return hoje
    ? `Aplicado hoje às ${hora}`
    : `Aplicado em ${data.toLocaleDateString("pt-BR")} às ${hora}`
}

/** Voltar o site ao visual original da loja, com confirmação. */
function VoltarAoOriginal() {
  const voltarAoOriginal = useConfig((estado) => estado.voltarAoOriginal)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <RotateCcwIcon data-icon="inline-start" />
          <span className="hidden sm:inline">Voltar ao original</span>
          <span className="sm:hidden">Original</span>
        </Button>
      </AlertDialogTrigger>
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
 * Barra fixa embaixo das configurações: diz se há mudanças fora do site e reúne
 * as ações de publicar. Com recursos Pro na sacola, "Aplicar" abre a sacola antes.
 */
export function BarraAcoes() {
  const hidratada = useConfig((estado) => estado.hidratada)
  const publicadaEm = useConfig((estado) => estado.publicadaEm)
  const abrirSacola = useConfig((estado) => estado.abrirSacola)
  const aplicarNoSite = useConfig((estado) => estado.aplicarNoSite)
  const descartar = useConfig((estado) => estado.descartar)
  const pendentes = useMudancasPendentes()
  const itens = useSacolaAdmin()
  const totalSacola = itens.reduce((soma, item) => soma + item.preco, 0)

  if (!hidratada) return null

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
    <div className="sticky bottom-0 z-20 -mx-4 mt-auto px-4 pt-6 pb-4 md:-mx-8 md:px-8">
      <div
        className={cn(
          "mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border bg-card/95 p-2.5 pl-4 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.4)] backdrop-blur transition-colors duration-300",
          pendentes ? "border-[#F5B700]/60" : "border-border",
        )}
        data-testid="barra-acoes"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={pendentes ? "pendente" : "aplicado"}
            className="flex min-w-48 flex-1 items-center gap-2 text-sm"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {pendentes ? (
              <>
                <span className="relative flex size-2.5 shrink-0">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#F5B700] opacity-60 motion-reduce:hidden" />
                  <span className="relative size-2.5 rounded-full bg-[#F5B700]" />
                </span>
                <span className="font-medium">Mudanças não aplicadas</span>
              </>
            ) : (
              <>
                <CheckIcon className="size-4 shrink-0 text-sucesso" />
                <span className="truncate text-muted-foreground">{quandoAplicou(publicadaEm)}</span>
              </>
            )}
          </motion.p>
        </AnimatePresence>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {itens.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => abrirSacola(true)}
              data-testid="botao-sacola-admin"
              className="border-[#F5B700]/60"
            >
              <ShoppingBagIcon data-icon="inline-start" />
              {itens.length} na sacola · {emReais(totalSacola)}/mês
            </Button>
          )}
          {pendentes && (
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
          )}
          <VoltarAoOriginal />
          <Button
            type="button"
            size="sm"
            onClick={aplicar}
            disabled={!pendentes}
            data-testid="aplicar-no-site"
          >
            Aplicar no site
          </Button>
        </div>
      </div>
    </div>
  )
}
