import { describe, expect, test } from "vitest"
import { prazoDoAcompanhamento } from "./acompanhamento"
import { situacaoDoPedido } from "./pedido"
import type { Pedido } from "./sacola"

// Horário de Brasília (vitest.config.mts). Loja padrão: entrega "35–50 min", retirada "20–30 min".
// Simulação do pedido em dinheiro: as etapas começam 0, 6, 16 e 28 s depois do pedido.
const CRIADO = new Date("2026-11-08T21:00:00-03:00").getTime()
const depois = (segundos: number) => CRIADO + segundos * 1000

function pedido(mudancas: Partial<Pedido> = {}): Pedido {
  return {
    numero: 2234,
    itens: [],
    subtotal: 80,
    taxaEntrega: 8,
    total: 88,
    criadoEm: CRIADO,
    tipo: "entrega",
    pagamento: "dinheiro",
    ...mudancas,
  }
}

const prazo = (dados: Pedido, agora: number) =>
  prazoDoAcompanhamento(dados, situacaoDoPedido(dados, agora))

describe("prazoDoAcompanhamento", () => {
  test("enquanto o pedido anda, mostra a faixa de horário da entrega", () => {
    expect(prazo(pedido(), depois(10))).toEqual({ rotulo: "Previsão", valor: "21:35 – 21:50" })
  })

  test("na retirada, a faixa é a do pedido pronto", () => {
    expect(prazo(pedido({ tipo: "retirada" }), depois(10))).toEqual({
      rotulo: "Previsão",
      valor: "21:20 – 21:30",
    })
  })

  test("entregue, mostra a hora em que chegou", () => {
    expect(prazo(pedido(), depois(120))).toEqual({ rotulo: "Entregue às", valor: "21:00" })
  })

  test("retirado, mostra a hora em que foi buscado", () => {
    expect(prazo(pedido({ tipo: "retirada" }), depois(120))).toEqual({
      rotulo: "Retirado às",
      valor: "21:00",
    })
  })

  test("no Pix ainda sem pagar, a previsão conta a partir do pagamento", () => {
    // Pedido às 20:59:10; o Pix confirma 14 s depois e a previsão parte daí.
    const comPix = pedido({ pagamento: "pix", criadoEm: depois(-50) })
    expect(prazo(comPix, depois(-45))).toEqual({ rotulo: "Previsão", valor: "21:34 – 21:49" })
  })
})
