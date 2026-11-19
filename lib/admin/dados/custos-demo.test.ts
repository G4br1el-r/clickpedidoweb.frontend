import { describe, expect, test } from "vitest"
import { carregarCatalogo } from "./catalogos"
import { semearCustos } from "./custos-demo"

describe("semearCustos", () => {
  test("cada produto ganha um custo plausível, sempre o mesmo para o mesmo produto", async () => {
    const { produtos } = await carregarCatalogo("adega")
    const com = semearCustos(produtos, "adega")

    expect(semearCustos(produtos, "adega")).toEqual(com)
    for (const produto of com.filter((item) => item.custo !== undefined)) {
      expect(produto.custo).toBeGreaterThanOrEqual(produto.preco * 0.3)
      expect(produto.custo).toBeLessThanOrEqual(produto.preco * 0.6)
    }
  })

  test("uns poucos ficam sem custo, para a tela mostrar o aviso de cobertura", async () => {
    const { produtos } = await carregarCatalogo("adega")
    const semCusto = semearCustos(produtos, "adega").filter((item) => item.custo === undefined)

    expect(semCusto.length).toBeGreaterThan(0)
    expect(semCusto.length).toBeLessThan(produtos.length * 0.2)
  })

  test("no salão o custo é o do material, uma parte menor do preço", async () => {
    const { produtos } = await carregarCatalogo("salao")
    for (const servico of semearCustos(produtos, "salao")) {
      if (servico.custo === undefined) continue
      expect(servico.custo).toBeGreaterThanOrEqual(servico.preco * 0.15)
      expect(servico.custo).toBeLessThanOrEqual(servico.preco * 0.35)
    }
  })

  test("produto que já tem custo fica com o dele", async () => {
    const { produtos } = await carregarCatalogo("adega")
    const [primeiro, ...resto] = produtos

    expect(semearCustos([{ ...primeiro, custo: 1.23 }, ...resto], "adega")[0].custo).toBe(1.23)
  })
})
