import { render, screen, within } from "@testing-library/react"
import { addMinutes } from "date-fns"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { Pedido } from "@/lib/admin/dados/tipos"
import {
  AGORA_DE_TESTE,
  PERIODO_DE_TESTE,
  pedidoDeTeste,
} from "@/lib/admin/regras/pedidos-de-teste"
import { capturarCsv } from "../csv-de-teste"
import { ProvedorDaAba } from "../exportar"
import { AbaEntrega } from "./aba-entrega"

const regiao = (nome: string) => within(screen.getByRole("region", { name: nome }))
const fato = (onde: ReturnType<typeof regiao>, rotulo: string) =>
  onde.getByText(rotulo, { selector: "dt" }).closest("[data-indicador]")

/** O texto como a pessoa lê: o dinheiro do Intl usa espaço não separável. */
const texto = (elemento: Element) => elemento.textContent?.replace(/ /g, " ")

const CRIADO = new Date(2026, 10, 13, 19)

/** Entrega concluída: saiu e entregou nos minutos dados, no bairro e com o motoboy dados. */
const entregue = (
  id: number,
  total: number,
  saiu: number,
  entregou: number,
  bairro: string,
  mudancas: Partial<Pedido> = {},
): Pedido =>
  pedidoDeTeste(id, CRIADO, total, {
    tipo: "entrega",
    status: "concluido",
    endereco: { cep: "12000000", logradouro: "Rua A", numero: "1", bairro, cidade: "Taubaté" },
    historico: [
      ["recebido", 0],
      ["em-preparo", 2],
      ["pronto", 20],
      ["saiu-para-entrega", saiu],
      ["concluido", entregou],
    ].map(([status, minutos]) => ({
      tipo: "etapa" as const,
      status: status as Pedido["status"],
      em: addMinutes(CRIADO, minutos as number).toISOString(),
    })),
    ...mudancas,
  })

const PEDIDOS: Pedido[] = [
  entregue(1, 60, 25, 40, "Centro", { taxaEntrega: 6, motoboyId: "leo" }),
  entregue(2, 90, 30, 50, "Centro", { taxaEntrega: 6, motoboyId: "leo" }),
  entregue(3, 150, 22, 32, "Vila Nova", { taxaEntrega: 9 }),
]

function renderizar(mudancas: Partial<ComponentProps<typeof AbaEntrega>> = {}) {
  return render(
    <AbaEntrega
      pedidos={PEDIDOS}
      periodo={PERIODO_DE_TESTE}
      motoboys={[{ id: "leo", nome: "Léo", telefone: "12999990000", ativo: true }]}
      {...mudancas}
    />,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA_DE_TESTE)
  return () => vi.useRealTimers()
})

describe("AbaEntrega", () => {
  test("a régua: entregas, taxas cobradas, ticket e o tempo na rua", () => {
    renderizar()
    const regua = regiao("Entregas do período")
    expect(fato(regua, "Entregas")).toHaveTextContent("3")
    expect(fato(regua, "Taxas de entrega")).toHaveTextContent("R$ 21,00")
    expect(fato(regua, "Ticket da entrega")).toHaveTextContent("R$ 100,00")
    expect(fato(regua, "Tempo na rua")).toHaveTextContent("15 min")
    expect(fato(regua, "Tempo na rua")).toHaveTextContent("9 em 10 em até 20 min")
  })

  test("por motoboy, com o nome, levando às entregas dele no período; sem ninguém por último", () => {
    renderizar()
    const motoboys = regiao("Por motoboy")
    expect(motoboys.getAllByRole("listitem").map(texto)).toEqual([
      "Léo2 entregas · 18 min na ruaR$ 12,0067%",
      "Sem motoboy1 entrega · 10 min na ruaR$ 9,0033%",
    ])
    expect(motoboys.getByRole("link", { name: "Léo" })).toHaveAttribute(
      "href",
      "/admin/pedidos?canal=entrega&motoboy=leo&de=2026-11-12&ate=2026-11-13",
    )
    expect(motoboys.getByRole("link", { name: "Sem motoboy" })).toHaveAttribute(
      "href",
      "/admin/pedidos?canal=entrega&motoboy=sem-motoboy&de=2026-11-12&ate=2026-11-13",
    )
  })

  test("por bairro, numa tabela, cada bairro levando aos pedidos dele", () => {
    renderizar()
    const tabela = screen.getByRole("table", { name: "Por bairro" })
    expect(
      within(tabela)
        .getAllByRole("row")
        .slice(1)
        .map((linha) => within(linha).getAllByRole("cell").map(texto)),
    ).toEqual([
      ["Centro", "2", "R$ 150,00", "R$ 12,00", "R$ 75,00", "45 min"],
      ["Vila Nova", "1", "R$ 150,00", "R$ 9,00", "R$ 150,00", "32 min"],
    ])
    expect(within(tabela).getByRole("link", { name: "Vila Nova" })).toHaveAttribute(
      "href",
      "/admin/pedidos?canal=entrega&bairro=Vila%20Nova&de=2026-11-12&ate=2026-11-13",
    )
  })

  test("sem entregas no período, cada seção diz isso", () => {
    renderizar({ pedidos: [] })
    expect(
      regiao("Por motoboy").getByText("Nenhuma entrega concluída no período."),
    ).toBeInTheDocument()
    expect(regiao("Por bairro").getByText("Nenhuma entrega no período.")).toBeInTheDocument()
  })
})

describe("AbaEntrega: CSV", () => {
  test("a tabela por bairro sai em CSV", async () => {
    const csv = capturarCsv()
    render(
      <ProvedorDaAba loja="Casa da Pizza" aba="Entrega" periodo={PERIODO_DE_TESTE}>
        <AbaEntrega pedidos={PEDIDOS} periodo={PERIODO_DE_TESTE} motoboys={[]} />
      </ProvedorDaAba>,
    )
    screen.getByRole("button", { name: "Baixar CSV: Por bairro" }).click()
    expect(await csv.texto()).toBe(
      "﻿Bairro;Pedidos;Faturamento;Taxas;Ticket;Tempo (min)\r\n" +
        "Centro;2;150,00;12,00;75,00;45\r\nVila Nova;1;150,00;9,00;150,00;32\r\n",
    )
    csv.soltar()
  })
})
