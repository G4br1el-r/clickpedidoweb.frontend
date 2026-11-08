import { expect, type Page, test } from "@playwright/test"
import { abrirCardapio, abrirMeioAMeio } from "./apoio"

/**
 * Toda rolagem dentro do site usa a barra da casa (fina, na cor do tema).
 * A rolagem da página continua a do navegador, e as listas que escondem a barra
 * de propósito (`sem-barra`) continuam sem barra.
 */
async function barras(page: Page) {
  return page.evaluate(() => {
    const estilo = (elemento: Element) => getComputedStyle(elemento)
    const pagina = estilo(document.documentElement)
    const internas = [...document.body.querySelectorAll("*")]
      .filter((elemento) => {
        const { overflowX, overflowY } = estilo(elemento)
        return [overflowX, overflowY].some((valor) => valor === "auto" || valor === "scroll")
      })
      .map((elemento) => ({
        quem: `${elemento.tagName.toLowerCase()}.${[...elemento.classList].slice(0, 3).join(".")}`,
        largura: estilo(elemento).scrollbarWidth,
        cor: estilo(elemento).scrollbarColor,
      }))
    return {
      pagina: { largura: pagina.scrollbarWidth, cor: pagina.scrollbarColor },
      internas,
    }
  })
}

function conferir(resultado: Awaited<ReturnType<typeof barras>>) {
  expect(resultado.pagina, "a rolagem da página é a do navegador").toEqual({
    largura: "auto",
    cor: "auto",
  })
  expect(resultado.internas.length, "a tela tem rolagens internas").toBeGreaterThan(0)
  for (const barra of resultado.internas) {
    if (barra.largura === "none") continue // listas que escondem a barra de propósito
    expect(barra, `${barra.quem} usa a barra da casa`).toMatchObject({ largura: "thin" })
    expect(barra.cor, `${barra.quem} tem cor própria`).not.toBe("auto")
  }
}

test.describe("barras de rolagem", () => {
  test("no cardápio, as rolagens internas usam a barra da casa", async ({ page }) => {
    await abrirCardapio(page)
    conferir(await barras(page))
  })

  test("no painel do produto também", async ({ page }) => {
    await abrirCardapio(page)
    await abrirMeioAMeio(page)
    conferir(await barras(page))
  })
})
