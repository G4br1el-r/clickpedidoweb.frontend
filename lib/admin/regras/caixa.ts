/**
 * Turno de caixa do PDV: contagem, resumo, sangria e fechamento com
 * conferência (ver docs/plano-pdv.md, "Turno de caixa").
 */

import type {
  Conferencia,
  ConfigLoja,
  ConfigPdv,
  FormaNoCaixa,
  MembroEquipe,
  Pedido,
  TurnoCaixa,
} from "@/lib/admin/dados/tipos"
import { emReais } from "@/lib/formato"

/** Cédulas e moedas da contagem, da maior para a menor. */
export const CEDULAS: readonly number[] = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05]

const PADRAO_PDV: ConfigPdv = { fundoSugerido: 100, alertaSangria: 500 }
const FUNDO_MAXIMO = 9999
const JUSTIFICATIVA_MINIMA = 5

const centavos = (valor: number) => Math.round(valor * 100) / 100

/** Total da contagem; `quantidades[i]` é quantas há de `CEDULAS[i]`. */
export function totalDaContagem(quantidades: readonly number[]): number {
  return quantidades.reduce(
    (total, quantidade, i) => centavos(total + quantidade * (CEDULAS[i] ?? 0)),
    0,
  )
}

export function configPdv(loja: ConfigLoja): ConfigPdv {
  return loja.pdv ?? PADRAO_PDV
}

export type ResumoTurno = {
  vendas: number
  total: number
  ticketMedio: number
  porForma: Record<FormaNoCaixa, number>
  sangrias: number
  suprimentos: number
  dinheiroNaGaveta: number
}

/** Vendas do turno (sem as canceladas) e o dinheiro que deve estar na gaveta. */
export function resumoDoTurno(turno: TurnoCaixa, pedidos: Pedido[]): ResumoTurno {
  const porForma: Record<FormaNoCaixa, number> = { dinheiro: 0, pix: 0, "cartao-na-entrega": 0 }
  let vendas = 0
  let total = 0
  for (const pedido of pedidos) {
    if (pedido.turnoId !== turno.id || pedido.status === "cancelado") continue
    vendas++
    total = centavos(total + pedido.total)
    if (pedido.pagamento in porForma) {
      const forma = pedido.pagamento as FormaNoCaixa
      porForma[forma] = centavos(porForma[forma] + pedido.total)
    }
  }
  const somaDe = (tipo: "sangria" | "suprimento") =>
    turno.movimentos
      .filter((movimento) => movimento.tipo === tipo)
      .reduce((soma, movimento) => centavos(soma + movimento.valor), 0)
  const sangrias = somaDe("sangria")
  const suprimentos = somaDe("suprimento")
  return {
    vendas,
    total,
    ticketMedio: vendas ? centavos(total / vendas) : 0,
    porForma,
    sangrias,
    suprimentos,
    dinheiroNaGaveta: centavos(turno.fundo + porForma.dinheiro + suprimentos - sangrias),
  }
}

export function precisaSangria(resumo: ResumoTurno, config: ConfigPdv): boolean {
  return resumo.dinheiroNaGaveta > config.alertaSangria
}

export function errosDoFundo(fundo: number): string | undefined {
  if (fundo >= 0 && fundo <= FUNDO_MAXIMO) return undefined
  return `O fundo vai de ${emReais(0)} a ${emReais(FUNDO_MAXIMO)}.`
}

export function errosDoMovimentoCaixa(
  movimento: { tipo: "sangria" | "suprimento"; valor: number; motivo: string },
  dinheiroNaGaveta: number,
): string | undefined {
  if (!(movimento.valor > 0)) return "Informe um valor maior que zero."
  if (movimento.motivo.trim().length < 3) return "Diga o motivo."
  if (movimento.tipo === "sangria" && movimento.valor > dinheiroNaGaveta) {
    return `A gaveta só tem ${emReais(dinheiroNaGaveta)}.`
  }
  return undefined
}

/** Pix e cartão chegam conciliados; só o dinheiro é contado. */
export function conferir(
  resumo: ResumoTurno,
  contadoDinheiro: number,
  justificativa?: string,
): Conferencia {
  const esperado = { ...resumo.porForma, dinheiro: resumo.dinheiroNaGaveta }
  return {
    esperado,
    contado: { ...esperado, dinheiro: centavos(contadoDinheiro) },
    ...(justificativa === undefined ? {} : { justificativa }),
  }
}

/** Contado − esperado no dinheiro: negativo é falta. */
export function diferencaDinheiro(conferencia: Conferencia): number {
  return centavos(conferencia.contado.dinheiro - conferencia.esperado.dinheiro)
}

/** Diferença com sinal: "−R$ 2,00" ou "+R$ 3,00". */
export function diferencaEmReais(diferenca: number): string {
  if (diferenca === 0) return emReais(0)
  return `${diferenca < 0 ? "−" : "+"}${emReais(Math.abs(diferenca))}`
}

export function errosDoFechamento(conferencia: Conferencia): string | undefined {
  const diferenca = diferencaDinheiro(conferencia)
  if (diferenca === 0) return undefined
  if ((conferencia.justificativa ?? "").trim().length >= JUSTIFICATIVA_MINIMA) return undefined
  return `Justifique a diferença de ${diferencaEmReais(diferenca)}.`
}

/** O turno é de quem abriu; gerente e dono também mexem nele. */
export function podeOperarTurno(membro: MembroEquipe, turno: TurnoCaixa): boolean {
  return membro.perfil !== "caixa" || membro.id === turno.abertoPor
}
