import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useImpressao } from "./use-impressao"

// Impressora: a fronteira com o navegador. O teste guarda as opções para simular o fim.
let opcoesDaImpressora: { onAfterPrint?: () => void; onPrintError?: () => void } = {}
const imprimirDeVerdade = vi.fn()
vi.mock("react-to-print", () => ({
  useReactToPrint: (opcoes: typeof opcoesDaImpressora) => {
    opcoesDaImpressora = opcoes
    return imprimirDeVerdade
  },
}))

const conteudo = { current: null }

beforeEach(() => {
  imprimirDeVerdade.mockClear()
})

describe("useImpressao", () => {
  it("parado, não está imprimindo", () => {
    const { result } = renderHook(() => useImpressao({ conteudo, titulo: "Conta mesa 3" }))
    expect(result.current.imprimindo).toBe(false)
  })

  it("ao imprimir, manda o conteúdo para a impressora e marca que está imprimindo", () => {
    const { result } = renderHook(() => useImpressao({ conteudo, titulo: "Conta mesa 3" }))
    act(() => result.current.imprimir())
    expect(imprimirDeVerdade).toHaveBeenCalledOnce()
    expect(result.current.imprimindo).toBe(true)
  })

  it("termina de imprimir quando a janela da impressora fecha", () => {
    const { result } = renderHook(() => useImpressao({ conteudo, titulo: "Conta mesa 3" }))
    act(() => result.current.imprimir())
    act(() => opcoesDaImpressora.onAfterPrint?.())
    expect(result.current.imprimindo).toBe(false)
  })

  it("se a impressão falha, também deixa de estar imprimindo", () => {
    const { result } = renderHook(() => useImpressao({ conteudo, titulo: "Conta mesa 3" }))
    act(() => result.current.imprimir())
    act(() => opcoesDaImpressora.onPrintError?.())
    expect(result.current.imprimindo).toBe(false)
  })
})
