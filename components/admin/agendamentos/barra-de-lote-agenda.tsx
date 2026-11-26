"use client"

import { BanIcon, XIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { Pedido } from "@/lib/admin/dados/tipos"
import {
  divisaoDoLoteAgenda,
  rotuloDoAvancoAgenda,
  textoDoLoteAgenda,
  textoDosParadosAgenda,
} from "@/lib/admin/regras/lote-agenda"
import { plural } from "@/lib/formato"
import { BotaoCarregando } from "../movimento/botao-carregando"
import { BlocoEntrando } from "../movimento/entrada-admin"

type Props = {
  selecionados: Pedido[]
  aoAvancar: (pedidos: Pedido[]) => void
  aoCancelar: (pedidos: Pedido[]) => void
  aoLimpar: () => void
  /** Qual ação espera o servidor: só o botão dela mostra o carregador. */
  ocupada?: "avancar" | "cancelar" | null
}

/**
 * Barra que aparece quando há atendimentos marcados na lista da agenda: diz quantos são,
 * inicia ou conclui todos de uma vez e cancela todos depois de perguntar. Quem já terminou
 * (concluído ou cancelado) é contado à parte e nunca é mexido. Cola no pé da tela.
 */
export function BarraDeLoteAgenda({
  selecionados,
  aoAvancar,
  aoCancelar,
  aoLimpar,
  ocupada = null,
}: Props) {
  const [perguntando, setPerguntando] = useState(false)
  const { avancaveis, cancelaveis, parados } = divisaoDoLoteAgenda(selecionados)
  const quantosCancelaveis = plural(cancelaveis.length, "atendimento", "atendimentos")
  return (
    <>
      <AnimatePresence>
        {selecionados.length > 0 && (
          <BlocoEntrando
            key="barra-de-lote-agenda"
            role="region"
            aria-label="Ações em lote"
            className="sticky bottom-4 z-30 mx-auto flex w-full max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
          >
            <p className="text-sm font-medium tabular-nums">
              {textoDoLoteAgenda(selecionados.length)}
            </p>
            {parados.length > 0 && (
              <span className="text-[13px] text-muted-foreground">
                {textoDosParadosAgenda(parados.length)}
              </span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="max-sm:h-11"
                onClick={aoLimpar}
              >
                <XIcon data-icon="inline-start" />
                Limpar seleção
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="max-sm:h-11"
                disabled={cancelaveis.length === 0 || ocupada !== null}
                onClick={() => setPerguntando(true)}
              >
                <BanIcon data-icon="inline-start" />
                Cancelar {quantosCancelaveis}
              </Button>
              <BotaoCarregando
                type="button"
                size="sm"
                className="max-sm:h-11"
                carregando={ocupada === "avancar"}
                rotuloCarregando="Avançando os atendimentos"
                disabled={avancaveis.length === 0 || ocupada !== null}
                onClick={() => aoAvancar(avancaveis)}
              >
                {rotuloDoAvancoAgenda(avancaveis)}
              </BotaoCarregando>
            </div>
          </BlocoEntrando>
        )}
      </AnimatePresence>
      <AlertDialog open={perguntando} onOpenChange={setPerguntando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar {quantosCancelaveis}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os horários ficam livres na agenda. As clientes não são avisadas daqui.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                aoCancelar(cancelaveis)
                setPerguntando(false)
              }}
            >
              Cancelar atendimentos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
