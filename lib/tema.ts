import { colord, extend } from "colord"
import a11yPlugin from "colord/plugins/a11y"
import mixPlugin from "colord/plugins/mix"
import type { Tema } from "./tipos"

extend([a11yPlugin, mixPlugin])

const CONTRASTE_TEXTO = 4.5
const BRANCO = "#FFFFFF"

/** Escolhe a cor com mais contraste sobre o fundo. Nunca deixa o cliente com botão ilegível. */
export function textoSobre(fundo: string, tinta: string): string {
  const cor = colord(fundo)
  return cor.contrast(BRANCO) >= cor.contrast(tinta) ? BRANCO : tinta
}

/** Ajusta a cor até ela atingir o contraste mínimo sobre o fundo. */
export function garantirContraste(cor: string, fundo: string, tinta: string): string {
  let atual = colord(cor)
  const alvo = colord(fundo).contrast(BRANCO) >= colord(fundo).contrast(tinta) ? BRANCO : tinta
  for (let passo = 0; passo < 20 && atual.contrast(fundo) < CONTRASTE_TEXTO; passo += 1) {
    atual = atual.mix(alvo, 0.1)
  }
  return atual.toHex()
}

type Variaveis = Record<`--${string}`, string>

/** Paleta clara, direto das cores da marca. */
export function variaveisClaras({ primaria, acento, fundo, tinta }: Tema): Variaveis {
  const muted = colord(fundo).mix(tinta, 0.06).toHex()
  const textoSuave = garantirContraste(colord(tinta).mix(fundo, 0.35).toHex(), muted, tinta)
  const textoPrimaria = garantirContraste(primaria, fundo, tinta)
  const textoAcento = garantirContraste(acento, BRANCO, tinta)

  return {
    "--background": fundo,
    "--foreground": tinta,
    "--card": BRANCO,
    "--card-foreground": tinta,
    "--popover": BRANCO,
    "--popover-foreground": tinta,
    "--primary": primaria,
    "--primary-foreground": textoSobre(primaria, tinta),
    "--secondary": muted,
    "--secondary-foreground": tinta,
    "--muted": muted,
    "--muted-foreground": textoSuave,
    "--accent": colord(primaria).mix(BRANCO, 0.9).toHex(),
    "--accent-foreground": textoPrimaria,
    "--border": colord(fundo).mix(tinta, 0.14).toHex(),
    "--input": colord(fundo).mix(tinta, 0.42).toHex(),
    "--ring": primaria,
    "--marca-texto": textoPrimaria,
    "--marca-acento": acento,
    "--marca-acento-texto": textoAcento,
    "--marca-acento-sobre": textoSobre(acento, tinta),
  }
}

/**
 * Paleta escura derivada da mesma marca: fundo puxado da tinta do cliente,
 * superfícies um pouco mais claras e cores da marca clareadas até terem contraste.
 */
export function variaveisEscuras({ primaria, acento, tinta }: Tema): Variaveis {
  const fundo = colord(tinta).mix("#000000", 0.45).toHex()
  const card = colord(fundo).mix(BRANCO, 0.05).toHex()
  const texto = colord(BRANCO).mix(tinta, 0.06).toHex()
  const muted = colord(fundo).mix(BRANCO, 0.09).toHex()
  const textoSuave = garantirContraste(colord(texto).mix(fundo, 0.38).toHex(), muted, texto)
  // O botão continua na cor da marca, só um pouco mais vivo para não sumir no escuro.
  // Só clareia se o texto do botão continuar legível; senão, fica a cor original.
  const clareada = colord(primaria).mix(BRANCO, 0.12).toHex()
  const primariaEscura =
    colord(clareada).contrast(textoSobre(clareada, tinta)) >= CONTRASTE_TEXTO ? clareada : primaria
  const textoPrimaria = garantirContraste(primaria, card, texto)
  const accent = colord(primaria).mix(fundo, 0.72).toHex()

  return {
    "--background": fundo,
    "--foreground": texto,
    "--card": card,
    "--card-foreground": texto,
    "--popover": card,
    "--popover-foreground": texto,
    "--primary": primariaEscura,
    "--primary-foreground": textoSobre(primariaEscura, tinta),
    "--secondary": muted,
    "--secondary-foreground": texto,
    "--muted": muted,
    "--muted-foreground": textoSuave,
    "--accent": accent,
    "--accent-foreground": garantirContraste(primaria, accent, texto),
    "--border": colord(fundo).mix(BRANCO, 0.13).toHex(),
    "--input": colord(fundo).mix(BRANCO, 0.32).toHex(),
    "--ring": textoPrimaria,
    "--marca-texto": textoPrimaria,
    "--marca-acento": acento,
    "--marca-acento-texto": garantirContraste(acento, card, texto),
    "--marca-acento-sobre": textoSobre(acento, tinta),
  }
}

const emBloco = (variaveis: Variaveis) =>
  Object.entries(variaveis)
    .map(([nome, valor]) => `${nome}:${valor};`)
    .join("")

/** CSS do cliente para os dois temas; vai num `<style>` para o modo escuro poder trocar tudo. */
export function temaParaCss(tema: Tema): string {
  return `:root{${emBloco(variaveisClaras(tema))}}.dark{${emBloco(variaveisEscuras(tema))}}`
}

/** Cor da barra do navegador em cada tema. */
export function corDaBarra(tema: Tema) {
  return { clara: tema.primaria, escura: variaveisEscuras(tema)["--background"] }
}
