"use client"

import { ChevronsRightIcon, XIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { divisaoDoLote, textoDoLote } from "@/lib/admin/regras/lote-pedidos"
import { plural } from "@/lib/formato"
import { BotaoCarregando } from "../movimento/botao-carregando"
import { BlocoEntrando } from "../movimento/entrada-admin"

/**
 * Barra que aparece quando há pedidos marcados na lista: diz quantos são, avança todos de uma
 * vez e limpa a seleção. Quem não tem próxima etapa (concluído, cancelado) é contado à parte e
 * nunca é mexido. Fica colada na parte de baixo da tela para o dedo achar no celular.
 */
export function BarraDeLote({
  selecionados,
  aoAvancar,
  aoLimpar,
  avancando = false,
}: {
  selecionados: Pedido[]
  aoAvancar: (pedidos: Pedido[]) => void
  aoLimpar: () => void
  avancando?: boolean
}) {
  const { avancaveis, parados } = divisaoDoLote(selecionados)
  return (
    <AnimatePresence>
      {selecionados.length > 0 && (
        <BlocoEntrando
          key="barra-de-lote"
          role="region"
          aria-label="Ações em lote"
          className="sticky bottom-4 z-30 mx-auto flex w-full max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
        >
          <p className="text-sm font-medium tabular-nums">{textoDoLote(selecionados.length)}</p>
          {parados.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {parados.length} sem próxima etapa
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={aoLimpar}>
              <XIcon data-icon="inline-start" />
              Limpar seleção
            </Button>
            <BotaoCarregando
              type="button"
              size="sm"
              carregando={avancando}
              rotuloCarregando="Avançando os pedidos"
              disabled={avancaveis.length === 0}
              onClick={() => aoAvancar(avancaveis)}
            >
              <ChevronsRightIcon data-icon="inline-start" />
              Avançar {plural(avancaveis.length, "pedido", "pedidos")}
            </BotaoCarregando>
          </div>
        </BlocoEntrando>
      )}
    </AnimatePresence>
  )
}
