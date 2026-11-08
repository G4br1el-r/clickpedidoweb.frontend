import { expect, type Page, test } from "@playwright/test"
import {
  abrirCheckout,
  acaoCheckout,
  verificarAcessibilidade,
  verificarAreasDeToque,
  verificarSemRolagemHorizontal,
} from "./apoio"

async function preencherDados(page: Page) {
  await page.getByLabel("Nome").fill("Gabriel")
  await page.getByLabel("WhatsApp").fill("(12) 99888-7766")
  await acaoCheckout(page).click()
  await expect(page.getByRole("heading", { name: "Como você quer receber?" })).toBeVisible()
}

/** A busca de CEP é simulada para o teste não depender da internet. */
async function preencherEndereco(page: Page) {
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
  await expect(page.getByLabel("Número")).toBeFocused()
  await page.getByLabel("Número").fill("10")
}

test.describe("checkout", () => {
  test("cada passo passa na acessibilidade, sem controle pequeno nem rolagem lateral", async ({
    page,
  }) => {
    await abrirCheckout(page)
    const verificar = async () => {
      await page.waitForTimeout(350)
      await verificarSemRolagemHorizontal(page)
      await verificarAreasDeToque(page.locator("#formulario-checkout"))
      await verificarAcessibilidade(page)
    }
    await verificar()
    await preencherDados(page)
    await preencherEndereco(page)
    await verificar()
    await acaoCheckout(page).click()
    await expect(page.getByRole("heading", { name: "Como você prefere pagar?" })).toBeVisible()
    await verificar()
    await page.getByLabel("CPF").fill("529.982.247-25")
    await acaoCheckout(page).click()
    await expect(page.getByRole("heading", { name: "Confira e envie" })).toBeVisible()
    await verificar()
  })

  test("não avança sem os dados e mostra o que falta", async ({ page }) => {
    await abrirCheckout(page)
    await acaoCheckout(page).click()
    await expect(page.getByText("Diga como podemos te chamar")).toBeVisible()
    await expect(page.getByText("Confira o número com DDD")).toBeVisible()
    await expect(page.getByLabel("Nome")).toBeFocused()
    await expect(page.getByRole("heading", { name: "Para quem é o pedido?" })).toBeVisible()
  })

  test("sem CEP, dá para preencher o endereço à mão e escolher o bairro", async ({ page }) => {
    await abrirCheckout(page)
    await preencherDados(page)
    await page.getByRole("button", { name: "Não sei meu CEP" }).click()
    await page.getByLabel("Rua").fill("Rua das Flores")
    await page.getByLabel("Número").fill("10")
    await page.getByRole("combobox", { name: "Bairro" }).click()
    await page.getByRole("option", { name: /Urbanova/ }).click()
    await expect(page.getByText("Entrega para Urbanova:")).toBeVisible()
    await acaoCheckout(page).click()
    await expect(page.getByText("Digite os 8 números do CEP")).toBeVisible()
  })

  test("a taxa do bairro entra no total", async ({ page }) => {
    await abrirCheckout(page)
    await preencherDados(page)
    await preencherEndereco(page)
    await expect(page.getByText("Entrega para Jardim Aquarius:")).toBeVisible()
    // 2 refrigerantes de cola (R$ 30,00) + R$ 8,00 do bairro.
    const total = page.getByTestId("total-resumo").last()
    await expect(total).toContainText("R$ 38,00")
    await page.getByTestId("opcao-retirada").click()
    await expect(total).toContainText("R$ 30,00")
  })

  test("Pix pede um CPF válido e o troco precisa cobrir o total", async ({ page }) => {
    await abrirCheckout(page)
    await preencherDados(page)
    await page.getByTestId("opcao-retirada").click()
    await acaoCheckout(page).click()
    await page.getByLabel("CPF").fill("111.111.111-11")
    await acaoCheckout(page).click()
    await expect(page.getByText("Confira o CPF")).toBeVisible()

    await page.getByTestId("pagamento-dinheiro").click()
    await page.getByRole("radio", { name: "Outro valor" }).click()
    await page.getByLabel("Troco para quanto?").pressSequentially("20")
    await acaoCheckout(page).click()
    await expect(page.getByText("O troco precisa ser para R$ 30,00 ou mais")).toBeVisible()
    await page.getByRole("radio", { name: "R$ 50" }).click()
    await expect(page.getByText("Seu troco será de R$ 20,00")).toBeVisible()
    await acaoCheckout(page).click()
    await expect(page.getByRole("heading", { name: "Confira e envie" })).toBeVisible()
  })

  test("na revisão, alterar volta ao passo certo", async ({ page }) => {
    await abrirCheckout(page)
    await preencherDados(page)
    await page.getByTestId("opcao-retirada").click()
    await acaoCheckout(page).click()
    await page.getByTestId("pagamento-maquininha").click()
    await acaoCheckout(page).click()
    await page.getByRole("button", { name: "Alterar seus dados" }).click()
    await expect(page.getByRole("heading", { name: "Para quem é o pedido?" })).toBeVisible()
    await expect(page.getByLabel("Nome")).toHaveValue("Gabriel")
  })

  test("Pix mostra o QR Code e o código para copiar no acompanhamento", async ({ page }) => {
    await abrirCheckout(page)
    await preencherDados(page)
    await page.getByTestId("opcao-retirada").click()
    await acaoCheckout(page).click()
    await page.getByLabel("CPF").fill("529.982.247-25")
    await acaoCheckout(page).click()
    await acaoCheckout(page).click()
    await expect(page).toHaveURL("/pedido", { timeout: 15_000 })
    await expect(page.getByRole("heading", { level: 1, name: "Aguardando o Pix" })).toBeVisible({
      timeout: 8000,
    })
    await expect(page.getByRole("img", { name: "QR Code do Pix" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Copiar código Pix" })).toBeVisible()
  })

  test("sem itens na sacola, mostra o caminho de volta ao cardápio", async ({ page }) => {
    await page.goto("/finalizar")
    await expect(page.getByText("Sua sacola está vazia")).toBeVisible()
    await expect(page.getByRole("link", { name: "Ver cardápio" })).toBeVisible()
  })

  test("dados do último pedido já vêm preenchidos", async ({ page }) => {
    await abrirCheckout(page)
    await preencherDados(page)
    await page.getByTestId("opcao-retirada").click()
    await acaoCheckout(page).click()
    await page.getByTestId("pagamento-maquininha").click()
    await acaoCheckout(page).click()
    await acaoCheckout(page).click()
    await expect(page).toHaveURL("/pedido", { timeout: 15_000 })
    await abrirCheckout(page)
    await expect(page.getByText("Preenchemos com os dados do seu último pedido.")).toBeVisible()
    await expect(page.getByLabel("Nome")).toHaveValue("Gabriel")
  })
})
