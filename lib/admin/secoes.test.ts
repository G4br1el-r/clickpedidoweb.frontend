import { describe, expect, test } from "vitest"
import { CONFIG_PADRAO } from "./config"
import { buscarSecao, GRUPOS, normalizar, ondeMudou, SECOES, secoesAlteradas } from "./secoes"

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

describe("secoesAlteradas", () => {
  test("sem mudança, nada está pendente", () => {
    expect(secoesAlteradas(CONFIG_PADRAO, CONFIG_PADRAO)).toEqual([])
  })

  test("aponta só as seções em que o rascunho difere do que está publicado", () => {
    const rascunho = {
      ...CONFIG_PADRAO,
      identidade: { ...CONFIG_PADRAO.identidade, nome: "Outra Pizza" },
    }
    expect(secoesAlteradas(rascunho, CONFIG_PADRAO).map((secao) => secao.id)).toEqual([
      "identidade",
    ])
  })
})

describe("ondeMudou", () => {
  const secao = (titulo: string) => ({ titulo }) as (typeof SECOES)[number]

  test("uma ou duas seções aparecem pelo nome", () => {
    expect(ondeMudou([secao("Identidade")])).toBe("em Identidade")
    expect(ondeMudou([secao("Identidade"), secao("Cores e botões")])).toBe(
      "em Identidade e Cores e botões",
    )
  })

  test("três ou mais viram uma contagem", () => {
    expect(ondeMudou([secao("A"), secao("B"), secao("C")])).toBe("em 3 seções")
  })
})
