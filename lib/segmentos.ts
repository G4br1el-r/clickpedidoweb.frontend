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
  adega: {
    nome: "Adega",
    tiposProduto: ["produto"],
    tiposOpcao: ["opcao"],
  },
  acougue: {
    nome: "Açougue",
    tiposProduto: ["produto"],
    tiposOpcao: ["opcao"],
  },
  salao: {
    nome: "Salão de beleza",
    tiposProduto: ["produto"],
    tiposOpcao: ["opcao"],
  },
  lanchonete: {
    nome: "Lanchonete",
    tiposProduto: ["produto"],
    tiposOpcao: ["opcao"],
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
  adega: {
    busca: "Buscar cerveja, destilado, combo",
    destaques: "Mais vendidos",
    buscaVazia: "Tente buscar pelo nome da bebida ou da marca.",
    preparo: "Seu pedido está sendo separado e gelado.",
    preparoCurto: { titulo: "Separando", texto: "Tudo bem gelado" },
    preparoConversa: "Já estamos separando e gelando seu pedido.",
    fim: "Saúde! Obrigado pela preferência.",
    fimCurto: "Saúde!",
  },
  acougue: {
    busca: "Buscar corte, linguiça, carvão",
    destaques: "Mais pedidos",
    buscaVazia: "Tente buscar pelo nome do corte.",
    preparo: "O açougueiro está cortando e pesando seu pedido.",
    preparoCurto: { titulo: "Na pesagem", texto: "Cortado e pesado na hora" },
    preparoConversa: "O açougueiro já está cortando e pesando seu pedido.",
    fim: "Bom churrasco! Obrigado pela preferência.",
    fimCurto: "Bom churrasco!",
  },
  salao: {
    busca: "Buscar serviço",
    destaques: "Mais procurados",
    buscaVazia: "Tente buscar pelo nome do serviço.",
    preparo: "Seu horário está reservado. Te esperamos!",
    preparoCurto: { titulo: "Confirmado", texto: "Horário reservado" },
    preparoConversa: "Seu horário está reservado. Te esperamos no salão!",
    fim: "Obrigada pela visita! Volte sempre.",
    fimCurto: "Volte sempre!",
  },
  lanchonete: {
    busca: "Buscar lanche, pastel, bebida",
    destaques: "Mais pedidos",
    buscaVazia: "Tente buscar por outro lanche ou bebida.",
    preparo: "Seu lanche está na chapa.",
    preparoCurto: { titulo: "Na chapa", texto: "Seu lanche sendo feito" },
    preparoConversa: "Seu lanche já está na chapa.",
    fim: "Bom apetite! Obrigado pela preferência.",
    fimCurto: "Bom apetite!",
  },
} satisfies Record<SegmentoId, unknown>

export function textosDoSegmento(segmento: SegmentoId) {
  return TEXTOS[segmento]
}
