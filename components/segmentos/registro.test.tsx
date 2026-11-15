import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import type { SegmentoId } from "@/lib/segmentos"
import { registroSegmentos } from "./registro"

const SEGMENTOS = Object.keys(registroSegmentos) as SegmentoId[]

describe("carregamento por segmento", () => {
  test.each(SEGMENTOS)("%s tem um carregador próprio, desenhado para o nicho", (segmento) => {
    const { Carregador } = registroSegmentos[segmento]
    render(<Carregador />)
    expect(screen.getByTestId(`carregador-${segmento}`)).toBeInTheDocument()
  })

  test.each(SEGMENTOS)("%s tem a própria arte no envio do pedido", (segmento) => {
    const { ArteEnvio } = registroSegmentos[segmento]
    render(<ArteEnvio etapa={0} itens={[]} />)
    expect(screen.getByTestId(`arte-envio-${segmento}`)).toBeInTheDocument()
  })
})
