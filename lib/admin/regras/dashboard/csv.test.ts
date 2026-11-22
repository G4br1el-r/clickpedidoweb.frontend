import { describe, expect, test } from "vitest"
import { gerarCsv, nomeDoCsv } from "./csv"

const BOM = "﻿"

describe("gerarCsv", () => {
  test("para o Excel em português: ponto e vírgula, vírgula decimal sem R$, data dd/mm/aaaa e BOM", () => {
    const linhas = [
      { dia: new Date(2026, 10, 13, 20), pedidos: 12, faturamento: 1706.5, ticket: 142.208 },
      { dia: new Date(2026, 10, 12), pedidos: 0, faturamento: 0, ticket: 0 },
    ]
    expect(
      gerarCsv(
        [
          { titulo: "Dia", tipo: "data", valor: (linha) => linha.dia },
          { titulo: "Pedidos", tipo: "numero", valor: (linha) => linha.pedidos },
          { titulo: "Faturamento", tipo: "dinheiro", valor: (linha) => linha.faturamento },
          { titulo: "Ticket médio", tipo: "dinheiro", valor: (linha) => linha.ticket },
        ],
        linhas,
      ),
    ).toBe(
      `${BOM}Dia;Pedidos;Faturamento;Ticket médio\r\n13/11/2026;12;1706,50;142,21\r\n12/11/2026;0;0,00;0,00\r\n`,
    )
  })

  test("texto com ponto e vírgula, aspas ou quebra de linha vai entre aspas; vazio fica vazio", () => {
    const linhas = [
      { nome: 'Pizza "da casa"; grande', obs: "linha 1\nlinha 2", kg: 1.25 },
      { nome: "Coca", obs: undefined, kg: undefined },
    ]
    expect(
      gerarCsv(
        [
          { titulo: "Produto", valor: (linha) => linha.nome },
          { titulo: "Obs.", valor: (linha) => linha.obs },
          { titulo: "Kg", tipo: "numero", valor: (linha) => linha.kg },
        ],
        linhas,
      ),
    ).toBe(
      `${BOM}Produto;Obs.;Kg\r\n"Pizza ""da casa""; grande";"linha 1\nlinha 2";1,25\r\nCoca;;\r\n`,
    )
  })
})

describe("nomeDoCsv", () => {
  test("loja, aba e o período, sem acento nem espaço", () => {
    expect(
      nomeDoCsv({
        loja: "Açougue Sabor da Carne",
        aba: "Operação",
        periodo: { de: new Date(2026, 10, 7), ate: new Date(2026, 10, 13) },
      }),
    ).toBe("acougue-sabor-da-carne-operacao-2026-11-07-a-2026-11-13.csv")
  })

  test("com mais de uma tabela na aba, o nome da tabela entra depois da aba", () => {
    expect(
      nomeDoCsv({
        loja: "Drogaria Bem Estar",
        aba: "Farmácia",
        tabela: "Saldo dos controlados",
        periodo: { de: new Date(2026, 10, 13), ate: new Date(2026, 10, 13) },
      }),
    ).toBe("drogaria-bem-estar-farmacia-saldo-dos-controlados-2026-11-13-a-2026-11-13.csv")
  })
})
