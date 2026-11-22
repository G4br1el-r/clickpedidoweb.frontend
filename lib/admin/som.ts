import type { SomAlerta } from "./dados/tipos"

type Nota = { frequencia: number; inicio: number; duracao: number; onda: OscillatorType }

/** As notas de cada alerta, em segundos a partir de agora (como na fila das lojas). */
const ALERTAS: Record<SomAlerta, Nota[]> = {
  suave: [0, 0.25, 0.5].map((inicio) => ({ frequencia: 880, inicio, duracao: 0.15, onda: "sine" })),
  alto: [1046.5, 1318.5, 1568].map((frequencia, indice) => ({
    frequencia,
    inicio: indice * 0.18,
    duracao: 0.32,
    onda: "triangle",
  })),
  "muito-alto": [0, 0.35, 0.7, 1.05].map((inicio) => ({
    frequencia: 740,
    inicio,
    duracao: 0.28,
    onda: "sawtooth",
  })),
}

/** Os outros eventos da cozinha, cada um com um som que não se confunde com o de novo. */
export type SomDeEvento = "cancelado" | "atrasado" | "chamada"

const EVENTOS: Record<SomDeEvento, Nota[]> = {
  // Dois tons alternados, como um alarme: pede o Ciente.
  cancelado: [659.25, 523.25, 659.25, 523.25].map((frequencia, indice) => ({
    frequencia,
    inicio: indice * 0.22,
    duracao: 0.18,
    onda: "square",
  })),
  // Um toque curto e grave: avisa sem assustar.
  atrasado: [{ frequencia: 392, inicio: 0, duracao: 0.2, onda: "triangle" }],
  // Painel de chamada: dois tons de sino subindo, para o cliente ouvir de longe.
  chamada: [
    { frequencia: 783.99, inicio: 0, duracao: 0.35, onda: "sine" },
    { frequencia: 1046.5, inicio: 0.3, duracao: 0.5, onda: "sine" },
  ],
}

let contexto: AudioContext | undefined

/**
 * Toca o alerta de pedido novo, sintetizado na hora (sem arquivo de áudio).
 * O navegador só libera o som depois de um toque da pessoa: o botão de ligar faz isso.
 */
export function tocarAlerta(tipo: SomAlerta) {
  tocarNotas(ALERTAS[tipo], tipo === "suave" ? 0.15 : 0.3)
}

/** Toca o som de cancelado (ou alterado) ou de ticket atrasado. */
export function tocarSom(evento: SomDeEvento) {
  tocarNotas(EVENTOS[evento], 0.25)
}

function tocarNotas(notas: Nota[], volumeMaximo: number) {
  const Contexto = globalThis.AudioContext as typeof AudioContext | undefined
  if (!Contexto) return
  // Um contexto só para a página inteira (o navegador limita quantos podem existir).
  if (!(contexto instanceof Contexto)) contexto = new Contexto()
  if (contexto.state === "suspended") void contexto.resume()
  const agora = contexto.currentTime

  for (const nota of notas) {
    const oscilador = contexto.createOscillator()
    const volume = contexto.createGain()
    oscilador.type = nota.onda
    oscilador.frequency.setValueAtTime(nota.frequencia, agora + nota.inicio)
    // Ataque curto e queda suave: sem estalo no começo nem no fim.
    volume.gain.setValueAtTime(0.0001, agora + nota.inicio)
    volume.gain.exponentialRampToValueAtTime(volumeMaximo, agora + nota.inicio + 0.02)
    volume.gain.exponentialRampToValueAtTime(0.0001, agora + nota.inicio + nota.duracao)
    oscilador.connect(volume).connect(contexto.destination)
    oscilador.start(agora + nota.inicio)
    oscilador.stop(agora + nota.inicio + nota.duracao + 0.05)
  }
}
