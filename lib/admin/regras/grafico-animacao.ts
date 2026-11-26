/**
 * Entrada dos gráficos da visão geral: as barras crescem de baixo e a linha se desenha em
 * 280 ms, sempre `ease-out`. Com movimento reduzido, o gráfico já aparece pronto.
 * Os dois gráficos (por dia e de vendas) usam esta mesma regra.
 */
export function animacaoDoGrafico(reduzido: boolean) {
  if (reduzido) return { isAnimationActive: false } as const
  return {
    isAnimationActive: true,
    animationDuration: 280,
    animationEasing: "ease-out",
  } as const
}
