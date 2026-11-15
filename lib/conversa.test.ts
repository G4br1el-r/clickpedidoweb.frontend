import { describe, expect, test } from "vitest"
import { horaDaMensagem, mensagensDaLoja, roteiroDaConversa } from "./conversa"
import { casaDaPizza } from "./mock/casa-da-pizza"
import type { Pedido } from "./sacola"
import type { Loja } from "./tipos"

const loja = casaDaPizza as Loja

const pedido: Pedido = {
  numero: 4821,
  itens: [],
  subtotal: 73,
  taxaEntrega: 6,
  total: 79,
  tipo: "entrega",
}

describe("horaDaMensagem", () => {
  const as1942 = new Date("2026-11-14T19:42:00-03:00").getTime()

  test("escreve a hora do pedido no fuso da loja, como no WhatsApp", () => {
    expect(horaDaMensagem(as1942)).toBe("19:42")
  })

  test("a resposta da loja chega minutos depois, virando a hora quando precisa", () => {
    expect(horaDaMensagem(as1942, 1)).toBe("19:43")
    expect(horaDaMensagem(as1942, 18)).toBe("20:00")
  })

  test("pedido salvo antes do checkout, sem data, fica sem horário", () => {
    expect(horaDaMensagem(undefined)).toBeUndefined()
  })
})

describe("roteiroDaConversa", () => {
  test("a loja lê, digita e responde uma mensagem por vez, digitando mais o texto mais longo", () => {
    expect(roteiroDaConversa(["a".repeat(50), "b".repeat(10), "c".repeat(100)])).toEqual([
      { em: 0, lida: false, visiveis: 0, digitando: false },
      { em: 500, lida: true, visiveis: 0, digitando: false },
      { em: 800, lida: true, visiveis: 0, digitando: true },
      { em: 1700, lida: true, visiveis: 1, digitando: false },
      { em: 2100, lida: true, visiveis: 1, digitando: true },
      { em: 2800, lida: true, visiveis: 2, digitando: false },
      { em: 3200, lida: true, visiveis: 2, digitando: true },
      { em: 4600, lida: true, visiveis: 3, digitando: false },
    ])
  })

  test("sem mensagens, só marca o pedido como lido", () => {
    expect(roteiroDaConversa([])).toEqual([
      { em: 0, lida: false, visiveis: 0, digitando: false },
      { em: 500, lida: true, visiveis: 0, digitando: false },
    ])
  })
})

describe("mensagensDaLoja", () => {
  test("na entrega, confirma o número, conta o preparo do ofício e dá a previsão", () => {
    expect(mensagensDaLoja(pedido, loja)).toEqual([
      "Recebemos seu pedido nº 4821. Obrigado por escolher a Casa da Pizza!",
      "Sua pizza já está indo para o forno a lenha.",
      "A previsão de entrega é de 35–50 min. Avisamos por aqui quando sair.",
    ])
  })

  test("na retirada, diz quando fica pronto", () => {
    expect(mensagensDaLoja({ ...pedido, tipo: "retirada" }, loja)[2]).toBe(
      "Fica pronto em 20–30 min. Avisamos por aqui quando puder buscar.",
    )
  })
})
