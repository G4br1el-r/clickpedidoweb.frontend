export type AcaoAtalho =
  | { tipo: "nenhuma" }
  | { tipo: "buscar" }
  | { tipo: "nova-mesa" }
  | { tipo: "ajuda" }
  | { tipo: "abrir-mesa"; numero: number }

export type TeclaApertada = {
  key: string
  emCampo: boolean
  comModificador: boolean
  janelaAberta: boolean
  /** Falso: os atalhos de uma tecla estão desligados neste aparelho (WCAG 2.1.4). Padrão: ligados. */
  ligados?: boolean
}

const MAX_DIGITOS = 3

const COMANDOS: Record<string, AcaoAtalho> = {
  "/": { tipo: "buscar" },
  n: { tipo: "nova-mesa" },
  N: { tipo: "nova-mesa" },
  "?": { tipo: "ajuda" },
}

/** Lê uma tecla da tela de mesas: devolve os dígitos acumulados e a ação a disparar. */
export function lerTecla(
  digitado: string,
  tecla: TeclaApertada,
): { digitado: string; acao: AcaoAtalho } {
  const nenhuma: AcaoAtalho = { tipo: "nenhuma" }
  if (tecla.emCampo || tecla.comModificador || tecla.janelaAberta) {
    return { digitado, acao: nenhuma }
  }
  if (tecla.ligados === false) {
    return { digitado: tecla.key === "Escape" ? "" : digitado, acao: nenhuma }
  }
  if (tecla.key === "Enter") {
    if (digitado === "") return { digitado, acao: nenhuma }
    return { digitado: "", acao: { tipo: "abrir-mesa", numero: Number(digitado) } }
  }
  if (/^[0-9]$/.test(tecla.key)) {
    if (digitado.length >= MAX_DIGITOS) return { digitado, acao: nenhuma }
    return { digitado: digitado + tecla.key, acao: nenhuma }
  }
  if (tecla.key === "Escape") return { digitado: "", acao: nenhuma }
  const comando = COMANDOS[tecla.key]
  if (comando) return { digitado: "", acao: comando }
  return { digitado, acao: nenhuma }
}
