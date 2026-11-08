/**
 * Cada cliente tem um único segmento, e o segmento define o que existe para ele.
 * Uma pizzaria nunca vê "corte", e um salão nunca vê "borda".
 */
export const segmentos = {
  pizzaria: {
    nome: "Pizzaria",
    tiposProduto: [
      "pizza",
      "combo",
      "calzone",
      "esfiha",
      "massa",
      "entrada",
      "porcao",
      "sobremesa",
      "bebida",
    ],
    tiposOpcao: ["sabor", "borda"],
  },
} as const

export type Segmentos = typeof segmentos
export type SegmentoId = keyof Segmentos
export type TipoProdutoDe<S extends SegmentoId> = Segmentos[S]["tiposProduto"][number]
export type TipoOpcaoDe<S extends SegmentoId> = Segmentos[S]["tiposOpcao"][number]
