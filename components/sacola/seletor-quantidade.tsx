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
  const naLinha = tamanho === "linha"
  // O ícone afunda um pouco ao toque: o retorno fica no que a pessoa apertou.
  const tamanhoBotao = cn(
    "rounded-none [&_svg]:transition-transform [&_svg]:duration-100 [&_svg]:ease-saida active:[&_svg]:scale-[0.85]",
    naLinha ? "size-11 text-muted-foreground hover:text-foreground" : "size-12",
  )

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
        "m-0 flex shrink-0 items-center overflow-hidden rounded-full border p-0",
        // Na lista da sacola, o seletor é quieto: só o fio, sem superfície própria.
        naLinha ? "h-11 border-border" : "h-12 border-input bg-card",
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
        className={cn(
          "flex min-w-6 items-center justify-center tabular-nums",
          naLinha ? "text-[15px] font-medium" : "text-base font-semibold",
        )}
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
