import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useLarguraDoElemento } from "./use-largura-do-elemento"

type Aviso = (entradas: { contentRect: { width: number } }[]) => void

const observadores: { aviso: Aviso; desligado: boolean }[] = []

class ObservadorDeTamanho {
  private readonly dono: { aviso: Aviso; desligado: boolean }
  constructor(aviso: Aviso) {
    this.dono = { aviso, desligado: false }
    observadores.push(this.dono)
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.dono.desligado = true
  }
}

const original = globalThis.ResizeObserver

function Mostrador() {
  const { ref, largura } = useLarguraDoElemento()
  return (
    <div ref={ref} data-testid="caixa">
      {largura === null ? "sem medida" : `${largura}px`}
    </div>
  )
}

beforeEach(() => {
  observadores.length = 0
  Object.assign(globalThis, { ResizeObserver: ObservadorDeTamanho })
})

afterEach(() => {
  Object.assign(globalThis, { ResizeObserver: original })
  vi.restoreAllMocks()
})

describe("useLarguraDoElemento", () => {
  it("mede o elemento assim que ele aparece", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 480,
    } as DOMRect)
    render(<Mostrador />)
    expect(screen.getByTestId("caixa")).toHaveTextContent("480px")
  })

  it("acompanha quando o elemento muda de largura", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 480,
    } as DOMRect)
    render(<Mostrador />)
    act(() => observadores[0].aviso([{ contentRect: { width: 704 } }]))
    expect(screen.getByTestId("caixa")).toHaveTextContent("704px")
  })

  it("arredonda para o pixel inteiro", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 480,
    } as DOMRect)
    render(<Mostrador />)
    act(() => observadores[0].aviso([{ contentRect: { width: 703.6 } }]))
    expect(screen.getByTestId("caixa")).toHaveTextContent("704px")
  })

  it("para de observar ao sair da tela", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 480,
    } as DOMRect)
    const { unmount } = render(<Mostrador />)
    unmount()
    expect(observadores[0].desligado).toBe(true)
  })
})
