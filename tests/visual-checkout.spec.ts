import { expect, type Page, test } from "@playwright/test"
import { abrirCardapio, abrirSacola, acaoCheckout, esperarAnimacoes } from "./apoio"

/**
 * Referências visuais da sacola e do checkout: mudança de estilo só depois de existir a
 * imagem do antes. Como as outras referências, roda só em um celular e um computador.
 */
const TELAS_VISUAIS = ["celular-390", "desktop-1920"]

// Sem relógio falso (page.clock): nada aqui depende da hora, e com ele as trocas animadas
// travavam de vez em quando no meio, com a máquina ocupada.

test.beforeEach(() => {
  test.skip(!TELAS_VISUAIS.includes(test.info().project.name), "referência visual só em 2 telas")
})

async function adicionar(page: Page, produto: string, vezes = 1) {
  const botao = page.getByTestId(`adicionar-${produto}`)
  await botao.scrollIntoViewIfNeeded()
  for (let vez = 0; vez < vezes; vez++) await botao.click()
}

/** A sacola com dois produtos (um deles com 2 unidades), acima do pedido mínimo, e o checkout aberto. */
async function abrirCheckoutCheio(page: Page) {
  await abrirCardapio(page)
  await adicionar(page, "refrigerante-cola", 2)
  await adicionar(page, "refrigerante-guarana")
  await page.goto("/finalizar")
  await expect(page.getByRole("heading", { name: "Para quem é o pedido?" })).toBeVisible()
  await page.waitForLoadState("networkidle")
  await esperarAnimacoes(page)
}

async function fotografar(page: Page, nome: string) {
  // A troca de passo tem crossfade; espera ele terminar e o foco ir para o título.
  // O ponteiro sai de cima do botão: a emulação de toque deixa o hover preso depois do clique.
  await page.mouse.move(0, 0)
  await page.waitForTimeout(400)
  await esperarAnimacoes(page)
  await expect(page).toHaveScreenshot(nome, { fullPage: true, animations: "disabled" })
}

async function preencherDados(page: Page) {
  await page.getByLabel("Nome").fill("Gabriel")
  await page.getByLabel("WhatsApp").fill("(12) 99888-7766")
  await acaoCheckout(page).click()
  await expect(page.getByRole("heading", { name: "Como você quer receber?" })).toBeVisible()
}

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
  await expect(page.getByText("Entrega para Jardim Aquarius:")).toBeVisible()
}

for (const tema of ["light", "dark"] as const) {
  const nomeTema = tema === "light" ? "claro" : "escuro"

  test.describe(`tema ${nomeTema}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    })

    test(`sacola com itens, tema ${nomeTema}`, async ({ page }) => {
      await abrirCardapio(page)
      await adicionar(page, "refrigerante-cola", 2)
      await adicionar(page, "refrigerante-guarana")
      const sacola = await abrirSacola(page)
      await expect(sacola.getByText("Pedido mínimo atingido")).toBeVisible()
      await esperarAnimacoes(page)
      await expect(sacola).toHaveScreenshot(`sacola-com-itens-${tema}.png`, {
        animations: "disabled",
      })
    })

    test(`sacola abaixo do mínimo, tema ${nomeTema}`, async ({ page }) => {
      await abrirCardapio(page)
      await adicionar(page, "refrigerante-guarana")
      const sacola = await abrirSacola(page)
      await expect(sacola.getByText("Faltam R$ 17,00 para o pedido mínimo").first()).toBeVisible()
      await esperarAnimacoes(page)
      await expect(sacola).toHaveScreenshot(`sacola-abaixo-do-minimo-${tema}.png`, {
        animations: "disabled",
      })
    })

    test(`checkout, cada passo, tema ${nomeTema}`, async ({ page }) => {
      await abrirCheckoutCheio(page)
      await fotografar(page, `checkout-dados-${tema}.png`)

      await acaoCheckout(page).click()
      await expect(page.getByText("Diga como podemos te chamar")).toBeVisible()
      await page.getByLabel("Nome").blur()
      await fotografar(page, `checkout-dados-com-erro-${tema}.png`)

      await preencherDados(page)
      await preencherEndereco(page)
      await page.getByLabel("Número").blur()
      await fotografar(page, `checkout-entrega-${tema}.png`)

      await acaoCheckout(page).click()
      await expect(page.getByRole("heading", { name: "Como você prefere pagar?" })).toBeVisible()
      await page.getByLabel("CPF").fill("529.982.247-25")
      await page.getByLabel("CPF").blur()
      await fotografar(page, `checkout-pagamento-${tema}.png`)

      await acaoCheckout(page).click()
      await expect(page.getByRole("heading", { name: "Confira e envie" })).toBeVisible()
      await fotografar(page, `checkout-revisao-${tema}.png`)
    })

    test(`checkout, retirada e troco, tema ${nomeTema}`, async ({ page }) => {
      await abrirCheckoutCheio(page)
      await preencherDados(page)
      await page.getByTestId("opcao-retirada").click()
      await fotografar(page, `checkout-retirada-${tema}.png`)

      await acaoCheckout(page).click()
      await expect(page.getByRole("heading", { name: "Como você prefere pagar?" })).toBeVisible()
      await page.getByTestId("pagamento-dinheiro").click()
      await page.getByRole("radio", { name: "R$ 50" }).click()
      await expect(page.getByText("Seu troco será de R$ 7,00")).toBeVisible()
      await fotografar(page, `checkout-troco-${tema}.png`)
    })

    test(`resumo do pedido aberto no celular, tema ${nomeTema}`, async ({ page }) => {
      test.skip(test.info().project.name !== "celular-390", "no computador o resumo fica ao lado")
      await abrirCheckoutCheio(page)
      await page.getByRole("button", { name: /Ver 3 itens/ }).click()
      await expect(page.getByRole("link", { name: "Alterar itens" })).toBeVisible()
      await fotografar(page, `checkout-resumo-aberto-${tema}.png`)
    })
  })
}
