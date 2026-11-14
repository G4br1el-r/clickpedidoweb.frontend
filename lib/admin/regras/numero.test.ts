import { describe, expect, test } from "vitest"
import { proximoNumero, textoRetirada } from "./numero"

const agora = new Date(2026, 11, 1, 19)

describe("proximoNumero", () => {
  test("sequencial: o número é o id", () => {
    expect(proximoNumero({ id: 812, mensal: false, ultimo: undefined, agora })).toBe(812)
  })

  test("mensal: segue no mesmo mês e recomeça no mês novo", () => {
    const novembro = { numero: 37, criadoEm: new Date(2026, 10, 30, 22).toISOString() }
    const dezembro = { numero: 4, criadoEm: new Date(2026, 11, 1, 18).toISOString() }
    expect(proximoNumero({ id: 900, mensal: true, ultimo: novembro, agora })).toBe(1)
    expect(proximoNumero({ id: 901, mensal: true, ultimo: dezembro, agora })).toBe(5)
    expect(proximoNumero({ id: 1, mensal: true, ultimo: undefined, agora })).toBe(1)
  })
})

describe("textoRetirada", () => {
  test("dia da semana abreviado e a data", () => {
    expect(textoRetirada("2026-11-14")).toBe("Retirar sáb., 14/11")
    expect(textoRetirada("2026-11-16")).toBe("Retirar seg., 16/11")
  })
})
