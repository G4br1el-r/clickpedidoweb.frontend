"use client"

import NumberFlow from "@number-flow/react"
import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Dica } from "@/components/dica"
import { Button } from "@/components/ui/button"
import { vibrar } from "@/lib/haptico"
import { cn } from "@/lib/utils"

type SeletorQuantidadeProps = {
  valor: number
  aoMudar: (valor: number) => void
  nome: string
  /** "acao" tem a mesma altura do botão principal; "linha" é para listas. */
  tamanho?: "acao" | "linha"
  /** Em 1, troca o "menos" por uma lixeira em vez de travar. */
  aoRemover?: () => void
}

export function SeletorQuantidade({
  valor,
  aoMudar,
  nome,
  tamanho = "acao",
  aoRemover,
}: SeletorQuantidadeProps) {
  const noMinimo = valor <= 1
  const mostrarLixeira = noMinimo && Boolean(aoRemover)
  const tamanhoBotao = cn("rounded-none", tamanho === "acao" ? "size-12" : "size-11")

  function diminuir() {
    vibrar()
    if (noMinimo) {
      aoRemover?.()
      return
    }
    aoMudar(valor - 1)
  }

  function aumentar() {
    vibrar()
    aoMudar(valor + 1)
  }

  return (
    <fieldset
      data-testid="seletor-quantidade"
      aria-label={`Quantidade de ${nome}`}
      className={cn(
        "m-0 flex shrink-0 items-center overflow-hidden rounded-full border border-input bg-card p-0",
        tamanho === "acao" ? "h-12" : "h-11",
      )}
    >
      <Dica texto={mostrarLixeira ? "Remover" : "Diminuir"}>
        <Button
          type="button"
          variant="ghost"
          size="toque"
          className={tamanhoBotao}
          onClick={diminuir}
          disabled={noMinimo && !aoRemover}
          aria-label={mostrarLixeira ? `Remover ${nome}` : `Diminuir quantidade de ${nome}`}
        >
          {mostrarLixeira ? <Trash2Icon /> : <MinusIcon />}
        </Button>
      </Dica>
      <span
        aria-live="polite"
        className="flex min-w-6 items-center justify-center text-base font-semibold tabular-nums"
      >
        <NumberFlow value={valor} />
      </span>
      <Dica texto="Aumentar">
        <Button
          type="button"
          variant="ghost"
          size="toque"
          className={tamanhoBotao}
          onClick={aumentar}
          aria-label={`Aumentar quantidade de ${nome}`}
        >
          <PlusIcon />
        </Button>
      </Dica>
    </fieldset>
  )
}
