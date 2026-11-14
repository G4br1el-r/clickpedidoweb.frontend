import { expect, type Page, test } from "@playwright/test"
import {
  acaoCheckout,
  esperarAnimacoes,
  verificarAcessibilidade,
  verificarSemRolagemHorizontal,
} from "./apoio"

/** Cada teste começa na pizzaria, com a sacola vazia. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("loja-limpa")) {
      localStorage.removeItem("clickpedido-loja")
      localStorage.removeItem("clickpedido-sacola")
      sessionStorage.setItem("loja-limpa", "1")
    }
  })
})

async function irParaFarmacia(page: Page) {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1, name: "Casa da Pizza" })).toBeVisible()
  await page.getByRole("button", { name: "Loja: Casa da Pizza" }).click()
  await page.getByRole("menuitemradio", { name: /Drogaria Bem Estar/ }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Drogaria Bem Estar" })).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("data-loja", "drogaria-bem-estar")
}

/** A busca de CEP é simulada para o teste não depender da internet. */
async function preencherAteRevisao(page: Page) {
  await page.getByLabel("Nome").fill("Ana")
  await page.getByLabel("WhatsApp").fill("(12) 99888-7766")
  await acaoCheckout(page).click()
  await expect(page.getByRole("heading", { name: "Como você quer receber?" })).toBeVisible()
  await page.route("**/viacep.com.br/**", (rota) =>
    rota.fulfill({
      json: {
        logradouro: "Rua das Flores",
        bairro: "Jardim Aquarius",
        localidade: "São José dos Campos",
        uf: "SP",
      },
    }),
  )
  await page.getByLabel("CEP").fill("12245-000")
  await expect(page.getByLabel("Rua")).toHaveValue("Rua das Flores")
  await page.getByLabel("Número").fill("10")
  await acaoCheckout(page).click()
  await expect(page.getByRole("heading", { name: "Como você prefere pagar?" })).toBeVisible()
  await page.getByLabel("CPF").fill("529.982.247-25")
  await acaoCheckout(page).click()
  await expect(page.getByRole("heading", { name: "Confira e envie" })).toBeVisible()
}

test("farmácia: trocar de loja, controlado só no balcão e pedido com a foto da receita", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await irParaFarmacia(page)
  await expect(page).toHaveTitle("Drogaria Bem Estar · Cardápio")
  await esperarAnimacoes(page)
  await verificarSemRolagemHorizontal(page)
  await verificarAcessibilidade(page)

  // Controlado não tem venda pela internet: o botão abre a ficha, que explica.
  const clonazepam = page.getByRole("button", { name: "Clonazepam 2 mg: só no balcão" })
  await clonazepam.scrollIntoViewIfNeeded()
  await clonazepam.click()
  const ficha = page.getByRole("dialog", { name: "Clonazepam 2 mg" })
  await expect(ficha.getByText(/a lei não permite venda pela internet/)).toBeVisible()
  await expect(ficha.getByTestId("cta-adicionar")).toBeDisabled()
  await page.keyboard.press("Escape")
  await expect(ficha).toBeHidden()

  // Antibiótico entra na sacola; a receita é pedida no fim.
  const amoxicilina = page.getByTestId("adicionar-amoxicilina-500")
  await amoxicilina.scrollIntoViewIfNeeded()
  await amoxicilina.click()
  await page.goto("/finalizar")
  await expect(page.getByRole("heading", { name: "Para quem é o pedido?" })).toBeVisible()
  await preencherAteRevisao(page)

  const receita = page.getByRole("region", { name: "Receita médica" })
  await expect(receita.getByText("Amoxicilina 500 mg")).toBeVisible()
  await expect(receita.getByText(/o entregador recolhe na entrega/)).toBeVisible()
  await verificarAcessibilidade(page)

  // Sem a foto, o pedido não sai.
  await acaoCheckout(page).click()
  await expect(receita.getByRole("alert")).toHaveText("Anexe a foto da receita para enviar.")

  await receita.getByLabel("Foto da receita").setInputFiles({
    name: "receita.png",
    mimeType: "image/png",
    // PNG de 1×1 pixel.
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  })
  await expect(receita.getByRole("img", { name: "Receita anexada" })).toBeVisible()
  await acaoCheckout(page).click()

  await expect(page).toHaveURL(/\/pedido$/, { timeout: 15_000 })
  await expect(page.getByText("Receita enviada")).toBeVisible()
  await expect(page.getByText(/receita\.png · tenha a via original em mãos/)).toBeVisible()
})

test("farmácia: trocar de loja com a sacola cheia pede confirmação", async ({ page }) => {
  await page.goto("/")
  const refri = page.getByTestId("adicionar-refrigerante-cola")
  await refri.scrollIntoViewIfNeeded()
  await refri.click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.getByRole("button", { name: "Loja: Casa da Pizza" }).click()
  await page.getByRole("menuitemradio", { name: /Drogaria Bem Estar/ }).click()

  const aviso = page.getByRole("alertdialog", { name: "Trocar para Drogaria Bem Estar?" })
  await expect(aviso).toContainText("1 item da Casa da Pizza sai da sacola")
  await aviso.getByRole("button", { name: "Continuar na Casa da Pizza" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Casa da Pizza" })).toBeVisible()

  await page.getByRole("button", { name: "Loja: Casa da Pizza" }).click()
  await page.getByRole("menuitemradio", { name: /Drogaria Bem Estar/ }).click()
  await page.getByRole("button", { name: "Esvaziar e trocar" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Drogaria Bem Estar" })).toBeVisible()

  // A escolha fica salva: ao recarregar, a página já nasce na drogaria.
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("data-loja", "drogaria-bem-estar")
  await expect(page.getByRole("heading", { level: 1, name: "Drogaria Bem Estar" })).toBeVisible()
})
