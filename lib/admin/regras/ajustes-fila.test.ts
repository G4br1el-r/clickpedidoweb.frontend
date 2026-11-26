import { describe, expect, it } from "vitest"
import { resumoDosAjustes } from "./ajustes-fila"

const base = {
  aberta: true,
  temEntrega: true,
  aceitaEntrega: true,
  somLigado: true,
  simular: false,
}

describe("resumoDosAjustes", () => {
  it("tudo ligado: loja aberta, entrega e som", () => {
    expect(resumoDosAjustes(base)).toBe("Loja aberta · Entrega ligada · Som ligado")
  })

  it("loja fechada aparece como fechada", () => {
    expect(resumoDosAjustes({ ...base, aberta: false })).toBe(
      "Loja fechada · Entrega ligada · Som ligado",
    )
  })

  it("entrega desligada aparece como desligada", () => {
    expect(resumoDosAjustes({ ...base, aceitaEntrega: false })).toBe(
      "Loja aberta · Entrega desligada · Som ligado",
    )
  })

  it("segmento sem entrega não fala de entrega", () => {
    expect(resumoDosAjustes({ ...base, temEntrega: false })).toBe("Loja aberta · Som ligado")
  })

  it("som desligado aparece como desligado", () => {
    expect(resumoDosAjustes({ ...base, somLigado: false })).toBe(
      "Loja aberta · Entrega ligada · Som desligado",
    )
  })

  it("a simulação de pedidos entra no resumo quando está ligada", () => {
    expect(resumoDosAjustes({ ...base, simular: true })).toBe(
      "Loja aberta · Entrega ligada · Som ligado · Simulando pedidos",
    )
  })
})
