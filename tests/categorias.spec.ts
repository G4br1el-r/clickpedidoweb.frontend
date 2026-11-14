import { expect, test } from "@playwright/test"
import { abrirCardapio, caixa, esperarAnimacoes } from "./apoio"

/**
 * Doze categorias não cabem na coluna central: o trilho rola de lado.
 * Com mouse aparecem setas; no toque, a pessoa arrasta com o dedo e não há setas.
 */
test.describe("categorias com rolagem lateral", () => {
  test("o cardápio tem as doze categorias, com Bebidas por último", async ({ page }) => {
    await abrirCardapio(page)
    const barra = page.getByTestId("barra-navegacao")
    const nomes = await barra.getByRole("button", { name: /./ }).allTextContents()
    const categorias = nomes.filter((nome) => nome.trim() && !/busca|opções/i.test(nome))

    expect(categorias).toEqual([
      "Monte a sua",
      "Combos",
      "Tradicionais",
      "Nobres",
      "Doces",
      "Calzones",
      "Esfihas",
      "Massas",
      "Entradas",
      "Porções",
      "Sobremesas",
      "Bebidas",
    ])
  })

  test("com mouse, as setas levam pelas categorias", async ({ page, isMobile }) => {
    test.skip(isMobile, "no toque não há setas")
    await abrirCardapio(page)
    const barra = page.getByTestId("barra-navegacao")
    await barra.scrollIntoViewIfNeeded()
    const anterior = barra.getByRole("button", { name: "Ver categorias anteriores" })
    const proxima = barra.getByRole("button", { name: "Ver próximas categorias" })

    await expect(proxima).toBeVisible()
    await expect(anterior).toBeHidden()

    await proxima.click()
    await esperarAnimacoes(page)
    await expect(anterior).toBeVisible()

    // As setas ficam sobre as pontas do trilho, sem vazar para fora dele.
    const trilho = await caixa(barra.locator('[aria-current="true"]').locator(".."))
    // Depois do clique a da frente pode ter sumido (chegou ao fim): mede só as que estão à vista.
    const visiveis = []
    for (const seta of [anterior, proxima])
      if (await seta.isVisible()) visiveis.push(await caixa(seta))
    expect(visiveis.length).toBeGreaterThan(0)
    for (const seta of visiveis) {
      expect(seta.x).toBeGreaterThanOrEqual(trilho.x - 1)
      expect(seta.x + seta.width).toBeLessThanOrEqual(trilho.x + trilho.width + 1)
      expect(
        Math.abs(seta.y + seta.height / 2 - (trilho.y + trilho.height / 2)),
      ).toBeLessThanOrEqual(1)
    }
  })

  test("no toque, não há setas e o trilho rola com o dedo", async ({ page, isMobile }) => {
    test.skip(!isMobile, "só nas telas de toque")
    await abrirCardapio(page)
    const barra = page.getByTestId("barra-navegacao")
    await expect(barra.getByRole("button", { name: /categorias/ })).toHaveCount(0)

    const trilho = barra.locator('[aria-current="true"]').locator("..")
    const { rola, overflow } = await trilho.evaluate((elemento) => ({
      rola: elemento.scrollWidth > elemento.clientWidth,
      overflow: getComputedStyle(elemento).overflowX,
    }))
    expect(rola).toBe(true)
    expect(overflow).toBe("auto")
  })

  test("ao rolar a página, a pílula vai direto para a nova categoria, sem ir e voltar", async ({
    page,
  }) => {
    await abrirCardapio(page)
    // Começa com Tradicionais já ativa: o título dela logo abaixo da barra.
    await page.evaluate(() => {
      const titulo = [...document.querySelectorAll("h2")].find(
        (h) => h.textContent?.trim() === "Tradicionais",
      )
      if (titulo)
        window.scrollTo({
          top: titulo.getBoundingClientRect().top + window.scrollY - 100,
          behavior: "instant",
        })
    })
    await expect(page.getByTestId("barra-navegacao").locator("[aria-current]")).toHaveText(
      "Tradicionais",
    )
    await esperarAnimacoes(page)

    // Rola devagar até passar de Tradicionais para Nobres, medindo a cada quadro.
    const amostras = await page.evaluate(async () => {
      const trilho = document.querySelector("[data-testid=barra-navegacao] .sem-barra")
      const nobres = [...document.querySelectorAll("h2")].find(
        (h) => h.textContent?.trim() === "Nobres",
      )
      if (!trilho || !nobres) return []
      const alvo = nobres.getBoundingClientRect().top + window.scrollY - 100
      const lista: { ativa: string; x: number }[] = []
      for (let quadro = 0; quadro < 90; quadro += 1) {
        if (window.scrollY < alvo)
          window.scrollTo({ top: Math.min(alvo, window.scrollY + 30), behavior: "instant" })
        await new Promise(requestAnimationFrame)
        const ativa = trilho.querySelector("[aria-current]")
        const pilula = ativa?.querySelector(":scope > span.absolute")
        if (!ativa || !pilula) continue
        const caixaTrilho = trilho.getBoundingClientRect()
        lista.push({
          ativa: ativa.textContent ?? "",
          x: pilula.getBoundingClientRect().left - caixaTrilho.left + trilho.scrollLeft,
        })
      }
      return lista
    })

    const ordem = amostras
      .map(({ ativa }) => ativa)
      .filter((ativa, i, todas) => ativa !== todas[i - 1])
    expect(ordem, "a ativa troca uma vez, sem voltar").toEqual(["Tradicionais", "Nobres"])

    // Dentro do trilho, a pílula só anda para a direita (de Tradicionais para Nobres).
    const recuos = amostras
      .slice(1)
      .map((amostra, i) => amostras[i].x - amostra.x)
      .filter((recuo) => recuo > 2)
    expect(recuos, "a pílula não volta para trás no caminho").toEqual([])
  })
})

test("farmácia: num deslize rápido, a pílula pula as categorias do meio", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "clickpedido-loja",
      JSON.stringify({ state: { id: "drogaria-bem-estar" }, version: 1 }),
    ),
  )
  await page.goto("/")
  const barra = page.getByTestId("barra-navegacao")
  await expect(page.getByTestId("produto-amoxicilina-500")).toBeVisible()
  await page.evaluate(() => {
    const titulo = [...document.querySelectorAll("h2")].find(
      (h) => h.textContent?.trim() === "Dor e febre",
    )
    if (titulo)
      window.scrollTo({
        top: titulo.getBoundingClientRect().top + window.scrollY - 100,
        behavior: "instant",
      })
  })
  await expect(barra.locator("[aria-current]")).toHaveText("Dor e febre")
  await esperarAnimacoes(page)

  // Um deslize rápido (150 px por quadro) até Antibióticos, anotando a ativa a cada quadro.
  const ativas = await page.evaluate(async () => {
    const antibioticos = [...document.querySelectorAll("h2")].find(
      (h) => h.textContent?.trim() === "Antibióticos",
    )
    if (!antibioticos) return []
    const alvo = antibioticos.getBoundingClientRect().top + window.scrollY - 100
    const lista: string[] = []
    for (let quadro = 0; quadro < 80; quadro += 1) {
      if (window.scrollY < alvo)
        window.scrollTo({ top: Math.min(alvo, window.scrollY + 150), behavior: "instant" })
      await new Promise(requestAnimationFrame)
      const ativa = document.querySelector("[data-testid=barra-navegacao] [aria-current]")
      if (ativa?.textContent) lista.push(ativa.textContent)
    }
    return lista
  })

  const ordem = ativas.filter((ativa, i, todas) => ativa !== todas[i - 1])
  expect(ordem, "sem parar em Gripe e resfriado no caminho").toEqual([
    "Dor e febre",
    "Antibióticos",
  ])
})
