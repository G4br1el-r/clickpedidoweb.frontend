import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido, Produto } from "../dados/tipos"
import type { ColunaCozinha, StatusTicket, TicketCozinha } from "./cozinha"
import { esgotados, resumoDeProducao } from "./producao"

const item = (
  produtoId: string | null,
  nome: string,
  quantidade: number,
  extra: Partial<ItemPedido> = {},
) => ({ id: `${nome}-${quantidade}`, produtoId, nome, quantidade, ...extra }) as ItemPedido

const ticket = (id: string, itens: ItemPedido[]) =>
  ({
    id,
    pedido: { id } as unknown as Pedido,
    rodada: 1,
    itens,
    avisos: [],
  }) as unknown as TicketCozinha

const coluna = (id: ColunaCozinha["id"], status: StatusTicket, tickets: TicketCozinha[]) => ({
  id,
  titulo: id,
  status,
  tickets,
})

describe("resumoDeProducao", () => {
  test("soma por produto o que está em A fazer e Preparando, do maior para o menor", () => {
    const colunas: ColunaCozinha[] = [
      coluna("afazer", "recebido", [
        ticket("a:1", [item("x-burger", "X-Burger", 2), item("fritas", "Fritas", 1)]),
        ticket("b:1", [item("x-burger", "X-Burger", 3)]),
      ]),
      coluna("preparando", "em-preparo", [ticket("c:1", [item("x-burger", "X-Burger", 2)])]),
      coluna("prontos", "pronto", [ticket("d:1", [item("fritas", "Fritas", 9)])]),
    ]
    expect(resumoDeProducao(colunas)).toEqual([
      {
        chave: "x-burger",
        produtoId: "x-burger",
        nome: "X-Burger",
        quantidade: 7,
        tickets: ["a:1", "b:1", "c:1"],
      },
      { chave: "fritas", produtoId: "fritas", nome: "Fritas", quantidade: 1, tickets: ["a:1"] },
    ])
  })

  test("o item já riscado não conta", () => {
    const colunas: ColunaCozinha[] = [
      coluna("preparando", "em-preparo", [
        ticket("a:1", [
          item("x-burger", "X-Burger", 2, { feitoEm: "2026-11-13T20:00:00.000Z" }),
          item("x-burger", "X-Burger", 1),
        ]),
      ]),
    ]
    expect(resumoDeProducao(colunas).map(({ nome, quantidade }) => [nome, quantidade])).toEqual([
      ["X-Burger", 1],
    ])
  })

  test("o pedido cancelado (que espera o ciente) não conta", () => {
    const cancelado = ticket("a:1", [item("x-burger", "X-Burger", 2)])
    cancelado.pedido.status = "cancelado"
    const colunas: ColunaCozinha[] = [coluna("afazer", "recebido", [cancelado])]
    expect(resumoDeProducao(colunas)).toEqual([])
  })

  test("o avulso soma pelo nome; no empate, a ordem é a do nome", () => {
    const colunas: ColunaCozinha[] = [
      coluna("afazer", "recebido", [
        ticket("a:1", [item(null, "Suco do dia", 1), item("pastel", "Pastel", 2)]),
        ticket("b:1", [item(null, "Suco do dia", 1)]),
      ]),
    ]
    expect(resumoDeProducao(colunas).map(({ chave, quantidade }) => [chave, quantidade])).toEqual([
      ["pastel", 2],
      ["Suco do dia", 2],
    ])
  })
})

describe("esgotados", () => {
  test("os produtos à venda que estão esgotados, pelo nome; o que saiu do cardápio fica de fora", () => {
    const produto = (nome: string, ativo: boolean, disponivel: boolean) =>
      ({ id: nome.toLowerCase(), nome, ativo, disponivel }) as Produto
    const lista = [
      produto("Pastel", true, false),
      produto("Coxinha", true, true),
      produto("Esfiha", true, false),
      produto("Quibe", false, false),
    ]
    expect(esgotados(lista).map((item) => item.nome)).toEqual(["Esfiha", "Pastel"])
  })
})
