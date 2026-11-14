import { describe, expect, test } from "vitest"
import type { Pedido } from "../dados/tipos"
import {
  formatarTelefone,
  linkWhatsApp,
  mensagemParaCliente,
  mensagemParaMotoboy,
} from "./mensagens"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const ENTREGA: Pedido = {
  ...PEDIDOS_DE_TESTE[2],
  numero: 12,
  token: "abc123",
  status: "saiu-para-entrega",
  cliente: { nome: "Ana Souza", telefone: "12991230001" },
  endereco: {
    cep: "12630-000",
    logradouro: "Rua das Flores",
    numero: "45",
    bairro: "Centro",
    cidade: "Cachoeira Paulista",
    referencia: "Portão azul",
  },
  total: 51,
  pagamento: "dinheiro",
  situacaoPagamento: "na-entrega",
  trocoPara: 100,
}

describe("formatarTelefone", () => {
  test("celular e fixo", () => {
    expect(formatarTelefone("12991230001")).toBe("(12) 99123-0001")
    expect(formatarTelefone("1231234567")).toBe("(12) 3123-4567")
  })
})

describe("linkWhatsApp", () => {
  test("abre a conversa com o número do Brasil e o texto pronto", () => {
    expect(linkWhatsApp("(12) 99123-0001", "Olá, tudo bem?")).toBe(
      "https://wa.me/5512991230001?text=Ol%C3%A1%2C%20tudo%20bem%3F",
    )
  })
})

describe("linkWhatsApp com DDI", () => {
  test("número que já vem com 55 não ganha outro", () => {
    expect(linkWhatsApp("5512991230001", "Oi")).toBe("https://wa.me/5512991230001?text=Oi")
  })
})

describe("mensagemParaCliente", () => {
  test("diz o status do pedido e manda o link de acompanhamento", () => {
    expect(
      mensagemParaCliente(ENTREGA, { loja: "Casa da Pizza", endereco: "https://loja.exemplo" }),
    ).toBe(
      "Olá, Ana! Seu pedido #12 na Casa da Pizza: Saiu para entrega.\n" +
        "Acompanhe por aqui: https://loja.exemplo/pedido/abc123",
    )
  })

  test("no agendamento marcado, lembra o dia e a hora", () => {
    const marcado: Pedido = {
      ...ENTREGA,
      tipo: "atendimento",
      status: "recebido",
      cliente: { nome: "Bruna Alves", telefone: "12991110000" },
      agendamento: { inicio: new Date(2026, 10, 14, 10).toISOString(), duracaoMin: 90 },
    }
    expect(
      mensagemParaCliente(marcado, {
        loja: "Empório das Deusas",
        endereco: "https://loja.exemplo",
      }),
    ).toBe(
      "Olá, Bruna! Seu agendamento #12 na Empório das Deusas está marcado para sábado, 14/11, às 10:00.\n" +
        "Acompanhe por aqui: https://loja.exemplo/pedido/abc123",
    )
  })
})

describe("mensagemParaMotoboy", () => {
  test("leva endereço, quanto cobrar com o troco e o mapa", () => {
    expect(mensagemParaMotoboy(ENTREGA, { loja: "Casa da Pizza" })).toBe(
      [
        "*Casa da Pizza* · pedido #12",
        "Cliente: Ana Souza · (12) 99123-0001",
        "Endereço: Rua das Flores, 45 - Centro, Cachoeira Paulista",
        "Referência: Portão azul",
        "Cobrar R$ 51,00 em dinheiro · levar R$ 49,00 de troco",
        "Mapa: https://www.google.com/maps/search/?api=1&query=Rua%20das%20Flores%2C%2045%20-%20Centro%2C%20Cachoeira%20Paulista",
      ].join("\n"),
    )
  })

  test("cartão na entrega é cobrado na maquininha; dinheiro sem troco não fala em troco", () => {
    const maquininha = { ...ENTREGA, pagamento: "cartao-na-entrega" as const }
    expect(mensagemParaMotoboy(maquininha, { loja: "Casa da Pizza" })).toContain(
      "Cobrar R$ 51,00 na maquininha",
    )
    const semTroco = { ...ENTREGA, trocoPara: undefined }
    expect(mensagemParaMotoboy(semTroco, { loja: "Casa da Pizza" })).toContain(
      "Cobrar R$ 51,00 em dinheiro\n",
    )
  })

  test("o complemento entra no endereço", () => {
    const comComplemento = {
      ...ENTREGA,
      endereco: {
        ...(ENTREGA.endereco as NonNullable<Pedido["endereco"]>),
        complemento: "apto 12",
      },
    }
    expect(mensagemParaMotoboy(comComplemento, { loja: "Casa da Pizza" })).toContain(
      "Endereço: Rua das Flores, 45 (apto 12) - Centro, Cachoeira Paulista",
    )
  })

  test("pedido pago online não é cobrado", () => {
    const pago = { ...ENTREGA, pagamento: "pix" as const, situacaoPagamento: "pago" as const }
    expect(mensagemParaMotoboy(pago, { loja: "Casa da Pizza" })).toContain(
      "Já pago online. Não cobrar.",
    )
  })

  test("pedido sem endereço não manda endereço nem mapa", () => {
    const retirada = { ...ENTREGA, tipo: "retirada" as const, endereco: undefined }
    const mensagem = mensagemParaMotoboy(retirada, { loja: "Casa da Pizza" })
    expect(mensagem).not.toContain("Endereço:")
    expect(mensagem).not.toContain("Mapa:")
  })
})
