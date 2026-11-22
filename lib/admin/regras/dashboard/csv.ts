import { format } from "date-fns"
import { normalizar } from "../filtro-pedidos"
import type { Periodo } from "../periodo"

/** Como a célula sai: texto, número com vírgula, dinheiro com 2 casas (sem R$) ou data dd/mm/aaaa. */
export type TipoCsv = "texto" | "numero" | "dinheiro" | "data"

export type ColunaCsv<T> = {
  titulo: string
  tipo?: TipoCsv
  valor: (linha: T) => string | number | Date | null | undefined
}

/** Sem separador de milhar, para o Excel ler como número. */
const numero = new Intl.NumberFormat("pt-BR", { useGrouping: false, maximumFractionDigits: 3 })
const dinheiro = new Intl.NumberFormat("pt-BR", {
  useGrouping: false,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function celula(valor: string | number | Date | null | undefined, tipo: TipoCsv) {
  if (valor === null || valor === undefined) return ""
  if (valor instanceof Date) return format(valor, "dd/MM/yyyy")
  if (typeof valor === "number") {
    if (tipo === "dinheiro") return dinheiro.format(valor)
    return numero.format(valor)
  }
  return /[;"\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor
}

/**
 * CSV para o Excel em português: separador `;`, vírgula decimal sem "R$", data dd/mm/aaaa,
 * linhas com CRLF e o BOM do UTF-8 na frente, para os acentos saírem certos.
 */
export function gerarCsv<T>(colunas: ColunaCsv<T>[], linhas: T[]): string {
  const cabecalho = colunas.map((coluna) => celula(coluna.titulo, "texto")).join(";")
  const corpo = linhas.map((linha) =>
    colunas.map((coluna) => celula(coluna.valor(linha), coluna.tipo ?? "texto")).join(";"),
  )
  return `﻿${[cabecalho, ...corpo].map((linha) => `${linha}\r\n`).join("")}`
}

/** "Açougue Sabor da Carne" vira "acougue-sabor-da-carne". */
const semEspaco = (texto: string) =>
  normalizar(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

/** `<loja>-<aba>[-<tabela>]-<de>-a-<ate>.csv`, sem acento nem espaço. */
export function nomeDoCsv({
  loja,
  aba,
  tabela,
  periodo,
}: {
  loja: string
  aba: string
  /** Só quando a aba tem mais de uma tabela. */
  tabela?: string
  periodo: Periodo
}) {
  const partes = [loja, aba, ...(tabela ? [tabela] : [])].map(semEspaco)
  const dia = (data: Date) => format(data, "yyyy-MM-dd")
  return `${partes.join("-")}-${dia(periodo.de)}-a-${dia(periodo.ate)}.csv`
}
