import { expect, test } from "@playwright/test"

test("não mostra erro no console do início ao produto", async ({ page }) => {
  const erros: string[] = []
  page.on("console", (mensagem) => {
    if (mensagem.type() === "error") erros.push(mensagem.text())
  })
  page.on("pageerror", (erro) => erros.push(String(erro)))

  await page.goto("/")
  await page.getByTestId("adicionar-meio-a-meio").first().click()
  await expect(page.getByTestId("painel-produto")).toBeVisible()
  await page.waitForTimeout(400)

  expect(erros).toEqual([])
})
