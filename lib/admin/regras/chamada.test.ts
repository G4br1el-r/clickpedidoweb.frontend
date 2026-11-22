import { describe, expect, test } from "vitest"
import type { Pedido, StatusPedido, TipoPedido } from "../dados/tipos"
import { chamadasNovas, quadroDeChamada } from "./chamada"
import { AGORA_DE_TESTE as AGORA, PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const minutosAtras = (minutos: number) => new Date(AGORA.getTime() - minutos * 60_000).toISOString()

function pedido(
  numero: number,
  status: StatusPedido,
  {
    tipo = "retirada",
    nome = "Ana Souza",
    ha = 5,
  }: { tipo?: TipoPedido; nome?: string; ha?: number } = {},
): Pedido {
  return {
    ...PEDIDOS_DE_TESTE[2],
    id: numero,
    numero,
    tipo,
    status,
    cliente: { nome, telefone: "12999990000" },
    criadoEm: minutosAtras(ha + 10),
    atualizadoEm: minutosAtras(ha),
  }
}

const numeros = (lista: { numero: number }[]) => lista.map((item) => item.numero)

describe("quadroDeChamada", () => {
  test("retirada recebida ou em preparo vai para Preparando; pronta, para Pronto", () => {
    const quadro = quadroDeChamada(
      [pedido(1, "recebido"), pedido(2, "em-preparo"), pedido(3, "pronto")],
      AGORA,
    )
    expect(numeros(quadro.preparando)).toEqual([1, 2])
    expect(numeros(quadro.prontos)).toEqual([3])
  })

  test("só retirada e balcão: entrega, mesa e o que espera o aceite da loja ficam fora", () => {
    const quadro = quadroDeChamada(
      [
        pedido(1, "pronto", { tipo: "entrega" }),
        pedido(2, "em-preparo", { tipo: "mesa" }),
        { ...pedido(3, "recebido"), esperaAceite: true },
        { ...pedido(4, "pronto"), origem: "pdv" },
      ],
      AGORA,
    )
    expect(numeros(quadro.preparando)).toEqual([])
    expect(numeros(quadro.prontos)).toEqual([4])
  })

  test("nunca o nome completo: só o primeiro nome, e a venda do balcão sem nome fica só no número", () => {
    const quadro = quadroDeChamada(
      [
        pedido(1, "pronto", { nome: "  maria eduarda Silva " }),
        { ...pedido(2, "pronto", { nome: "Venda no balcão" }), origem: "pdv" },
        pedido(3, "pronto", { nome: "" }),
      ],
      AGORA,
    )
    expect(quadro.prontos.map((item) => item.nome)).toEqual(["Maria", undefined, undefined])
  })

  test("preparando na ordem de chegada; pronto com o chamado mais recente primeiro", () => {
    const quadro = quadroDeChamada(
      [
        pedido(1, "em-preparo", { ha: 2 }),
        pedido(2, "recebido", { ha: 9 }),
        pedido(3, "pronto", { ha: 8 }),
        pedido(4, "pronto", { ha: 1 }),
      ],
      AGORA,
    )
    expect(numeros(quadro.preparando)).toEqual([2, 1])
    expect(numeros(quadro.prontos)).toEqual([4, 3])
  })

  test("pronto há mais de 20 minutos sai da TV: quem esqueceu de dar Retirado não trava a tela", () => {
    const quadro = quadroDeChamada(
      [pedido(1, "pronto", { ha: 19 }), pedido(2, "pronto", { ha: 21 })],
      AGORA,
    )
    expect(numeros(quadro.prontos)).toEqual([1])
  })
})

describe("chamadasNovas", () => {
  test("chama só o número que entrou em Pronto desde a última olhada", () => {
    const prontos = [
      { id: 7, numero: 107 },
      { id: 3, numero: 103 },
    ]
    expect(chamadasNovas(new Set([3]), prontos)).toEqual([{ id: 7, numero: 107 }])
    expect(chamadasNovas(new Set([3, 7]), prontos)).toEqual([])
  })
})
