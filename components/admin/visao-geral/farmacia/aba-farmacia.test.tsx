import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, test } from "vitest"
import type { DadosMedicamento, Lote, Produto, Receita } from "@/lib/admin/dados/tipos"
import { PERIODO_DE_TESTE, pedidoDeTeste } from "@/lib/admin/regras/pedidos-de-teste"
import { capturarCsv } from "../csv-de-teste"
import { ProvedorDaAba } from "../exportar"
import { AbaFarmacia } from "./aba-farmacia"

const regiao = (nome: string) => within(screen.getByRole("region", { name: nome }))
const fato = (onde: ReturnType<typeof regiao>, rotulo: string) =>
  onde.getByText(rotulo, { selector: "dt" }).closest("[data-indicador]")
const texto = (elemento: Element) => elemento.textContent?.replace(/ /g, " ")
const linhas = (nome: string) =>
  within(screen.getByRole("table", { name: nome }))
    .getAllByRole("row")
    .slice(1)
    .map((linha) => within(linha).getAllByRole("cell").map(texto))

const AGORA = new Date(2026, 10, 13, 10)

const remedio = (tipo: DadosMedicamento["tipo"], lista?: DadosMedicamento["lista"]) => ({
  tarja: "vermelha" as const,
  tipo,
  principioAtivo: "x",
  apresentacao: "x",
  laboratorio: "x",
  registroMs: "1234567890123",
  ...(lista ? { lista } : {}),
})

const produto = (
  id: string,
  nome: string,
  preco: number,
  medicamento?: DadosMedicamento,
): Produto => ({
  id,
  categoriaId: "c1",
  nome,
  descricao: "",
  preco,
  ativo: true,
  disponivel: true,
  destaque: false,
  oferta: false,
  ordem: 1,
  unidade: "un",
  grupos: [],
  ...(medicamento ? { medicamento } : {}),
})

const PRODUTOS = [
  produto("dipirona", "Dipirona 500 mg", 10, remedio("generico")),
  produto("clonazepam", "Clonazepam 2 mg", 20, remedio("generico", "B1")),
  produto("protetor", "Protetor solar", 60),
]

const lote = (id: string, produtoId: string, validade: string, quantidade: number): Lote => ({
  id,
  produtoId,
  codigo: id,
  validade,
  quantidade,
  minimo: 1,
})

const receita = (id: string, canal: Receita["canal"]): Receita => ({
  id,
  recebidaEm: new Date(2026, 10, 13, 9).toISOString(),
  canal,
  paciente: { nome: "Ana", telefone: "12991234567" },
  prescritor: { nome: "Dr. Paulo", conselho: "CRM", numero: "143278", uf: "SP" },
  tipo: "simples",
  emitidaEm: "2026-11-10",
  itens: [],
})

const item = (produtoId: string, quantidade: number, total: number) => ({
  id: produtoId,
  produtoId,
  nome: produtoId,
  quantidade,
  precoUnitario: total / quantidade,
  opcoes: [],
  total,
})

function renderizar(mudancas: Partial<ComponentProps<typeof AbaFarmacia>> = {}) {
  return render(
    <AbaFarmacia
      pedidos={[
        pedidoDeTeste(1, AGORA, 80, {
          itens: [item("dipirona", 2, 20), item("protetor", 1, 60)],
        }),
      ]}
      periodo={PERIODO_DE_TESTE}
      agora={AGORA}
      produtos={PRODUTOS}
      receitas={[receita("r1", "site"), receita("r2", "site"), receita("r3", "whatsapp")]}
      decisoes={{ r1: { situacao: "aprovada" } }}
      lotes={[
        lote("l1", "dipirona", "2026-11-10", 4),
        lote("l2", "dipirona", "2026-12-01", 10),
        lote("l3", "protetor", "2027-01-20", 2),
      ]}
      movimentos={[
        {
          id: "m1",
          produtoId: "clonazepam",
          em: "2026-11-10T10:00:00.000Z",
          tipo: "entrada",
          quantidade: 30,
          documento: "NF 1",
        },
      ]}
      {...mudancas}
    />,
  )
}

describe("AbaFarmacia", () => {
  test("o valor em risco nos lotes, pelo preço de venda", () => {
    renderizar()
    const risco = regiao("Validade dos lotes")
    expect(fato(risco, "Vencidos")).toHaveTextContent("R$ 40,00")
    expect(fato(risco, "Vencidos")).toHaveTextContent("1 lote · 4 un.")
    expect(fato(risco, "Vencem em 30 dias")).toHaveTextContent("R$ 100,00")
    expect(fato(risco, "Vencem em 31 a 90 dias")).toHaveTextContent("R$ 120,00")
    expect(fato(risco, "Total em risco")).toHaveTextContent("R$ 260,00")
  })

  test("as receitas do período por canal, com a situação de cada uma", () => {
    renderizar()
    expect(linhas("Receitas por canal")).toEqual([
      ["Site", "2", "1", "0", "1"],
      ["WhatsApp", "1", "0", "0", "1"],
    ])
  })

  test("as vendas por tipo de medicamento e o saldo de cada controlado", () => {
    renderizar()
    expect(regiao("Vendas por tipo").getAllByRole("listitem").map(texto)).toEqual([
      "Venda livre1 itemR$ 60,0075%",
      "Genérico2 itensR$ 20,0025%",
    ])
    expect(linhas("Saldo dos controlados")).toEqual([["Clonazepam 2 mg", "B1", "30"]])
  })

  test("sem receitas no período, a seção diz isso", () => {
    renderizar({ receitas: [] })
    expect(
      regiao("Receitas por canal").getByText("Nenhuma receita recebida no período."),
    ).toBeInTheDocument()
  })
})

describe("AbaFarmacia: CSV", () => {
  test("as receitas por canal e o saldo dos controlados saem em arquivos com o nome da tabela", async () => {
    const csv = capturarCsv()
    render(
      <ProvedorDaAba loja="Drogaria" aba="Farmácia" periodo={PERIODO_DE_TESTE}>
        <AbaFarmacia
          pedidos={[]}
          periodo={PERIODO_DE_TESTE}
          agora={AGORA}
          produtos={PRODUTOS}
          receitas={[receita("r1", "site")]}
          decisoes={{ r1: { situacao: "aprovada" } }}
          lotes={[]}
          movimentos={[
            {
              id: "m1",
              produtoId: "clonazepam",
              em: "2026-11-10T10:00:00.000Z",
              tipo: "entrada",
              quantidade: 30,
              documento: "NF 1",
            },
          ]}
        />
      </ProvedorDaAba>,
    )
    screen.getByRole("button", { name: "Baixar CSV: Receitas por canal" }).click()
    expect(csv.nome()).toBe("drogaria-farmacia-receitas-por-canal-2026-11-12-a-2026-11-13.csv")
    expect(await csv.texto()).toBe(
      "﻿Canal;Recebidas;Aprovadas;Recusadas;A conferir\r\nSite;1;1;0;0\r\n",
    )
    screen.getByRole("button", { name: "Baixar CSV: Saldo dos controlados" }).click()
    expect(csv.nome()).toBe("drogaria-farmacia-saldo-dos-controlados-2026-11-12-a-2026-11-13.csv")
    expect(await csv.texto()).toBe("﻿Produto;Lista;Saldo\r\nClonazepam 2 mg;B1;30\r\n")
    csv.soltar()
  })
})
