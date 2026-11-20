import { describe, expect, test } from "vitest"
import type { Pedido } from "../dados/tipos"
import { avisoDaMudanca, textoDoAviso } from "./avisos-cliente"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const PEDIDO: Pedido = {
  ...PEDIDOS_DE_TESTE[2],
  numero: 1412,
  token: "abc",
  tipo: "entrega",
  status: "recebido",
  cliente: { nome: "Ana Lima", telefone: "12991230000" },
}

describe("avisoDaMudanca", () => {
  test("aceito, saiu para entrega, pronto para retirar e recusado avisam; o resto não", () => {
    const esperando = { ...PEDIDO, esperaAceite: true }
    expect(avisoDaMudanca(esperando, { ...esperando, esperaAceite: false })).toBe("aceito")
    expect(
      avisoDaMudanca({ ...PEDIDO, status: "pronto" }, { ...PEDIDO, status: "saiu-para-entrega" }),
    ).toBe("saiu")
    const retirada = { ...PEDIDO, tipo: "retirada" as const }
    expect(
      avisoDaMudanca({ ...retirada, status: "em-preparo" }, { ...retirada, status: "pronto" }),
    ).toBe("pronto")
    const recusado: Pedido = {
      ...esperando,
      status: "cancelado",
      esperaAceite: false,
      cancelamento: { tipo: "recusa", motivo: "loja-cheia", em: "" },
    }
    expect(avisoDaMudanca(esperando, recusado)).toBe("recusado")
    // Entrega pronta não avisa (avisa quando sai); preparo também não.
    expect(
      avisoDaMudanca({ ...PEDIDO, status: "em-preparo" }, { ...PEDIDO, status: "pronto" }),
    ).toBeNull()
    expect(avisoDaMudanca(PEDIDO, { ...PEDIDO, status: "em-preparo" })).toBeNull()
  })
})

describe("textoDoAviso", () => {
  test("troca os marcadores pelo primeiro nome, o número, a loja, o link e o motivo", () => {
    const recusado: Pedido = {
      ...PEDIDO,
      status: "cancelado",
      cancelamento: { tipo: "recusa", motivo: "outro", detalhe: "Acabou a massa", em: "" },
    }
    expect(
      textoDoAviso("Olá, {nome}! #{numero} na {loja}: {motivo}. Veja: {link}", recusado, {
        loja: "Casa da Pizza",
        endereco: "https://loja.exemplo",
      }),
    ).toBe(
      "Olá, Ana! #1412 na Casa da Pizza: Acabou a massa. Veja: https://loja.exemplo/pedido/abc",
    )
  })
})
