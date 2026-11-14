import type { StaticImageData } from "next/image"
import type { DadosMedicamento } from "./admin/dados/tipos"
import type { SegmentoId, TipoOpcaoDe, TipoProdutoDe } from "./segmentos"

export type Tema = {
  /** Cor principal da marca: botões e ações. */
  primaria: string
  /** Segunda cor da marca: ofertas e detalhes. */
  acento: string
  /** Fundo da página. */
  fundo: string
  /** Cor do texto. */
  tinta: string
}

export type ItemOpcao = {
  id: string
  nome: string
  descricao?: string
  /** Acréscimo no preço do produto. */
  extra: number
  imagem?: StaticImageData
  /** Cor da miniatura quando a opção não tem foto. Exemplo: borda da pizza. */
  cor?: string
  /** Faz a opção aparecer em destaque na prévia do produto. Exemplo: borda recheada. */
  realce?: boolean
}

export type GrupoOpcao<S extends SegmentoId = SegmentoId> = {
  id: string
  tipo: TipoOpcaoDe<S>
  /** Nome curto mostrado nos passos. */
  nome: string
  /** Título completo mostrado acima da lista. */
  titulo: string
  obrigatorio: boolean
  /** Em qual metade da prévia a opção aparece. */
  metade?: "esquerda" | "direita"
  itens: ItemOpcao[]
}

export type Produto<S extends SegmentoId = SegmentoId> = {
  id: string
  tipo: TipoProdutoDe<S>
  nome: string
  descricao: string
  preco: number
  precoOriginal?: number
  imagem: StaticImageData
  destaque?: boolean
  grupos?: GrupoOpcao<S>[]
  /** Farmácia: tarja, princípio ativo e registro. Decide se pede receita (lib/farmacia.ts). */
  medicamento?: DadosMedicamento
}

export type Categoria<S extends SegmentoId = SegmentoId> = {
  id: string
  nome: string
  produtos: Produto<S>[]
}

export type HorarioDia = { dia: string; horario: string }

export type BairroEntrega = { nome: string; taxa: number }

/** O que acontece ao tocar num banner: abrir um produto ou ir até uma categoria. */
export type AcaoBanner =
  | { tipo: "produto"; produtoId: string }
  | { tipo: "categoria"; categoriaId: string }

/**
 * Banners da vitrine, na ordem do mosaico: o grande, os dois quadrados e o largo.
 * Num banner que abre um produto com preço riscado, a oferta aparece no próprio banner.
 */
export type Banner = {
  id: string
  titulo: string
  texto: string
  selo?: string
  /** Texto do botão, no banner grande. */
  chamada?: string
  imagem: StaticImageData
  acao: AcaoBanner
}

export type Loja<S extends SegmentoId = SegmentoId> = {
  id: string
  segmento: S
  nome: string
  slogan: string
  logo: StaticImageData
  banner: StaticImageData
  status: { aberta: boolean; texto: string }
  /** `taxa` é a menor taxa, mostrada como "a partir de"; cada bairro tem a sua. */
  entrega: { tempo: string; taxa: number; bairros: BairroEntrega[] }
  retirada: { tempo: string }
  pedidoMinimo: number
  horarios: HorarioDia[]
  endereco: string
  telefone: string
  pagamentos: string[]
  tema: Tema
  banners?: Banner[]
}
