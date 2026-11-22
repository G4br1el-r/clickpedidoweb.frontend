import { describe, expect, test } from "vitest"
import type { Pedido, StatusPedido } from "../dados/tipos"
import { historicoDoCliente, seloDoCliente } from "./clientes"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const ANA = { nome: "Ana", telefone: "12991230001" }
const BRUNO = { nome: "Bruno", telefone: "12991230002" }

/** Pedido criado `dias` antes de 13/11/2026, às 20:00. */
function pedido(
  id: number,
  cliente: typeof ANA,
  dias: number,
  status: StatusPedido = "concluido",
): Pedido {
  const criadoEm = new Date(2026, 10, 13 - dias, 20, 0).toISOString()
  return {
    ...PEDIDOS_DE_TESTE[2],
    id,
    numero: id,
    cliente,
    status,
    criadoEm,
    atualizadoEm: criadoEm,
  }
}

describe("historicoDoCliente", () => {
  test("conta os pedidos de antes do mesmo telefone, sem os cancelados", () => {
    const atual = pedido(10, ANA, 0, "recebido")
    const todos = [
      atual,
      pedido(1, ANA, 2),
      pedido(2, ANA, 40),
      pedido(3, ANA, 5, "cancelado"),
      pedido(4, BRUNO, 1),
    ]
    expect(historicoDoCliente(atual, todos)).toEqual({ anteriores: 2, nosUltimos30: 1 })
  })
})

describe("seloDoCliente", () => {
  test("primeiro pedido, freguês de 10 pedidos em 30 dias, ou nada", () => {
    expect(seloDoCliente({ anteriores: 0, nosUltimos30: 0 })).toBe("1º pedido")
    expect(seloDoCliente({ anteriores: 30, nosUltimos30: 10 })).toBe("Cliente frequente")
    expect(seloDoCliente({ anteriores: 30, nosUltimos30: 9 })).toBeNull()
  })
})
