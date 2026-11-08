const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export const formatoMoeda = { style: "currency", currency: "BRL" } as const

export function emReais(valor: number): string {
  return moeda.format(valor)
}

export function plural(quantidade: number, singular: string, varios: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : varios}`
}

/** Versão curta para espaços apertados: R$ 6 em vez de R$ 6,00, quando não há centavos. */
export function emReaisCurto(valor: number): string {
  return moeda.format(valor).replace(",00", "")
}
