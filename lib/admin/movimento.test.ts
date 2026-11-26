import { describe, expect, it } from "vitest"
import {
  atrasoEscalonado,
  CURVA_SAIDA,
  DURACAO,
  estiloDeEntrada,
  semRelogioDoNavegador,
  variantesDaJanela,
  variantesDoBloco,
  variantesDoItem,
} from "./movimento"

describe("atrasoEscalonado", () => {
  it("o primeiro item entra sem espera", () => {
    expect(atrasoEscalonado(0)).toBe(0)
  })

  it("cada item espera 40 ms a mais que o anterior", () => {
    expect(atrasoEscalonado(1)).toBeCloseTo(0.04)
    expect(atrasoEscalonado(3)).toBeCloseTo(0.12)
  })

  it("para de crescer no oitavo item: lista longa não demora para aparecer", () => {
    expect(atrasoEscalonado(8)).toBeCloseTo(0.32)
    expect(atrasoEscalonado(40)).toBeCloseTo(0.32)
  })

  it("aceita outro passo e outro teto", () => {
    expect(atrasoEscalonado(2, { passo: 0.1, teto: 5 })).toBeCloseTo(0.2)
    expect(atrasoEscalonado(9, { passo: 0.1, teto: 5 })).toBeCloseTo(0.5)
  })
})

describe("tempos e curva", () => {
  it("a curva é a mesma da casa: começa rápido e assenta devagar", () => {
    expect(CURVA_SAIDA).toEqual([0.23, 1, 0.32, 1])
  })

  it("a saída é sempre mais curta que a entrada", () => {
    expect(DURACAO.saida).toBeLessThan(DURACAO.entrada)
  })

  it("nenhuma animação de interface passa de 300 ms", () => {
    expect(Math.max(...Object.values(DURACAO))).toBeLessThanOrEqual(0.3)
  })
})

describe("variantesDoBloco (entrada da página e de seções)", () => {
  it("já nasce visível: a entrada é do CSS, que roda na primeira pintura", () => {
    const { entrar, parado } = variantesDoBloco(false)
    expect(entrar).toEqual({ opacity: 1, y: 0 })
    expect(parado).toMatchObject({ opacity: 1, y: 0 })
  })

  it("sai subindo 4 px e sumindo", () => {
    expect(variantesDoBloco(false).sair).toMatchObject({ opacity: 0, y: -4 })
  })

  it("com movimento reduzido só some, sem se mexer", () => {
    const { entrar, sair } = variantesDoBloco(true)
    expect(entrar).toEqual({ opacity: 1 })
    expect(sair).toEqual({ opacity: 0, transition: { duration: DURACAO.rapida } })
  })
})

describe("variantesDoItem (linha ou cartão de lista)", () => {
  it("entra com a espera do próprio lugar na lista", () => {
    const { parado } = variantesDoItem(false)
    const efeito = (parado as (indice: number) => { transition: { delay: number } })(3)
    expect(efeito.transition.delay).toBeCloseTo(0.12)
  })

  it("sai mais depressa do que entrou, sem espera", () => {
    const { sair } = variantesDoItem(false)
    expect(sair).toMatchObject({ opacity: 0, transition: { duration: DURACAO.saida } })
    expect((sair as { transition: object }).transition).not.toHaveProperty("delay")
  })

  it("já nasce visível: a entrada é do CSS, que roda na primeira pintura", () => {
    expect(variantesDoItem(false).entrar).toEqual({ opacity: 1, y: 0 })
  })

  it("com movimento reduzido não desliza nem espera", () => {
    const { entrar, parado } = variantesDoItem(true)
    expect(entrar).toEqual({ opacity: 1 })
    const efeito = (parado as (indice: number) => { transition: { delay: number } })(5)
    expect(efeito.transition.delay).toBe(0)
  })
})

describe("variantesDaJanela (janela, menu e painel que abrem)", () => {
  it("nunca nasce do nada: começa em 96% do tamanho, não em zero", () => {
    const { entrar } = variantesDaJanela(false)
    expect(entrar).toMatchObject({ opacity: 0, scale: 0.96 })
  })

  it("com movimento reduzido só troca a opacidade", () => {
    const { entrar, parado, sair } = variantesDaJanela(true)
    expect(entrar).toEqual({ opacity: 0 })
    expect(parado).not.toHaveProperty("scale")
    expect(sair).not.toHaveProperty("scale")
  })
})

describe("estiloDeEntrada", () => {
  it("passa para o CSS a espera do item na lista", () => {
    expect(estiloDeEntrada(3)).toEqual({ "--atraso": "0.12s" })
  })

  it("o primeiro item não espera", () => {
    expect(estiloDeEntrada(0)).toEqual({ "--atraso": "0s" })
  })

  it("a espera para no teto, como a do Motion", () => {
    expect(estiloDeEntrada(50)).toEqual({ "--atraso": "0.32s" })
  })
})

describe("semRelogioDoNavegador", () => {
  it("é um `onUpdate` que não faz nada: só existe para o Motion animar no JavaScript", () => {
    expect(semRelogioDoNavegador()).toBeUndefined()
  })
})
