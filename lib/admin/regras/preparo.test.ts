import { describe, expect, test } from "vitest"
import type { ItemPedido, Produto } from "../dados/tipos"
import type { TicketCozinha } from "./cozinha"
import { disparoDosItens, temposDoTicket } from "./preparo"

const PRODUTOS = [
  { id: "pizza", preparoMin: 20 },
  { id: "salada", preparoMin: 8 },
  { id: "refri" },
] as Produto[]
const item = (produtoId: string | null) => ({ id: produtoId ?? "avulso", produtoId }) as ItemPedido
const TEMPOS = { atencaoMin: 15, atrasoMin: 25, prontoFicaMin: 15 }

describe("disparoDosItens", () => {
  test("cada item espera a diferença para o mais demorado; sem tempo cadastrado, começa já", () => {
    expect(disparoDosItens([item("pizza"), item("salada"), item("refri")], PRODUTOS)).toEqual({
      pizza: 0,
      salada: 12,
      refri: 0,
    })
  })

  test("sem nenhum tempo cadastrado no ticket, não há disparo", () => {
    expect(disparoDosItens([item("refri"), item(null)], PRODUTOS)).toBeNull()
  })
})

describe("temposDoTicket", () => {
  test("com preparo, a atenção começa no maior tempo e o atraso vem com a folga da loja", () => {
    const ticket = { itens: [item("pizza"), item("salada")] } as TicketCozinha
    expect(temposDoTicket(ticket, PRODUTOS, TEMPOS)).toEqual({
      ...TEMPOS,
      atencaoMin: 20,
      atrasoMin: 30,
    })
  })

  test("preparo curto ou sem preparo não adianta os tempos da loja", () => {
    expect(temposDoTicket({ itens: [item("salada")] } as TicketCozinha, PRODUTOS, TEMPOS)).toEqual(
      TEMPOS,
    )
    expect(temposDoTicket({ itens: [item("refri")] } as TicketCozinha, PRODUTOS, TEMPOS)).toEqual(
      TEMPOS,
    )
  })
})
