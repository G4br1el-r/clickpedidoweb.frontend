/**
 * Vibração curta nos aparelhos que permitem.
 * O iPhone não oferece esse recurso para sites, então o feedback visual funciona sozinho.
 */
export function vibrar(duracao = 8) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(duracao)
  }
}
