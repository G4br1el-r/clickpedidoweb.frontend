import { vi } from "vitest"

/**
 * Prende o download do CSV no teste: troca o `URL.createObjectURL` e o clique do link, e
 * devolve o nome e o texto do último arquivo (com o BOM, como foi gravado).
 */
export function capturarCsv() {
  let arquivo: Blob | undefined
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: (blob: Blob) => {
      arquivo = blob
      return "blob:csv"
    },
    revokeObjectURL: () => {},
  })
  const clique = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {})
  return {
    nome: () => (clique.mock.contexts.at(-1) as HTMLAnchorElement | undefined)?.download,
    texto: async () =>
      arquivo
        ? new TextDecoder("utf-8", { ignoreBOM: true }).decode(await arquivo.arrayBuffer())
        : undefined,
    soltar: () => {
      clique.mockRestore()
      vi.unstubAllGlobals()
    },
  }
}
