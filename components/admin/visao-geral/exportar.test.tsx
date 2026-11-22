import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { BaixarCsv, ProvedorDaAba } from "./exportar"

afterEach(() => vi.restoreAllMocks())

describe("BaixarCsv", () => {
  test("baixa a tabela em CSV com o nome da loja, da aba e do período", async () => {
    const usuario = userEvent.setup()
    let arquivo: Blob | undefined
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (blob: Blob) => {
        arquivo = blob
        return "blob:csv"
      },
      revokeObjectURL: vi.fn(),
    })
    const clique = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {})

    render(
      <ProvedorDaAba
        loja="Casa da Pizza"
        aba="Entrega"
        periodo={{ de: new Date(2026, 10, 7), ate: new Date(2026, 10, 13) }}
      >
        <BaixarCsv
          tabela="Por bairro"
          colunas={[
            { titulo: "Bairro", valor: (linha: { bairro: string; total: number }) => linha.bairro },
            { titulo: "Faturamento", tipo: "dinheiro", valor: (linha) => linha.total },
          ]}
          linhas={[{ bairro: "Centro", total: 727 }]}
        />
      </ProvedorDaAba>,
    )
    await usuario.click(screen.getByRole("button", { name: "Baixar CSV: Por bairro" }))

    expect(clique).toHaveBeenCalledOnce()
    const link = clique.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toBe("casa-da-pizza-entrega-2026-11-07-a-2026-11-13.csv")
    expect(link.href).toBe("blob:csv")
    expect(arquivo?.type).toBe("text/csv;charset=utf-8")
    // O `text()` do Blob descarta o BOM: lê os bytes como estão.
    const bytes = await (arquivo as Blob).arrayBuffer()
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)).toBe(
      "﻿Bairro;Faturamento\r\nCentro;727,00\r\n",
    )
    vi.unstubAllGlobals()
  })

  test("com o nome da tabela no arquivo, quando a aba tem mais de uma", async () => {
    const usuario = userEvent.setup()
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:csv", revokeObjectURL: vi.fn() })
    const clique = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {})
    render(
      <ProvedorDaAba
        loja="Drogaria"
        aba="Farmácia"
        periodo={{ de: new Date(2026, 10, 13), ate: new Date(2026, 10, 13) }}
      >
        <BaixarCsv
          tabela="Saldo dos controlados"
          comNomeDaTabela
          colunas={[{ titulo: "Produto", valor: (linha: { nome: string }) => linha.nome }]}
          linhas={[{ nome: "Clonazepam" }]}
        />
      </ProvedorDaAba>,
    )
    await usuario.click(screen.getByRole("button", { name: "Baixar CSV: Saldo dos controlados" }))
    expect((clique.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      "drogaria-farmacia-saldo-dos-controlados-2026-11-13-a-2026-11-13.csv",
    )
    vi.unstubAllGlobals()
  })
})
