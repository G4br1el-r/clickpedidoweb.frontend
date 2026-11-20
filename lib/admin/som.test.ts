import { afterEach, describe, expect, test, vi } from "vitest"
import { liberarSom, somBloqueado, tocarAlerta, tocarAviso } from "./som"

/**
 * AudioContext de mentira: anota as notas tocadas (frequência e forma da onda), as subidas
 * de frequência e o volume mais alto de cada nota.
 */
function simularAudio() {
  const notas: { frequencia: number; onda: string }[] = []
  const subidas: number[] = []
  const volumes: number[] = []
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
          linearRampToValueAtTime: (valor: number) => subidas.push(valor),
        },
        connect: () => oscilador,
        start: vi.fn(),
        stop: vi.fn(),
      }
      return oscilador
    }
    createGain() {
      let pico = 0
      const ganho = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: (valor: number) => {
            if (valor > pico) {
              if (pico > 0) volumes.pop()
              pico = valor
              volumes.push(valor)
            }
          },
          linearRampToValueAtTime: vi.fn(),
        },
        connect: () => ganho,
      }
      return ganho
    }
  }
  vi.stubGlobal("AudioContext", ContextoFalso)
  return Object.assign(notas, { subidas, volumes })
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

  test("sirene: quatro subidas de 650 a 1500 Hz, em onda quadrada, no volume máximo", () => {
    const notas = simularAudio()
    tocarAlerta("sirene")
    expect([...notas]).toEqual(Array(4).fill({ frequencia: 650, onda: "square" }))
    expect(notas.subidas).toEqual([1500, 1500, 1500, 1500])
    expect(notas.volumes).toEqual([1, 1, 1, 1])
  })

  test("os alertas de sempre ficaram mais altos: suave 0,3, alto 0,6 e muito alto 0,8", () => {
    const suave = simularAudio()
    tocarAlerta("suave")
    expect(new Set(suave.volumes)).toEqual(new Set([0.3]))

    const alto = simularAudio()
    tocarAlerta("alto")
    expect(new Set(alto.volumes)).toEqual(new Set([0.6]))

    const muitoAlto = simularAudio()
    tocarAlerta("muito-alto")
    expect(new Set(muitoAlto.volumes)).toEqual(new Set([0.8]))
  })

  test("som bloqueado: o navegador segura o áudio até a pessoa tocar na página", async () => {
    simularAudio()
    const Base = globalThis.AudioContext as unknown as new () => { state: string }
    vi.stubGlobal(
      "AudioContext",
      class extends Base {
        state = "suspended"
        resume = vi.fn(async () => {
          this.state = "running"
        })
      },
    )

    expect(somBloqueado()).toBe(true)
    await liberarSom()
    expect(somBloqueado()).toBe(false)
  })

  test("sem Web Audio, não há o que liberar: não aparece como bloqueado", () => {
    vi.stubGlobal("AudioContext", undefined)
    expect(somBloqueado()).toBe(false)
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

describe("tocarAviso", () => {
  test("cada alerta secundário tem duas notas suaves próprias, mais baixas que o alerta de pedido", () => {
    const tocadas = (chave: Parameters<typeof tocarAviso>[0]) => {
      const notas = simularAudio()
      tocarAviso(chave)
      return { frequencias: notas.map((nota) => nota.frequencia), volumes: new Set(notas.volumes) }
    }
    expect(tocadas("parado")).toEqual({ frequencias: [660, 660], volumes: new Set([0.2]) })
    expect(tocadas("atraso").frequencias).toEqual([988, 784])
    expect(tocadas("pago").frequencias).toEqual([784, 1175])
    expect(tocadas("cancelou").frequencias).toEqual([523, 392])
    expect(tocadas("cozinha").frequencias).toEqual([880, 1047])
  })
})
