import {
  CreditCardIcon,
  LayoutGridIcon,
  LayoutTemplateIcon,
  type LucideIcon,
  MessageCircleIcon,
  PaletteIcon,
  ReceiptTextIcon,
  ShoppingBagIcon,
  SparklesIcon,
  StoreIcon,
  ToggleRightIcon,
  TypeIcon,
  UtensilsIcon,
} from "lucide-react"
import type { Config, SecaoConfig } from "./config"

/** Telas da loja que a prévia sabe desenhar. */
export type TelaPrevia =
  | "inicio"
  | "produto"
  | "sacola"
  | "finalizar"
  | "acompanhamento"
  | "conversa"

export const ROTULO_TELA: Record<TelaPrevia, string> = {
  inicio: "Cardápio",
  produto: "Produto",
  sacola: "Sacola",
  finalizar: "Finalizar",
  acompanhamento: "Acompanhar",
  conversa: "WhatsApp",
}

export type GrupoSecoes = "Marca" | "Aparência" | "Telas" | "Recursos"

export type InfoSecao = {
  id: SecaoConfig
  grupo: GrupoSecoes
  titulo: string
  descricao: string
  icone: LucideIcon
  /** Tela que a prévia abre ao entrar na seção. */
  tela: TelaPrevia
  /** Palavras extras para a busca de configurações encontrar a seção. */
  termos: string
}

/**
 * Índice de todas as configurações. Uma seção nova entra aqui e em
 * `components/admin/secoes/registro.tsx`; a barra lateral, a busca e as rotas saem daqui.
 */
export const SECOES: InfoSecao[] = [
  {
    id: "identidade",
    grupo: "Marca",
    titulo: "Identidade",
    descricao: "Nome, subtítulo, logo, banner e imagem de fundo.",
    icone: StoreIcon,
    tela: "inicio",
    termos: "nome subtitulo slogan logo banner capa foto fundo imagem",
  },
  {
    id: "cores",
    grupo: "Aparência",
    titulo: "Cores e botões",
    descricao: "Paleta da marca, estilo dos botões de ação e cantos.",
    icone: PaletteIcon,
    tela: "inicio",
    termos: "cor cores paleta botao botoes acao cantos arredondado tema escuro claro",
  },
  {
    id: "tipografia",
    grupo: "Aparência",
    titulo: "Tipografia",
    descricao: "Fontes dos títulos e do texto, tamanho e títulos de seção.",
    icone: TypeIcon,
    tela: "inicio",
    termos: "fonte fontes letra texto titulo tamanho",
  },
  {
    id: "animacoes",
    grupo: "Aparência",
    titulo: "Animações",
    descricao: "Entrada da página, abertura do produto e efeitos de toque.",
    icone: SparklesIcon,
    tela: "inicio",
    termos: "animacao animacoes entrada saida movimento efeito hover velocidade",
  },
  {
    id: "inicio",
    grupo: "Telas",
    titulo: "Página inicial",
    descricao: "Ordem das seções, cabeçalho e o que aparece na página.",
    icone: LayoutTemplateIcon,
    tela: "inicio",
    termos: "ordem blocos secoes arrastar wireframe carrossel categorias bebidas cabecalho",
  },
  {
    id: "cards",
    grupo: "Telas",
    titulo: "Produtos e cards",
    descricao: "Modelo do card, itens por linha ou coluna e espaçamento.",
    icone: LayoutGridIcon,
    tela: "inicio",
    termos: "card cards produto modelo grade lista coluna colunas linha disposicao carrossel",
  },
  {
    id: "produto",
    grupo: "Telas",
    titulo: "Tela do produto",
    descricao: "Como o produto abre, prévia ilustrada e passos de escolha.",
    icone: UtensilsIcon,
    tela: "produto",
    termos: "produto detalhe montar pizza opcoes observacao adicionar",
  },
  {
    id: "sacola",
    grupo: "Telas",
    titulo: "Sacola",
    descricao: "Formato da sacola, pedido mínimo e sugestões.",
    icone: ShoppingBagIcon,
    tela: "sacola",
    termos: "sacola carrinho minimo sugestoes",
  },
  {
    id: "finalizar",
    grupo: "Telas",
    titulo: "Finalizar pedido",
    descricao: "Etapas, formas de pagamento, cupom e carregamento do envio.",
    icone: CreditCardIcon,
    tela: "finalizar",
    termos: "checkout finalizar pagamento pix cartao dinheiro cupom gorjeta cpf envio",
  },
  {
    id: "acompanhamento",
    grupo: "Telas",
    titulo: "Acompanhar pedido",
    descricao: "Topo da tela, linha do tempo, mapa e avaliação.",
    icone: ReceiptTextIcon,
    tela: "acompanhamento",
    termos: "pedido acompanhar status mapa avaliacao agradecimento",
  },
  {
    id: "conversa",
    grupo: "Telas",
    titulo: "Conversa no WhatsApp",
    descricao: "Mensagem de boas-vindas e resumo do pedido no chat.",
    icone: MessageCircleIcon,
    tela: "conversa",
    termos: "whatsapp conversa chat mensagem saudacao",
  },
  {
    id: "recursos",
    grupo: "Recursos",
    titulo: "Funcionalidades",
    descricao: "Liga e desliga busca, compartilhar, fidelidade e mais.",
    icone: ToggleRightIcon,
    tela: "inicio",
    termos: "recursos funcionalidades busca compartilhar tema horario fidelidade popup whatsapp",
  },
]

export const GRUPOS: GrupoSecoes[] = ["Marca", "Aparência", "Telas", "Recursos"]

export function buscarSecao(id: string) {
  return SECOES.find((secao) => secao.id === id)
}

/** Ignora acentos e maiúsculas, para "animacao" achar "Animações". */
export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

/** Seções em que o rascunho do editor difere do que está publicado no site. */
export function secoesAlteradas(rascunho: Config, publicada: Config): InfoSecao[] {
  return SECOES.filter(({ id }) => JSON.stringify(rascunho[id]) !== JSON.stringify(publicada[id]))
}

/** Onde estão as mudanças: "em Identidade", "em Identidade e Cores e botões" ou "em 3 seções". */
export function ondeMudou(secoes: Pick<InfoSecao, "titulo">[]): string {
  if (secoes.length > 2) return `em ${secoes.length} seções`
  return `em ${secoes.map((secao) => secao.titulo).join(" e ")}`
}
