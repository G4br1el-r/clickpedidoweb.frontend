/** Pesos que a pessoa escolhe para um corte vendido por quilo. */
export const PESOS_EM_GRAMAS = [250, 500, 750, 1000, 1500, 2000, 3000] as const

const quilos = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })

/** "250 g", "1 kg", "1,5 kg". */
export function rotuloDoPeso(gramas: number): string {
  return gramas < 1000 ? `${gramas} g` : `${quilos.format(gramas / 1000)} kg`
}

/** Preço estimado do peso pedido; o valor final sai na balança. */
export function precoDoPeso(precoKg: number, gramas: number): number {
  return Math.round((precoKg * gramas) / 10) / 100
}
