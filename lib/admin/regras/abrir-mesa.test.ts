import { describe, expect, test } from "vitest"
import { conferirAbertura, garcomDoAparelho } from "./abrir-mesa"

const mesa = { numero: 11, lugares: 2 }
const garcons = ["Rafa", "Bia"]

describe("conferirAbertura", () => {
  test("de 1 a 99 pessoas, inteiro", () => {
    for (const pessoas of ["", "0", "100", "2.5", "abc"]) {
      expect(conferirAbertura({ mesa, pessoas, garcom: "Bia", garcons }).erros).toEqual({
        pessoas: "Informe de 1 a 99 pessoas.",
      })
    }
    expect(conferirAbertura({ mesa, pessoas: "1", garcom: "Bia", garcons })).toEqual({
      erros: {},
      pessoas: 1,
    })
    expect(conferirAbertura({ mesa, pessoas: "99", garcom: "Bia", garcons }).erros).toEqual({})
  })

  test("com garçons no salão, o garçom é obrigatório; sem nenhum, fica sem", () => {
    expect(conferirAbertura({ mesa, pessoas: "2", garcom: null, garcons }).erros).toEqual({
      garcom: "Escolha o garçom.",
    })
    expect(conferirAbertura({ mesa, pessoas: "", garcom: null, garcons }).erros).toEqual({
      pessoas: "Informe de 1 a 99 pessoas.",
      garcom: "Escolha o garçom.",
    })
    expect(conferirAbertura({ mesa, pessoas: "2", garcom: null, garcons: [] }).erros).toEqual({})
  })

  test("mais pessoas que lugares só avisa", () => {
    expect(conferirAbertura({ mesa, pessoas: "3", garcom: "Bia", garcons })).toEqual({
      erros: {},
      pessoas: 3,
      aviso: "A mesa 11 tem 2 lugares.",
    })
    expect(
      conferirAbertura({ mesa: { numero: 17, lugares: 1 }, pessoas: "2", garcom: "Bia", garcons })
        .aviso,
    ).toBe("A mesa 17 tem 1 lugar.")
    expect(conferirAbertura({ mesa, pessoas: "2", garcom: "Bia", garcons })).not.toHaveProperty(
      "aviso",
    )
  })
})

describe("garcomDoAparelho", () => {
  test("o nome guardado no aparelho, como está na lista, sem diferenciar acento e maiúscula", () => {
    expect(garcomDoAparelho(garcons, " rafa ")).toBe("Rafa")
    expect(garcomDoAparelho(["Biá"], "bia")).toBe("Biá")
    expect(garcomDoAparelho(garcons, "Zé")).toBeNull()
    expect(garcomDoAparelho(garcons, "  ")).toBeNull()
  })
})
