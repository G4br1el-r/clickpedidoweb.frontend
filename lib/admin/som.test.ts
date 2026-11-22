import { afterEach, describe, expect, test, vi } from "vitest"
import { tocarAlerta, tocarSom } from "./som"

/** AudioContext de mentira: anota as notas tocadas (frequência e forma da onda). */
function simularAudio() {
  const notas: { frequencia: number; onda: string }[] = []
  class ContextoFalso {
    currentTime = 0
    destination = {}
    state = "running"
    resume = vi.fn()
    createOscillator() {
      const oscilador = {
        type: "sine",
        frequency: {
          setValueAtTime: (valor: number) =>
            notas.push({ frequencia: valor, onda: oscilador.type }),
        },
        connect: () => oscilador,
        start: vi.fn(),
        stop: vi.fn(),
      }
      return oscilador
    }
    createGain() {
      const ganho = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: () => ganho,
      }
      return ganho
    }
  }
  vi.stubGlobal("AudioContext", ContextoFalso)
  return notas
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("tocarAlerta", () => {
  test("suave: três bipes de 880 Hz", () => {
    const notas = simularAudio()
    tocarAlerta("suave")
    expect(notas.map((nota) => nota.frequencia)).toEqual([880, 880, 880])
  })

  test("alto: campainha subindo em três notas", () => {
    const notas = simularAudio()
    tocarAlerta("alto")
    expect(notas.map((nota) => nota.frequencia)).toEqual([1046.5, 1318.5, 1568])
  })

  test("muito alto: sirene em quatro pulsos de onda dente-de-serra", () => {
    const notas = simularAudio()
    tocarAlerta("muito-alto")
    expect(notas).toHaveLength(4)
    expect(new Set(notas.map((nota) => nota.onda))).toEqual(new Set(["sawtooth"]))
  })

  test("sem Web Audio no navegador, não quebra", () => {
    vi.stubGlobal("AudioContext", undefined)
    expect(() => tocarAlerta("alto")).not.toThrow()
  })

  test("se o navegador pausou o áudio, retoma antes de tocar", () => {
    const retomar = vi.fn()
    simularAudio()
    const Base = globalThis.AudioContext as unknown as new () => object
    vi.stubGlobal(
      "AudioContext",
      class extends (Base as new () => { state: string; resume: () => void }) {
        state = "suspended"
        resume = retomar
      },
    )
    tocarAlerta("suave")
    expect(retomar).toHaveBeenCalled()
  })
})

describe("tocarSom", () => {
  test("cancelado ou alterado: dois tons alternados, duas vezes, de onda quadrada", () => {
    const notas = simularAudio()
    tocarSom("cancelado")
    expect(notas).toEqual([
      { frequencia: 659.25, onda: "square" },
      { frequencia: 523.25, onda: "square" },
      { frequencia: 659.25, onda: "square" },
      { frequencia: 523.25, onda: "square" },
    ])
  })

  test("chamada: dois tons subindo, de sino, para o cliente ouvir de longe", () => {
    const notas = simularAudio()
    tocarSom("chamada")
    expect(notas).toEqual([
      { frequencia: 783.99, onda: "sine" },
      { frequencia: 1046.5, onda: "sine" },
    ])
  })

  test("atrasado: um toque curto e grave", () => {
    const notas = simularAudio()
    tocarSom("atrasado")
    expect(notas).toEqual([{ frequencia: 392, onda: "triangle" }])
  })
})
