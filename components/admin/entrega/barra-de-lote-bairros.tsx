"use client"

import { useIsPresent } from "motion/react"
import { Button } from "@/components/ui/button"
import { textoDoLoteBairros } from "@/lib/admin/regras/lote-bairros"
import { BotaoCarregando } from "../movimento/botao-carregando"
import { BlocoEntrando } from "../movimento/entrada-admin"
import { semRelogioDoNavegador } from "./linha-animada"

type Props = {
  selecionados: number
  /** Quantos dos marcados estão desativados e passariam a ativos. */
  aAtivar: number
  /** Quantos dos marcados estão ativos e passariam a desativados. */
  aDesativar: number
  /** Qual ação está esperando o servidor: só o botão dela mostra o carregador. */
  ocupada?: "ativar" | "desativar" | null
  aoMudarTaxa: () => void
  aoAtivar: () => void
  aoDesativar: () => void
  aoLimpar: () => void
}

/**
 * Barra das ações em lote dos bairros: flutua no pé da tela enquanto houver seleção. Deve ser
 * filha direta de um `AnimatePresence`. Ao sair, some para o leitor de tela na hora, mesmo
 * enquanto ainda esmaece. Ativar e Desativar só valem para quem de fato muda de estado.
 */
export function BarraDeLoteBairros({
  selecionados,
  aAtivar,
  aDesativar,
  ocupada = null,
  aoMudarTaxa,
  aoAtivar,
  aoDesativar,
  aoLimpar,
}: Props) {
  const presente = useIsPresent()
  const rotulo = textoDoLoteBairros(selecionados)
  return (
    <BlocoEntrando
      role={presente ? "toolbar" : undefined}
      aria-label={presente ? rotulo : undefined}
      aria-hidden={presente ? undefined : true}
      inert={!presente}
      // Com `onUpdate`, o Motion anima no próprio relógio em vez do WAAPI: a saída termina
      // no tempo certo mesmo com o relógio da página parado (testes com `page.clock`).
      onUpdate={semRelogioDoNavegador}
      className="sticky bottom-4 z-20 mx-auto flex w-full max-w-2xl flex-wrap items-center gap-x-2 gap-y-2 rounded-2xl bg-popover p-2 pl-4 text-sm shadow-[0_18px_40px_-20px_rgb(0_0_0/0.45)] ring-1 ring-border/80"
    >
      <span className="mr-auto font-medium tabular-nums">{rotulo}</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="max-sm:h-11"
        onClick={aoMudarTaxa}
      >
        Mudar taxa
      </Button>
      <BotaoCarregando
        type="button"
        size="sm"
        variant="outline"
        className="max-sm:h-11"
        carregando={ocupada === "ativar"}
        rotuloCarregando="Ativando os bairros"
        disabled={aAtivar === 0 || ocupada !== null}
        onClick={aoAtivar}
      >
        Ativar
      </BotaoCarregando>
      <BotaoCarregando
        type="button"
        size="sm"
        variant="outline"
        className="max-sm:h-11"
        carregando={ocupada === "desativar"}
        rotuloCarregando="Desativando os bairros"
        disabled={aDesativar === 0 || ocupada !== null}
        onClick={aoDesativar}
      >
        Desativar
      </BotaoCarregando>
      <Button type="button" size="sm" variant="ghost" className="max-sm:h-11" onClick={aoLimpar}>
        Limpar seleção
      </Button>
    </BlocoEntrando>
  )
}
