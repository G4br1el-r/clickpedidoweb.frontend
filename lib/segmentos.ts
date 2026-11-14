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
  farmacia: {
    nome: "Farmácia",
    tiposProduto: ["medicamento", "vitamina", "dermocosmetico", "higiene", "infantil"],
    // Remédio não se monta: a apresentação já vem na embalagem.
    tiposOpcao: [],
  },
} as const

export type Segmentos = typeof segmentos
export type SegmentoId = keyof Segmentos
export type TipoProdutoDe<S extends SegmentoId> = Segmentos[S]["tiposProduto"][number]
export type TipoOpcaoDe<S extends SegmentoId> = Segmentos[S]["tiposOpcao"][number]

/** O que a vitrine e o acompanhamento dizem em cada segmento. */
const TEXTOS = {
  pizzaria: {
    busca: "Buscar pizza, borda, bebida",
    destaques: "Mais pedidas",
    buscaVazia: "Tente buscar por outro sabor ou produto.",
    preparo: "Sua pizza está no forno a lenha.",
    preparoCurto: { titulo: "No forno", texto: "Sua pizza sendo feita" },
    preparoConversa: "Sua pizza já está indo para o forno a lenha.",
    fim: "Bom apetite! Obrigado pela preferência.",
    fimCurto: "Bom apetite!",
  },
  farmacia: {
    busca: "Buscar remédio ou princípio ativo",
    destaques: "Mais vendidos",
    buscaVazia: "Tente pelo nome do remédio ou pelo princípio ativo.",
    preparo: "A farmacêutica está conferindo e separando seus itens.",
    preparoCurto: { titulo: "Separando", texto: "Conferido pela farmacêutica" },
    preparoConversa: "A farmacêutica já está conferindo e separando seus itens.",
    fim: "Melhoras! Obrigado pela preferência.",
    fimCurto: "Melhoras!",
  },
} satisfies Record<SegmentoId, unknown>

export function textosDoSegmento(segmento: SegmentoId) {
  return TEXTOS[segmento]
}
