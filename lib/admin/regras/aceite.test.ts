import { describe, expect, test } from "vitest"
import type { Pedido } from "../dados/tipos"
import { alarmeTocando, esperaDoAceite, motivosDeCancelamento } from "./aceite"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

/** Chegou às 20:30 de 13/11/2026 (São Paulo). */
const esperando: Pedido = {
  ...PEDIDOS_DE_TESTE[2],
  status: "recebido",
  esperaAceite: true,
  criadoEm: "2026-11-13T23:30:00.000Z",
}

describe("motivosDeCancelamento", () => {
  const rotulos = (segmento: Parameters<typeof motivosDeCancelamento>[0]) =>
    motivosDeCancelamento(segmento).map((motivo) => motivo.rotulo)

  test("comida: estoque, área, movimento, cliente, endereço, fraude e outro", () => {
    expect(rotulos("pizzaria")).toEqual([
      "Sem estoque de um item",
      "Fora da área de entrega",
      "Loja cheia",
      "Cliente pediu para cancelar",
      "Endereço inválido",
      "Suspeita de fraude",
      "Outro motivo",
    ])
  })

  test("farmácia também recusa por receita inválida", () => {
    expect(rotulos("farmacia")).toContain("Receita inválida")
    expect(rotulos("farmacia").at(-1)).toBe("Outro motivo")
  })

  test("salão não fala de entrega nem de estoque, e tem cliente que não veio", () => {
    expect(rotulos("salao")).toEqual([
      "Agenda cheia",
      "Cliente pediu para cancelar",
      "Cliente não veio",
      "Suspeita de fraude",
      "Outro motivo",
    ])
  })
})

describe("alarmeTocando", () => {
  test("toca enquanto houver um pedido esperando aceite; aceito ou recusado, para", () => {
    const aceito: Pedido = { ...esperando, id: 2, esperaAceite: false }
    expect(alarmeTocando([aceito, esperando])).toBe(true)
    expect(alarmeTocando([aceito])).toBe(false)
    expect(alarmeTocando([{ ...esperando, status: "cancelado" }])).toBe(false)
    expect(alarmeTocando([])).toBe(false)
  })
})

describe("esperaDoAceite", () => {
  test("conta os minutos inteiros desde a chegada e avisa quando passa do limite", () => {
    expect(esperaDoAceite(esperando, new Date(2026, 10, 13, 20, 34, 59), 5)).toEqual({
      minutos: 4,
      passou: false,
    })
    expect(esperaDoAceite(esperando, new Date(2026, 10, 13, 20, 35), 5)).toEqual({
      minutos: 5,
      passou: true,
    })
  })

  test("pedido que não espera aceite não tem espera", () => {
    const aceito: Pedido = { ...esperando, esperaAceite: false }
    expect(esperaDoAceite(aceito, new Date(2026, 10, 13, 20, 50), 5)).toBeNull()
    const cancelado: Pedido = { ...esperando, status: "cancelado" }
    expect(esperaDoAceite(cancelado, new Date(2026, 10, 13, 20, 50), 5)).toBeNull()
  })
})
