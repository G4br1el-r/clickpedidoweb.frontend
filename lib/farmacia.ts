import type { DadosMedicamento } from "./admin/dados/tipos"
import { receitaExigida } from "./admin/regras/farmacia"

/**
 * Como a farmácia pode vender o item pela internet (RDC 44/2009):
 * - "livre": vai direto para a sacola.
 * - "receita": o cliente manda a foto da receita ao finalizar.
 * - "receita-retida": manda a foto e entrega a via da receita ao motoboy ou no balcão.
 * - "so-balcao": controlado da Portaria 344; não tem venda à distância.
 */
export type ModoVenda = "livre" | "receita" | "receita-retida" | "so-balcao"

export function comoVender(medicamento: DadosMedicamento | undefined): ModoVenda {
  if (!medicamento) return "livre"
  const receita = receitaExigida(medicamento)
  if (receita === null) return "livre"
  if (receita === "simples") return "receita"
  if (receita === "antimicrobiano") return "receita-retida"
  return "so-balcao"
}

/** O que a sacola pede de receita no fechamento; `null` quando nenhum item precisa. */
export function receitaDaSacola(
  itens: { nome: string; venda?: ModoVenda }[],
): { itens: string[]; retida: boolean } | null {
  const comReceita = itens.filter(
    (item) => item.venda === "receita" || item.venda === "receita-retida",
  )
  if (comReceita.length === 0) return null
  return {
    itens: comReceita.map((item) => item.nome),
    retida: comReceita.some((item) => item.venda === "receita-retida"),
  }
}

/** Registro na Anvisa no formato da embalagem: 1.0235.0893.006-4. */
export function formatarRegistroMs(registro: string): string {
  const partes = registro.match(/^(\d)(\d{4})(\d{4})(\d{3})(\d)$/)
  return partes ? `${partes[1]}.${partes[2]}.${partes[3]}.${partes[4]}-${partes[5]}` : registro
}
