import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Entrada, EntradaAoRolar } from "./entrada"

type Chamada = (registros: { isIntersecting: boolean }[]) => void

/** Observador que a gente comanda: guarda o aviso e quantas vezes foi desligado. */
const observadores: { aviso: Chamada; desconectado: boolean }[] = []

class ObservadorComandado {
  private readonly dono: { aviso: Chamada; desconectado: boolean }
  constructor(aviso: Chamada) {
    this.dono = { aviso, desconectado: false }
    observadores.push(this.dono)
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.dono.desconectado = true
  }
  takeRecords() {
    return []
  }
}

const original = globalThis.IntersectionObserver

/** Onde o bloco está na tela: `top` abaixo da altura da janela (768 no jsdom) é "abaixo da dobra". */
function posicionar(top: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top,
    bottom: top + 100,
    left: 0,
    right: 0,
    width: 0,
    height: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  })
}

beforeEach(() => {
  observadores.length = 0
  Object.assign(globalThis, { IntersectionObserver: ObservadorComandado })
})

afterEach(() => {
  Object.assign(globalThis, { IntersectionObserver: original })
  vi.restoreAllMocks()
})

describe("Entrada", () => {
  it("leva a animação, a espera e a duração como variáveis de CSS", () => {
    render(
      <Entrada de="direita" atraso={0.2} duracao={0.5} data-testid="bloco">
        conteúdo
      </Entrada>,
    )
    const bloco = screen.getByTestId("bloco")
    expect(bloco).toHaveClass("entrada")
    expect(bloco.style.getPropertyValue("--entrada")).toBe("entrada-direita")
    expect(bloco.style.getPropertyValue("--entrada-atraso")).toBe("0.2s")
    expect(bloco.style.getPropertyValue("--entrada-duracao")).toBe("0.5s")
  })
})

describe("EntradaAoRolar", () => {
  it("o que já está à vista na abertura entra na hora", () => {
    posicionar(120)
    render(<EntradaAoRolar data-testid="bloco">conteúdo</EntradaAoRolar>)
    expect(screen.getByTestId("bloco")).toHaveClass("entrada")
    expect(screen.getByTestId("bloco")).not.toHaveClass("entrada-guardada")
    expect(observadores).toHaveLength(0)
  })

  it("o que está abaixo da dobra fica guardado até chegar à tela", () => {
    posicionar(2000)
    render(<EntradaAoRolar data-testid="bloco">conteúdo</EntradaAoRolar>)
    expect(screen.getByTestId("bloco")).toHaveClass("entrada-guardada")
    expect(observadores).toHaveLength(1)
  })

  it("ao chegar à tela, entra sem espera e para de observar", () => {
    posicionar(2000)
    render(
      <EntradaAoRolar atraso={0.3} data-testid="bloco">
        conteúdo
      </EntradaAoRolar>,
    )
    act(() => observadores[0].aviso([{ isIntersecting: true }]))
    const bloco = screen.getByTestId("bloco")
    expect(bloco).toHaveClass("entrada")
    expect(bloco).not.toHaveClass("entrada-guardada")
    expect(bloco.style.getPropertyValue("--entrada-atraso")).toBe("0s")
    expect(observadores[0].desconectado).toBe(true)
  })

  it("continua guardado enquanto não cruza a borda da tela", () => {
    posicionar(2000)
    render(<EntradaAoRolar data-testid="bloco">conteúdo</EntradaAoRolar>)
    act(() => observadores[0].aviso([{ isIntersecting: false }]))
    expect(screen.getByTestId("bloco")).toHaveClass("entrada-guardada")
  })

  it("entra em 400 ms: a chegada pela rolagem é mais curta que a da abertura", () => {
    posicionar(120)
    render(<EntradaAoRolar data-testid="bloco">conteúdo</EntradaAoRolar>)
    expect(screen.getByTestId("bloco").style.getPropertyValue("--entrada-duracao")).toBe("0.4s")
  })
})
