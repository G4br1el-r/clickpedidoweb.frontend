import type { ConfigSalao, Mesa, PosicaoMesa } from "../dados/tipos"

/** As funções Pro do salão, com o preço mensal proposto (decorrência 6). */
export const FUNCOES_PRO_SALAO: Record<
  keyof ConfigSalao["funcoes"],
  { nome: string; preco: number }
> = {
  mapa: { nome: "Mapa do salão", preco: 19.9 },
  reservas: { nome: "Reservas e lista de espera", preco: 24.9 },
  qr: { nome: "QR na mesa", preco: 39.9 },
}

/** Grade do mapa de cada área, em células. */
export const GRADE_MAPA = { colunas: 24, linhas: 16 } as const

/** Tamanho da mesa no mapa, em células: quadrada e redonda 2 × 2, retangular 3 × 2 (4 × 2 com mais de 6 lugares). */
export function tamanhoDaMesa(mesa: Pick<Mesa, "forma" | "lugares">): {
  largura: number
  altura: number
} {
  if (mesa.forma !== "retangular") return { largura: 2, altura: 2 }
  return { largura: mesa.lugares > 6 ? 4 : 3, altura: 2 }
}

type Retangulo = Pick<Mesa, "forma" | "lugares" | "posicao">

/** Duas mesas se cruzam quando seus retângulos no mapa se sobrepõem; encostar na borda não conta. */
export function mesasSeCruzam(a: Retangulo, b: Retangulo): boolean {
  const ta = tamanhoDaMesa(a)
  const tb = tamanhoDaMesa(b)
  return (
    a.posicao.x < b.posicao.x + tb.largura &&
    b.posicao.x < a.posicao.x + ta.largura &&
    a.posicao.y < b.posicao.y + tb.altura &&
    b.posicao.y < a.posicao.y + ta.altura
  )
}

/** O que o mapa precisa saber de uma mesa para desenhá-la e conferir onde ela está. */
export type MesaNoMapa = Pick<Mesa, "id" | "areaId" | "forma" | "lugares" | "posicao">

/** A mesa cruza alguma outra da mesma área? Ela mesma (pelo id) não conta. */
export function colide(mesa: MesaNoMapa, mesas: MesaNoMapa[]): boolean {
  return mesas.some(
    (outra) => outra.id !== mesa.id && outra.areaId === mesa.areaId && mesasSeCruzam(mesa, outra),
  )
}

/** Posição válida: coordenadas inteiras, a mesa inteira dentro do mapa e sem colidir. */
export function posicaoValida(mesa: MesaNoMapa, mesas: MesaNoMapa[]): boolean {
  const { x, y } = mesa.posicao
  const { largura, altura } = tamanhoDaMesa(mesa)
  const dentro =
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x + largura <= GRADE_MAPA.colunas &&
    y + altura <= GRADE_MAPA.linhas
  return dentro && !colide(mesa, mesas)
}

/** Prende a posição dentro do mapa, contando o tamanho da mesa. */
export function noMapa(mesa: Pick<Mesa, "forma" | "lugares">, posicao: PosicaoMesa): PosicaoMesa {
  const { largura, altura } = tamanhoDaMesa(mesa)
  const limitar = (valor: number, maximo: number) => Math.min(Math.max(valor, 0), maximo)
  return {
    x: limitar(posicao.x, GRADE_MAPA.colunas - largura),
    y: limitar(posicao.y, GRADE_MAPA.linhas - altura),
  }
}

export type Direcao = "esquerda" | "direita" | "cima" | "baixo"

const PASSO: Record<Direcao, PosicaoMesa> = {
  esquerda: { x: -1, y: 0 },
  direita: { x: 1, y: 0 },
  cima: { x: 0, y: -1 },
  baixo: { x: 0, y: 1 },
}

/**
 * Seta move 1 célula e Shift+seta 4, parando na borda. Não recusa a colisão: no rascunho a mesa
 * pode passar por cima de outra (é o único jeito de atravessá-la pelo teclado).
 */
export function moverPorTeclado(
  mesa: Pick<Mesa, "forma" | "lugares" | "posicao">,
  direcao: Direcao,
  passo: 1 | 4,
): PosicaoMesa {
  const { x, y } = PASSO[direcao]
  return noMapa(mesa, { x: mesa.posicao.x + x * passo, y: mesa.posicao.y + y * passo })
}

/**
 * Onde a mesa cai depois de arrastada: o deslocamento em pixels vira células, arredondadas
 * para a mais próxima (o encaixe), e a mesa para na borda. Como no teclado, não recusa colisão.
 */
export function arrastar(
  mesa: Pick<Mesa, "forma" | "lugares" | "posicao">,
  deslocamento: { x: number; y: number },
  celula: { largura: number; altura: number },
): PosicaoMesa {
  const celulas = (pixels: number, tamanho: number) => Math.round(pixels / tamanho)
  return noMapa(mesa, {
    x: mesa.posicao.x + celulas(deslocamento.x, celula.largura),
    y: mesa.posicao.y + celulas(deslocamento.y, celula.altura),
  })
}

/** A posição como o leitor de tela fala, contando de 1: "coluna 3, linha 2". */
export function descreverPosicao(posicao: PosicaoMesa): string {
  return `coluna ${posicao.x + 1}, linha ${posicao.y + 1}`
}

/**
 * Primeira posição do mapa da área em que a mesa nova cabe: varre linha a linha, da esquerda
 * para a direita, e recusa o que cruza outra mesa da mesma área (encostar na borda vale).
 * Devolve null quando a área não tem mais espaço.
 */
export function primeiraPosicaoLivre(
  mesas: Mesa[],
  areaId: string,
  nova: Pick<Mesa, "forma" | "lugares">,
): PosicaoMesa | null {
  const { largura, altura } = tamanhoDaMesa(nova)
  const daArea = mesas.filter((mesa) => mesa.areaId === areaId)
  for (let y = 0; y + altura <= GRADE_MAPA.linhas; y++) {
    for (let x = 0; x + largura <= GRADE_MAPA.colunas; x++) {
      const candidata = { ...nova, posicao: { x, y } }
      if (!daArea.some((outra) => mesasSeCruzam(candidata, outra))) return { x, y }
    }
  }
  return null
}
