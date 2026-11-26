"use client"

import { type RefObject, useState } from "react"
import { useReactToPrint } from "react-to-print"

/** Cupom de 80 mm: a mesma página da conta da mesa e do comprovante do agendamento. */
const ESTILO_DO_CUPOM =
  "@page { size: 80mm auto; margin: 4mm } body { font-family: monospace; font-size: 12px }"

/**
 * Imprime o cupom e diz enquanto isso: `imprimindo` liga ao clicar e desliga quando a janela
 * da impressora fecha, com ou sem erro. A tela usa para mostrar o papel saindo.
 */
export function useImpressao({
  conteudo,
  titulo,
}: {
  conteudo: RefObject<HTMLElement | null>
  titulo: string
}) {
  const [imprimindo, setImprimindo] = useState(false)
  const imprimirDeVerdade = useReactToPrint({
    contentRef: conteudo,
    documentTitle: titulo,
    pageStyle: ESTILO_DO_CUPOM,
    onAfterPrint: () => setImprimindo(false),
    onPrintError: () => setImprimindo(false),
  })
  const imprimir = () => {
    setImprimindo(true)
    imprimirDeVerdade()
  }
  return { imprimir, imprimindo }
}
