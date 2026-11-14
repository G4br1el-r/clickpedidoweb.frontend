import { describe, expect, test } from "vitest"
import type { DadosMedicamento } from "./admin/dados/tipos"
import { comoVender, formatarRegistroMs, receitaDaSacola } from "./farmacia"
import type { ItemSacola } from "./sacola"

const medicamento = (dados: Partial<DadosMedicamento>): DadosMedicamento => ({
  tarja: "vermelha",
  tipo: "generico",
  principioAtivo: "Losartana potássica",
  apresentacao: "50 mg, 30 comprimidos",
  laboratorio: "EMS",
  registroMs: "1023505830017",
  ...dados,
})

describe("comoVender", () => {
  test("item sem dados de medicamento e remédio sem tarja vão direto para a sacola", () => {
    expect(comoVender(undefined)).toBe("livre")
    expect(comoVender(medicamento({ tarja: "sem-tarja" }))).toBe("livre")
  })

  test("tarja vermelha pede a foto da receita", () => {
    expect(comoVender(medicamento({ tarja: "vermelha" }))).toBe("receita")
  })

  test("antimicrobiano pede a foto e a via fica retida na entrega", () => {
    expect(comoVender(medicamento({ tarja: "vermelha-retencao", lista: "antimicrobiano" }))).toBe(
      "receita-retida",
    )
  })

  test("controlados da Portaria 344 só saem no balcão, com a receita original", () => {
    expect(comoVender(medicamento({ tarja: "vermelha-retencao", lista: "C1" }))).toBe("so-balcao")
    expect(comoVender(medicamento({ tarja: "preta", lista: "B1" }))).toBe("so-balcao")
    expect(comoVender(medicamento({ tarja: "preta", lista: "A3" }))).toBe("so-balcao")
  })
})

describe("receitaDaSacola", () => {
  const item = (nome: string, venda?: ItemSacola["venda"]): ItemSacola => ({
    chave: nome,
    produtoId: nome,
    nome,
    imagem: { src: "/x.jpg", width: 1, height: 1 },
    precoUnitario: 10,
    quantidade: 1,
    resumo: [],
    ...(venda ? { venda } : {}),
  })

  test("sacola sem remédio de receita não pede nada", () => {
    expect(receitaDaSacola([item("Pizza"), item("Dipirona", "livre")])).toBeNull()
  })

  test("lista os remédios que pedem receita e se a via fica retida", () => {
    expect(
      receitaDaSacola([
        item("Dipirona", "livre"),
        item("Losartana 50 mg", "receita"),
        item("Amoxicilina 500 mg", "receita-retida"),
      ]),
    ).toEqual({ itens: ["Losartana 50 mg", "Amoxicilina 500 mg"], retida: true })
    expect(receitaDaSacola([item("Losartana 50 mg", "receita")])).toEqual({
      itens: ["Losartana 50 mg"],
      retida: false,
    })
  })
})

describe("formatarRegistroMs", () => {
  test("põe os pontos e o dígito do registro de 13 números", () => {
    expect(formatarRegistroMs("1023508930064")).toBe("1.0235.0893.006-4")
  })

  test("registro fora do padrão fica como veio", () => {
    expect(formatarRegistroMs("123")).toBe("123")
  })
})
