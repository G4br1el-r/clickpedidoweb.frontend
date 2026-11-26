import { describe, expect, test } from "vitest"
import { CONFIG_PADRAO } from "@/lib/admin/config"
import { secoesParaRestaurar, textoDaRestauracao } from "./restaurar-grupo"

const comCantos = {
  ...CONFIG_PADRAO,
  cores: { ...CONFIG_PADRAO.cores, cantos: CONFIG_PADRAO.cores.cantos + 4 },
}

describe("secoesParaRestaurar", () => {
  test("tudo no padrão: nada a restaurar em nenhum grupo", () => {
    expect(secoesParaRestaurar("Aparência", CONFIG_PADRAO)).toEqual([])
  })

  test("devolve só as seções do grupo que saíram do padrão", () => {
    expect(secoesParaRestaurar("Aparência", comCantos).map((secao) => secao.id)).toEqual(["cores"])
  })

  test("uma mudança em outro grupo não conta", () => {
    expect(secoesParaRestaurar("Marca", comCantos)).toEqual([])
    expect(secoesParaRestaurar("Telas", comCantos)).toEqual([])
  })

  test("mais de uma seção alterada vem na ordem do índice", () => {
    const config = {
      ...comCantos,
      tipografia: { ...CONFIG_PADRAO.tipografia, escala: 110 },
    }
    expect(secoesParaRestaurar("Aparência", config).map((secao) => secao.id)).toEqual([
      "cores",
      "tipografia",
    ])
  })
})

describe("textoDaRestauracao", () => {
  test("uma seção: o nome dela", () => {
    expect(textoDaRestauracao([{ titulo: "Cores e botões" }])).toBe(
      "Cores e botões volta ao padrão",
    )
  })

  test("duas ou mais: as duas por extenso, em lista", () => {
    expect(textoDaRestauracao([{ titulo: "Cores e botões" }, { titulo: "Tipografia" }])).toBe(
      "Cores e botões e Tipografia voltam ao padrão",
    )
  })

  test("três ou mais: conta quantas", () => {
    expect(textoDaRestauracao([{ titulo: "A" }, { titulo: "B" }, { titulo: "C" }])).toBe(
      "3 seções voltam ao padrão",
    )
  })
})
