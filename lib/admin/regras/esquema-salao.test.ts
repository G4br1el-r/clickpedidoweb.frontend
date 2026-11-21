import { describe, expect, test } from "vitest"
import { CONFIG_SALAO_PADRAO } from "../dados/migracao"
import { esquemaSalao } from "./esquema-salao"

const padrao = {
  ...CONFIG_SALAO_PADRAO,
  areas: [{ id: "area-salao", nome: "Salão", ordem: 1 }],
}

describe("esquema do salão", () => {
  test("aceita a configuração padrão com uma área", () => {
    expect(esquemaSalao.safeParse(padrao).success).toBe(true)
  })

  test.each([
    [{ taxaServico: { ativa: true, percentual: 21 } }, "A taxa de serviço vai de 0% a 20%."],
    [{ couvert: { ativo: true, porPessoa: 100.01 } }, "O couvert vai até R$ 100,00 por pessoa."],
    [{ areas: [] }, "O salão precisa de pelo menos uma área."],
    [
      {
        areas: [
          { id: "a", nome: "Varanda", ordem: 1 },
          { id: "b", nome: " varanda ", ordem: 2 },
        ],
      },
      "Já existe a área Varanda.",
    ],
    [{ areas: [{ id: "a", nome: "  ", ordem: 1 }] }, "Informe o nome da área."],
    [
      {
        areas: [
          { id: "a", nome: "Salão", ordem: 1 },
          { id: "a", nome: "Varanda", ordem: 2 },
        ],
      },
      "Há duas áreas com o mesmo identificador.",
    ],
    [
      {
        garcons: [
          { id: "g", nome: "Ana", ativo: true },
          { id: "g", nome: "Beto", ativo: true },
        ],
      },
      "Há dois garçons com o mesmo identificador.",
    ],
    [{ garcons: [{ id: "g", nome: "", ativo: true }] }, "Informe o nome do garçom."],
    [{ alertas: { ...padrao.alertas, semPedidoMin: 0 } }, "Os alertas vão de 1 a 600 minutos."],
  ])("recusa %o com a mensagem certa", (mudanca, mensagem) => {
    const resultado = esquemaSalao.safeParse({ ...padrao, ...mudanca })
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0].message).toBe(mensagem)
  })

  test("a duplicata ignora acento e caixa, e a mensagem usa o nome da primeira como foi escrito", () => {
    const resultado = esquemaSalao.safeParse({
      ...padrao,
      areas: [
        { id: "a", nome: " Salão ", ordem: 1 },
        { id: "b", nome: "SALAO", ordem: 2 },
      ],
    })
    expect(resultado.error?.issues[0].message).toBe("Já existe a área Salão.")
  })

  test.each([
    ["Rafa", "rafa"],
    ["Bia", " Biá "],
  ])(
    "dois garçons com o mesmo nome (%s e %s) são recusados no caminho do segundo",
    (primeiro, segundo) => {
      const resultado = esquemaSalao.safeParse({
        ...padrao,
        garcons: [
          { id: "g1", nome: primeiro, ativo: true },
          { id: "g2", nome: segundo, ativo: false },
        ],
      })
      expect(resultado.error?.issues[0]).toMatchObject({
        message: `Já existe o garçom ${primeiro}.`,
        path: ["garcons", 1, "nome"],
      })
    },
  )

  test("nomes de área e garçom são aparados e limitados a 30 e 40 caracteres", () => {
    const resultado = esquemaSalao.parse({
      ...padrao,
      areas: [{ id: "a", nome: `  ${"A".repeat(35)}  `, ordem: 1 }],
      garcons: [{ id: "g", nome: ` ${"B".repeat(45)} `, ativo: true }],
    })
    expect(resultado.areas[0].nome).toBe("A".repeat(30))
    expect(resultado.garcons[0].nome).toBe("B".repeat(40))
  })

  test("o couvert aceita só reais e centavos", () => {
    const comCouvert = (porPessoa: number) =>
      esquemaSalao.safeParse({ ...padrao, couvert: { ativo: true, porPessoa } })
    const recusado = comCouvert(8.555)
    expect(recusado.success).toBe(false)
    expect(recusado.error?.issues[0].message).toBe("Informe o couvert em reais e centavos.")
    expect(comCouvert(8.5).success).toBe(true)
    expect(comCouvert(8.55).success).toBe(true)
  })

  test("a taxa de serviço aceita até 2 casas", () => {
    const comTaxa = (percentual: number) =>
      esquemaSalao.safeParse({ ...padrao, taxaServico: { ativa: true, percentual } })
    const recusada = comTaxa(12.345)
    expect(recusada.success).toBe(false)
    expect(recusada.error?.issues[0].message).toBe("Informe a taxa com até 2 casas decimais.")
    expect(comTaxa(12.5).success).toBe(true)
  })
})
