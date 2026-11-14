/**
 * Catálogo de segmentos do painel. Cada segmento espelha uma loja de hoje e
 * define quais módulos aparecem no menu (ver docs/plano-painel-admin.md).
 */

import {
  ArmchairIcon,
  BeefIcon,
  BikeIcon,
  BookOpenIcon,
  BoxesIcon,
  CalculatorIcon,
  CalendarDaysIcon,
  ChefHatIcon,
  ConciergeBellIcon,
  FileHeartIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MapPinnedIcon,
  PackageSearchIcon,
  PillIcon,
  PizzaIcon,
  ReceiptTextIcon,
  SandwichIcon,
  ScissorsIcon,
  Settings2Icon,
  ShieldAlertIcon,
  SquareKanbanIcon,
  TagsIcon,
  WineIcon,
} from "lucide-react"

export type SegmentoPainelId =
  | "adega"
  | "acougue"
  | "pizzaria"
  | "salao"
  | "lanchonete"
  | "farmacia"

export type InfoSegmento = {
  id: SegmentoPainelId
  nome: string
  /** Loja de hoje que serve de referência e dá nome aos dados de demonstração. */
  loja: string
  icone: LucideIcon
  /** Logo da loja de referência, em `/public`. */
  logo: string
}

export const SEGMENTOS_PAINEL: readonly InfoSegmento[] = [
  {
    id: "adega",
    nome: "Adega",
    loja: "Adega da Vila",
    icone: WineIcon,
    logo: "/mock/admin/adega/logo.jpg",
  },
  {
    id: "acougue",
    nome: "Açougue",
    loja: "Açougue Sabor da Carne",
    icone: BeefIcon,
    logo: "/mock/admin/acougue/logo.jpg",
  },
  {
    id: "pizzaria",
    nome: "Pizzaria",
    loja: "Casa da Pizza",
    icone: PizzaIcon,
    logo: "/mock/logo.webp",
  },
  {
    id: "salao",
    nome: "Salão de beleza",
    loja: "Empório das Deusas",
    icone: ScissorsIcon,
    logo: "/mock/admin/salao/logo.jpg",
  },
  {
    id: "lanchonete",
    nome: "Lanchonete",
    loja: "Quiosque do Mineiro",
    icone: SandwichIcon,
    logo: "/mock/admin/lanchonete/logo.jpg",
  },
  // Sempre no fim: a posição na lista semeia os pedidos de demonstração de cada segmento.
  {
    id: "farmacia",
    nome: "Farmácia",
    loja: "Drogaria Bem Estar",
    icone: PillIcon,
    logo: "/mock/admin/farmacia/logo.svg",
  },
]

export function ehSegmentoPainel(id: unknown): id is SegmentoPainelId {
  return SEGMENTOS_PAINEL.some((segmento) => segmento.id === id)
}

export function buscarSegmento(id: SegmentoPainelId): InfoSegmento {
  // O tipo garante que o id existe na lista.
  return SEGMENTOS_PAINEL.find((segmento) => segmento.id === id) as InfoSegmento
}

export type ModuloId =
  | "visao-geral"
  | "agendamentos"
  | "fila"
  | "pdv"
  | "cozinha"
  | "mesas"
  | "garcom"
  | "receitas"
  | "controlados"
  | "validade"
  | "pedidos"
  | "cardapio"
  | "categorias"
  | "estoque"
  | "motoboys"
  | "bairros"
  | "loja"

/** Módulos de comida com salão e entrega (adega, açougue, pizzaria). */
const COMPLETO: readonly ModuloId[] = [
  "visao-geral",
  "fila",
  "pdv",
  "cozinha",
  "mesas",
  "garcom",
  "pedidos",
  "cardapio",
  "categorias",
  "estoque",
  "motoboys",
  "bairros",
  "loja",
]

const MODULOS: Record<SegmentoPainelId, readonly ModuloId[]> = {
  adega: COMPLETO,
  acougue: COMPLETO,
  pizzaria: COMPLETO,
  // Empório das Deusas: atendimento no salão, sem entrega e sem mesas.
  salao: [
    "visao-geral",
    "agendamentos",
    "fila",
    "pdv",
    "pedidos",
    "cardapio",
    "categorias",
    "estoque",
    "loja",
  ],
  // Quiosque do Mineiro: sem PDV.
  lanchonete: COMPLETO.filter((modulo) => modulo !== "pdv"),
  // Drogaria Bem Estar: balcão e entrega, com receitas, controlados e validade dos lotes.
  farmacia: [
    "visao-geral",
    "fila",
    "pdv",
    "receitas",
    "controlados",
    "validade",
    "pedidos",
    "cardapio",
    "categorias",
    "estoque",
    "motoboys",
    "bairros",
    "loja",
  ],
}

export function temModulo(segmento: SegmentoPainelId, modulo: ModuloId): boolean {
  return MODULOS[segmento].includes(modulo)
}

export type GrupoMenu = "Operação" | "Farmácia" | "Gestão" | "Entrega" | "Loja"

export type InfoModulo = {
  id: ModuloId
  titulo: string
  href: string
  grupo: GrupoMenu
  icone: LucideIcon
}

/** Todos os módulos, na ordem em que aparecem no menu. */
export const MODULOS_PAINEL: readonly InfoModulo[] = [
  {
    id: "visao-geral",
    titulo: "Visão geral",
    href: "/admin",
    grupo: "Operação",
    icone: LayoutDashboardIcon,
  },
  {
    id: "agendamentos",
    titulo: "Agendamentos",
    href: "/admin/agendamentos",
    grupo: "Operação",
    icone: CalendarDaysIcon,
  },
  {
    id: "fila",
    titulo: "Fila de pedidos",
    href: "/admin/fila",
    grupo: "Operação",
    icone: SquareKanbanIcon,
  },
  { id: "pdv", titulo: "PDV", href: "/admin/pdv", grupo: "Operação", icone: CalculatorIcon },
  {
    id: "cozinha",
    titulo: "Cozinha",
    href: "/admin/cozinha",
    grupo: "Operação",
    icone: ChefHatIcon,
  },
  { id: "mesas", titulo: "Mesas", href: "/admin/mesas", grupo: "Operação", icone: ArmchairIcon },
  {
    id: "garcom",
    titulo: "Garçom",
    href: "/admin/garcom",
    grupo: "Operação",
    icone: ConciergeBellIcon,
  },
  {
    id: "receitas",
    titulo: "Receitas",
    href: "/admin/receitas",
    grupo: "Farmácia",
    icone: FileHeartIcon,
  },
  {
    id: "controlados",
    titulo: "Controlados",
    href: "/admin/controlados",
    grupo: "Farmácia",
    icone: ShieldAlertIcon,
  },
  {
    id: "validade",
    titulo: "Lotes e validade",
    href: "/admin/validade",
    grupo: "Farmácia",
    icone: PackageSearchIcon,
  },
  {
    id: "pedidos",
    titulo: "Pedidos",
    href: "/admin/pedidos",
    grupo: "Gestão",
    icone: ReceiptTextIcon,
  },
  {
    id: "cardapio",
    titulo: "Cardápio",
    href: "/admin/cardapio",
    grupo: "Gestão",
    icone: BookOpenIcon,
  },
  {
    id: "categorias",
    titulo: "Categorias",
    href: "/admin/categorias",
    grupo: "Gestão",
    icone: TagsIcon,
  },
  {
    id: "estoque",
    titulo: "Estoque",
    href: "/admin/estoque",
    grupo: "Gestão",
    icone: BoxesIcon,
  },
  {
    id: "motoboys",
    titulo: "Motoboys",
    href: "/admin/motoboys",
    grupo: "Entrega",
    icone: BikeIcon,
  },
  {
    id: "bairros",
    titulo: "Bairros e taxas",
    href: "/admin/bairros",
    grupo: "Entrega",
    icone: MapPinnedIcon,
  },
  {
    id: "loja",
    titulo: "Configurações da loja",
    href: "/admin/loja",
    grupo: "Loja",
    icone: Settings2Icon,
  },
]

const GRUPOS_MENU: readonly GrupoMenu[] = ["Operação", "Farmácia", "Gestão", "Entrega", "Loja"]

/** Nomes que mudam com o segmento: na farmácia, o cardápio é a lista de produtos. */
const TITULOS: Partial<Record<SegmentoPainelId, Partial<Record<ModuloId, string>>>> = {
  farmacia: { cardapio: "Produtos" },
}

/** Título do módulo como o segmento o chama. */
export function tituloDoModulo(id: ModuloId, segmento: SegmentoPainelId): string {
  return TITULOS[segmento]?.[id] ?? buscarModulo(id)?.titulo ?? id
}

/** Menu do segmento: só os grupos que têm algum módulo dele, com os nomes do segmento. */
export function menuDo(segmento: SegmentoPainelId): { grupo: GrupoMenu; itens: InfoModulo[] }[] {
  return GRUPOS_MENU.map((grupo) => ({
    grupo,
    itens: MODULOS_PAINEL.filter(
      (modulo) => modulo.grupo === grupo && temModulo(segmento, modulo.id),
    ).map((modulo) => ({ ...modulo, titulo: tituloDoModulo(modulo.id, segmento) })),
  })).filter((grupo) => grupo.itens.length > 0)
}

export function buscarModulo(id: string): InfoModulo | undefined {
  return MODULOS_PAINEL.find((modulo) => modulo.id === id)
}

/** Recursos que mudam o conteúdo das páginas compartilhadas. */
export type RecursoId =
  | "adicionais"
  | "precoBalcao"
  | "vendaPorPeso"
  | "pagarAposPesagem"
  | "dataRetirada"
  | "vitrines"
  | "video"
  | "numeroMensal"
  | "combosAutomaticos"
  /** Farmácia: tarja, tipo, princípio ativo e registro do medicamento. */
  | "medicamentos"

const RECURSOS: Record<SegmentoPainelId, readonly RecursoId[]> = {
  adega: ["adicionais", "precoBalcao", "combosAutomaticos"],
  acougue: [
    "adicionais",
    "precoBalcao",
    "vendaPorPeso",
    "pagarAposPesagem",
    "dataRetirada",
    "vitrines",
  ],
  pizzaria: ["adicionais", "precoBalcao"],
  salao: ["precoBalcao", "video"],
  lanchonete: ["adicionais", "numeroMensal"],
  farmacia: ["precoBalcao", "medicamentos"],
}

export function temRecurso(segmento: SegmentoPainelId, recurso: RecursoId): boolean {
  return RECURSOS[segmento].includes(recurso)
}
