import { describe, expect, test } from "vitest"
import type { Pedido, TipoPedido } from "../dados/tipos"
import { AGORA_DE_TESTE as AGORA, PEDIDOS_DE_TESTE } from "./pedidos-de-teste"
import { minutosDoTexto, prazoDoPedido, textoDoPrazo } from "./prazo"

const LOJA = { tempoEntrega: "40–60 min", tempoRetirada: "20 min" }

/** Pedido criado às 20:00 (meia hora antes de AGORA, 20:30). */
function pedido(tipo: TipoPedido, extra: Partial<Pedido> = {}): Pedido {
  const criadoEm = new Date(2026, 10, 13, 20, 0).toISOString()
  return { ...PEDIDOS_DE_TESTE[2], tipo, criadoEm, atualizadoEm: criadoEm, ...extra }
}

const hora = (data: Date | undefined) =>
  data?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

describe("minutosDoTexto", () => {
  test("o prazo prometido é o maior tempo do texto da loja", () => {
    expect(minutosDoTexto("40–60 min")).toBe(60)
    expect(minutosDoTexto("30 a 50 min")).toBe(50)
    expect(minutosDoTexto("20 min")).toBe(20)
  })

  test("entende horas e não inventa prazo quando o texto não tem tempo", () => {
    expect(minutosDoTexto("1h")).toBe(60)
    expect(minutosDoTexto("1h30")).toBe(90)
    expect(minutosDoTexto("40 min a 1h")).toBe(60)
    expect(minutosDoTexto("Atendimento VIP")).toBeUndefined()
    expect(minutosDoTexto("")).toBeUndefined()
  })
})

describe("prazoDoPedido", () => {
  test("entrega pelo tempo de entrega; retirada e mesa pelo tempo de retirada", () => {
    expect(hora(prazoDoPedido(pedido("entrega"), LOJA))).toBe("21:00")
    expect(hora(prazoDoPedido(pedido("retirada"), LOJA))).toBe("20:20")
    expect(hora(prazoDoPedido(pedido("mesa"), LOJA))).toBe("20:20")
  })

  test("o prazo gravado na chegada vale mais que o da loja hoje", () => {
    expect(hora(prazoDoPedido(pedido("entrega", { prazoMin: 75 }), LOJA))).toBe("21:15")
  })

  test("texto sem tempo: 50 min na entrega e 20 na retirada", () => {
    const semTempo = { tempoEntrega: "Consulte", tempoRetirada: "" }
    expect(hora(prazoDoPedido(pedido("entrega"), semTempo))).toBe("20:50")
    expect(hora(prazoDoPedido(pedido("retirada"), semTempo))).toBe("20:20")
  })

  test("salão e retirada marcada para um dia não têm prazo em minutos", () => {
    const agendado = pedido("atendimento", {
      agendamento: { inicio: AGORA.toISOString(), duracaoMin: 60 },
    })
    expect(prazoDoPedido(agendado, LOJA)).toBeUndefined()
    expect(prazoDoPedido(pedido("retirada", { dataRetirada: "2026-11-14" }), LOJA)).toBeUndefined()
  })
})

describe("textoDoPrazo", () => {
  test("contagem regressiva até o prazo, com o verbo do canal", () => {
    expect(textoDoPrazo(pedido("entrega"), LOJA, AGORA)).toEqual({
      ate: "21:00",
      resta: "30 min",
      completo: "Entregar até 21:00, faltam 30 min",
    })
    expect(textoDoPrazo(pedido("mesa"), LOJA, new Date(2026, 10, 13, 20, 19))?.completo).toBe(
      "Servir até 20:20, falta 1 min",
    )
  })

  test("passou do prazo: quanto atrasou", () => {
    expect(textoDoPrazo(pedido("retirada"), LOJA, AGORA)).toEqual({
      ate: "20:20",
      resta: "+10 min",
      completo: "Pronto até 20:20, atrasado 10 min",
    })
  })

  test("sem prazo em minutos, sem texto", () => {
    expect(textoDoPrazo(pedido("retirada", { dataRetirada: "2026-11-14" }), LOJA, AGORA)).toBe(
      undefined,
    )
  })
})
