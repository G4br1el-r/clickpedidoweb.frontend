import { describe, expect, test } from "vitest"
import type { Pedido } from "../dados/tipos"
import { AVISOS_DE_FABRICA, avisoDaMudanca, textoDoAviso } from "./avisos-cliente"
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

describe("aviso da pesagem", () => {
  const pesagem = { totalEstimado: 80, diferenca: 4.5, pesadoEm: "" }

  test("açougue: pesou e o total mudou, avisa o cliente; pesou e ficou igual, não", () => {
    expect(avisoDaMudanca(PEDIDO, { ...PEDIDO, total: 84.5, pesagem })).toBe("pesado")
    expect(avisoDaMudanca(PEDIDO, { ...PEDIDO, pesagem: { ...pesagem, diferenca: 0 } })).toBeNull()
  })

  test("o texto de fábrica diz o total novo", () => {
    expect(
      textoDoAviso(
        AVISOS_DE_FABRICA.pesado,
        { ...PEDIDO, total: 84.5, pesagem },
        {
          loja: "Açougue Sabor da Carne",
          endereco: "",
        },
      ),
    ).toBe("Olá, Ana! Seu pedido #1412 foi pesado e o total ficou R$ 84,50.")
  })
})

describe("aviso da farmácia", () => {
  test("a entrega que vira retirada (controlado) avisa o cliente para buscar no balcão", () => {
    const entrega = { ...PEDIDO, tipo: "entrega" as const }
    const retirada = { ...PEDIDO, tipo: "retirada" as const }
    expect(avisoDaMudanca(entrega, retirada)).toBe("retirada")
    expect(
      textoDoAviso(AVISOS_DE_FABRICA.retirada, retirada, { loja: "Farmácia Vida", endereco: "" }),
    ).toBe(
      "Olá, Ana! Seu pedido #1412 tem remédio controlado, que só sai no balcão com a receita retida. Ele fica para retirar na Farmácia Vida.",
    )
  })
})
