"use client"

import { DownloadIcon } from "lucide-react"
import { createContext, type ReactNode, useContext } from "react"
import { Button } from "@/components/ui/button"
import { type ColunaCsv, gerarCsv, nomeDoCsv } from "@/lib/admin/regras/dashboard/csv"
import type { Periodo } from "@/lib/admin/regras/periodo"

type Aba = { loja: string; aba: string; periodo: Periodo; imprimindo: boolean }

const ContextoDaAba = createContext<Aba | null>(null)

/** A aba aberta: dá nome aos arquivos e diz se está sendo impressa. */
export function ProvedorDaAba({
  loja,
  aba,
  periodo,
  imprimindo = false,
  children,
}: Omit<Aba, "imprimindo"> & { imprimindo?: boolean; children: ReactNode }) {
  return (
    <ContextoDaAba.Provider value={{ loja, aba, periodo, imprimindo }}>
      {children}
    </ContextoDaAba.Provider>
  )
}

/** Na impressão, as tabelas recolhidas se abrem. */
export const useImprimindo = () => useContext(ContextoDaAba)?.imprimindo ?? false

/** Entrega o texto como um arquivo para o navegador baixar. */
function baixar(nome: string, conteudo: string) {
  const endereco = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = endereco
  link.download = nome
  link.click()
  URL.revokeObjectURL(endereco)
}

/** Botão que baixa a tabela em CSV, no formato do Excel em português. Some na impressão. */
export function BaixarCsv<T>({
  tabela,
  colunas,
  linhas,
  comNomeDaTabela = false,
}: {
  tabela: string
  colunas: ColunaCsv<T>[]
  linhas: T[]
  /** Põe o nome da tabela no arquivo, quando a aba tem mais de uma. */
  comNomeDaTabela?: boolean
}) {
  const aba = useContext(ContextoDaAba)
  if (!aba) return null
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="print:hidden"
      aria-label={`Baixar CSV: ${tabela}`}
      onClick={() =>
        baixar(
          nomeDoCsv({
            loja: aba.loja,
            aba: aba.aba,
            ...(comNomeDaTabela ? { tabela } : {}),
            periodo: aba.periodo,
          }),
          gerarCsv(colunas, linhas),
        )
      }
    >
      <DownloadIcon data-icon="inline-start" />
      CSV
    </Button>
  )
}
