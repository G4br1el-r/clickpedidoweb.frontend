import { expect, type Page, test } from "@playwright/test"
import {
  abrirCardapio,
  abrirCheckout,
  abrirSacola,
  esperarAnimacoes,
  verificarSemRolagemHorizontal,
} from "./apoio"
import { botoesCortados, controlesPequenos } from "./apoio-responsivo"

/**
 * A vitrine em todos os tamanhos: nenhuma loja, nenhuma janela aberta e nenhum passo do pedido
 * pode criar rolagem lateral nem cortar o que um botão diz.
 */
test.use({ timezoneId: "America/Sao_Paulo" })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  // O selo de avisos do Next no modo dev (canto de baixo) cobre o último item dos menus em tela baixa.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const estilo = document.createElement("style")
      estilo.textContent = "nextjs-portal { display: none !important; }"
      document.head.append(estilo)
    })
  })
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("vitrine-limpa")) {
      localStorage.removeItem("clickpedido-loja")
      localStorage.removeItem("clickpedido-sacola")
      sessionStorage.setItem("vitrine-limpa", "1")
    }
  })
})

async function conferir(page: Page) {
  await esperarAnimacoes(page)
  await verificarSemRolagemHorizontal(page)
  expect(await botoesCortados(page)).toEqual([])
  // Em tela de toque, todo controle alcança 44 px para o dedo.
  if (test.info().project.use.hasTouch) expect(await controlesPequenos(page)).toEqual([])
}

async function abrirLoja(page: Page, nome: string) {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1, name: "Casa da Pizza" })).toBeVisible()
  await page.getByRole("button", { name: "Loja: Casa da Pizza" }).click()
  await page.getByRole("menuitemradio", { name: new RegExp(nome) }).click()
  await expect(page.getByRole("heading", { level: 1, name: nome })).toBeVisible()
  await page.getByTestId("grade-produtos").first().waitFor()
}

const LOJAS = [
  "Casa da Pizza",
  "Adega da Vila",
  "Açougue Sabor da Carne",
  "Drogaria Bem Estar",
  "Empório das Deusas",
  "Quiosque do Mineiro",
]

test.describe("vitrine: o cardápio de cada loja cabe e não corta botões", () => {
  for (const loja of LOJAS) {
    test(loja, async ({ page }) => {
      if (loja === "Casa da Pizza") await abrirCardapio(page)
      else await abrirLoja(page, loja)
      await conferir(page)
      // Rolada até o meio, com a barra de categorias grudada.
      await page.evaluate(() => window.scrollTo(0, 1400))
      await page.waitForTimeout(250)
      await conferir(page)
    })
  }
})

test.describe("vitrine: janelas e passos do pedido", () => {
  test("detalhes da loja", async ({ page }) => {
    await abrirCardapio(page)
    await page.getByRole("button", { name: "A loja" }).first().click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await conferir(page)
  })

  test("sacola com itens", async ({ page }) => {
    await abrirCardapio(page)
    const botao = page.getByTestId("adicionar-refrigerante-cola")
    await botao.scrollIntoViewIfNeeded()
    await botao.click()
    await botao.click()
    const guarana = page.getByTestId("adicionar-refrigerante-guarana")
    await guarana.scrollIntoViewIfNeeded()
    await guarana.click()
    await abrirSacola(page)
    await conferir(page)
  })

  test("produto com opções aberto", async ({ page }) => {
    await abrirCardapio(page)
    await page.getByTestId("adicionar-meio-a-meio").first().click()
    await expect(page.getByTestId("painel-produto")).toBeVisible()
    await conferir(page)
  })

  test("checkout: dados", async ({ page }) => {
    await abrirCheckout(page)
    await conferir(page)
  })
})
