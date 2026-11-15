import type { ConfigLoja } from "@/lib/admin/dados/tipos"

/** Seções da tela de configurações, na ordem em que aparecem. */
export const SECOES = [
  "Loja",
  "Vitrines",
  "Horários",
  "Entrega e retirada",
  "Formas de pagamento",
  "Pagamento online",
  "Impressão",
  "Alerta sonoro",
] as const
export type SecaoLoja = (typeof SECOES)[number]

const SECAO_DO_CAMPO: Partial<Record<keyof ConfigLoja, SecaoLoja>> = {
  nome: "Loja",
  slogan: "Loja",
  telefone: "Loja",
  whatsapp: "Loja",
  endereco: "Loja",
  textoHorario: "Loja",
  videoBanner: "Loja",
  vitrines: "Vitrines",
  horarios: "Horários",
  controleAutomatico: "Horários",
  mensagemFechada: "Horários",
  aceitaEntrega: "Entrega e retirada",
  aceitaRetirada: "Entrega e retirada",
  taxaEntregaPadrao: "Entrega e retirada",
  pedidoMinimo: "Entrega e retirada",
  tempoEntrega: "Entrega e retirada",
  tempoRetirada: "Entrega e retirada",
  capacidadeAtendimentos: "Entrega e retirada",
  cidadesAtendidas: "Entrega e retirada",
  pagamentos: "Formas de pagamento",
  pagamentoOnlineConectado: "Pagamento online",
  impressaoAutomatica: "Impressão",
  cortarPapel: "Impressão",
  som: "Alerta sonoro",
}

/** O formulário marca campo a campo, até dentro de listas e objetos: basta um `true`. */
function marcado(valor: unknown): boolean {
  if (valor === true) return true
  if (Array.isArray(valor)) return valor.some(marcado)
  if (valor && typeof valor === "object") return Object.values(valor).some(marcado)
  return false
}

/** Seções com algo alterado (os `dirtyFields` do formulário), na ordem da tela. */
export function secoesAlteradas(alterados: Record<string, unknown>): SecaoLoja[] {
  const secoes = new Set<SecaoLoja>()
  for (const [campo, valor] of Object.entries(alterados)) {
    const secao = SECAO_DO_CAMPO[campo as keyof ConfigLoja]
    if (secao && marcado(valor)) secoes.add(secao)
  }
  return SECOES.filter((secao) => secoes.has(secao))
}

const lista = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" })

/** "Em Loja, Horários e Impressão": a linha de baixo da barra de salvar. */
export const resumoDasAlteracoes = (secoes: readonly string[]) =>
  secoes.length === 0 ? "" : `Em ${lista.format(secoes)}`
