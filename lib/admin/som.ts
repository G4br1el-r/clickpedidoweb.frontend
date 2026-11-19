import type { SomAlerta } from "./dados/tipos"

type Nota = {
  frequencia: number
  /** Sirene: a frequência sobe até aqui durante a nota. */
  ate?: number
  inicio: number
  duracao: number
  onda: OscillatorType
}

type Alerta = { volume: number; notas: Nota[] }

/** As notas de cada alerta, em segundos a partir de agora, e o volume (0 a 1). */
const ALERTAS: Record<SomAlerta, Alerta> = {
  suave: {
    volume: 0.3,
    notas: [0, 0.25, 0.5].map((inicio) => ({
      frequencia: 880,
      inicio,
      duracao: 0.15,
      onda: "sine",
    })),
  },
  alto: {
    volume: 0.6,
    notas: [1046.5, 1318.5, 1568].map((frequencia, indice) => ({
      frequencia,
      inicio: indice * 0.18,
      duracao: 0.32,
      onda: "triangle",
    })),
  },
  "muito-alto": {
    volume: 0.8,
    notas: [0, 0.35, 0.7, 1.05].map((inicio) => ({
      frequencia: 740,
      inicio,
      duracao: 0.28,
      onda: "sawtooth",
    })),
  },
  // Para pedido esperando aceite no meio do barulho da cozinha: alto, longo e insistente.
  sirene: {
    volume: 1,
    notas: [0, 0.5, 1, 1.5].map((inicio) => ({
      frequencia: 650,
      ate: 1500,
      inicio,
      duracao: 0.45,
      onda: "square",
    })),
  },
}

let contexto: AudioContext | undefined

/** Um contexto só para a página inteira (o navegador limita quantos podem existir). */
function contextoDeAudio(): AudioContext | undefined {
  const Contexto = globalThis.AudioContext as typeof AudioContext | undefined
  if (!Contexto) return undefined
  if (!(contexto instanceof Contexto)) contexto = new Contexto()
  return contexto
}

/** O navegador segura o som até a pessoa tocar na página. */
export function somBloqueado(): boolean {
  return contextoDeAudio()?.state === "suspended"
}

/** Chamar dentro do toque da pessoa: o navegador libera o som a partir daí. */
export async function liberarSom() {
  await contextoDeAudio()?.resume()
}

/**
 * Toca o alerta de pedido novo, sintetizado na hora (sem arquivo de áudio).
 * O navegador só libera o som depois de um toque da pessoa: o botão de ligar faz isso.
 */
export function tocarAlerta(tipo: SomAlerta) {
  const contexto = contextoDeAudio()
  if (!contexto) return
  if (contexto.state === "suspended") void contexto.resume()
  const agora = contexto.currentTime
  const { volume: pico, notas } = ALERTAS[tipo]

  for (const nota of notas) {
    const oscilador = contexto.createOscillator()
    const volume = contexto.createGain()
    const comeco = agora + nota.inicio
    const fim = comeco + nota.duracao
    oscilador.type = nota.onda
    oscilador.frequency.setValueAtTime(nota.frequencia, comeco)
    if (nota.ate) oscilador.frequency.linearRampToValueAtTime(nota.ate, fim)
    // Ataque curto e queda suave: sem estalo no começo nem no fim.
    volume.gain.setValueAtTime(0.0001, comeco)
    volume.gain.exponentialRampToValueAtTime(pico, comeco + 0.02)
    volume.gain.exponentialRampToValueAtTime(0.0001, fim)
    oscilador.connect(volume).connect(contexto.destination)
    oscilador.start(comeco)
    oscilador.stop(fim + 0.05)
  }
}
