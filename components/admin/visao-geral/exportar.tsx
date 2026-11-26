"use client"

import { CheckIcon, DownloadIcon } from "lucide-react"
import { createContext, type ReactNode, useContext, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { type ColunaCsv, gerarCsv, nomeDoCsv } from "@/lib/admin/regras/dashboard/csv"
import type { Periodo } from "@/lib/admin/regras/periodo"

type Aba = { loja: string; aba: string; periodo: Periodo; imprimindo: boolean }

const ContextoDaAba = createContext<Aba | null>(null)

/** Quanto tempo o botão confirma "Baixado" antes de voltar a ser "CSV". */
const CONFIRMACAO_MS = 1600

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
  const [baixado, setBaixado] = useState(false)

  // A confirmação some sozinha: o botão volta a ser "CSV" para baixar de novo.
  useEffect(() => {
    if (!baixado) return
    const espera = setTimeout(() => setBaixado(false), CONFIRMACAO_MS)
    return () => clearTimeout(espera)
  }, [baixado])

  if (!aba) return null
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-11 print:hidden md:min-h-0"
        aria-label={`Baixar CSV: ${tabela}`}
        onClick={() => {
          baixar(
            nomeDoCsv({
              loja: aba.loja,
              aba: aba.aba,
              ...(comNomeDaTabela ? { tabela } : {}),
              periodo: aba.periodo,
            }),
            gerarCsv(colunas, linhas),
          )
          setBaixado(true)
        }}
      >
        {baixado ? (
          <CheckIcon data-icon="inline-start" className="text-(--tom-pronto)" />
        ) : (
          <DownloadIcon data-icon="inline-start" />
        )}
        {baixado ? "Baixado" : "CSV"}
      </Button>
      {baixado && (
        <span role="status" className="sr-only">
          CSV baixado: {tabela}
        </span>
      )}
    </>
  )
}
