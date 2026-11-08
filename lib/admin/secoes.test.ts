import { describe, expect, test } from "vitest"
import { CONFIG_PADRAO } from "./config"
import { buscarSecao, GRUPOS, normalizar, SECOES } from "./secoes"

describe("buscarSecao", () => {
  test("acha a seção pelo id da rota", () => {
    expect(buscarSecao("cores")).toMatchObject({ id: "cores", grupo: "Aparência" })
  })

  test("devolve undefined para rota que não existe", () => {
    expect(buscarSecao("pagamentos")).toBeUndefined()
  })
})

describe("SECOES", () => {
  test("toda seção da configuração tem página no painel, uma única vez", () => {
    expect(SECOES.map(({ id }) => id).sort()).toEqual(Object.keys(CONFIG_PADRAO).sort())
  })

  test("toda seção pertence a um dos grupos da barra lateral", () => {
    for (const secao of SECOES) expect(GRUPOS).toContain(secao.grupo)
  })
})

describe("normalizar", () => {
  test("ignora acento, maiúscula e espaço nas pontas", () => {
    expect(normalizar("  Animações ")).toBe("animacoes")
    expect(normalizar("Ç")).toBe("c")
  })
})
