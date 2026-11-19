import { expect, type Page, test } from "@playwright/test"
import {
  acaoCheckout,
  esperarAnimacoes,
  verificarAcessibilidade,
  verificarSemRolagemHorizontal,
} from "./apoio"

test.use({ timezoneId: "America/Sao_Paulo" })

/** Cada teste começa sem loja escolhida e com a sacola vazia. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("vitrine-limpa")) {
      localStorage.removeItem("clickpedido-loja")
      localStorage.removeItem("clickpedido-sacola")
      sessionStorage.setItem("vitrine-limpa", "1")
    }
  })
})

async function abrirLoja(page: Page, nome: string) {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1, name: "Casa da Pizza" })).toBeVisible()
  await page.getByRole("button", { name: "Loja: Casa da Pizza" }).click()
  await page.getByRole("menuitemradio", { name: new RegExp(nome) }).click()
  await expect(page.getByRole("heading", { level: 1, name: nome })).toBeVisible()
  // Nome de produto com palavra comprida (cadastro real da adega) não pode alargar a página.
  await page.getByTestId("grade-produtos").first().waitFor()
  await verificarSemRolagemHorizontal(page)
  // No modo celular, a janela cresce junto com o conteúdo: compara com a largura do aparelho.
  const largura = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(largura).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0)
}

/**
 * Adianta ou atrasa só o `Date` da página para `inicio`, e dali ele anda normalmente, também
 * entre uma página e outra. O `page.clock` do Playwright não serve aqui: ele também controla
 * `requestAnimationFrame` e `performance.now`, e a saída animada de um passo do checkout
 * (`AnimatePresence mode="wait"`) não termina, então o passo seguinte nunca aparece.
 */
async function relogioComecandoEm(page: Page, inicio: Date) {
  await page.addInitScript((deslocamento) => {
    const DateReal = Date
    class DateDeslocado extends DateReal {
      constructor(...args: unknown[]) {
        if (args.length === 0) super(DateReal.now() + deslocamento)
        else super(...(args as [string]))
      }
      static now() {
        return DateReal.now() + deslocamento
      }
    }
    globalThis.Date = DateDeslocado as DateConstructor
  }, inicio.getTime() - Date.now())
}

async function preencherDados(page: Page) {
  await page.getByLabel("Nome").fill("Ana")
  await page.getByLabel("WhatsApp").fill("(12) 99888-7766")
  await acaoCheckout(page).click()
}

test("salão: escolher o serviço, marcar dia e horário e ver o horário no pedido", async ({
  page,
}) => {
  test.setTimeout(90_000)
  // Sábado, 14/11/2026, 18h30: o salão ainda está aberto (até as 19h), mas o corte de 1h
  // não cabe mais hoje. O relógio parte daí, a qualquer hora em que o teste rode.
  await relogioComecandoEm(page, new Date("2026-11-14T18:30:00-03:00"))
  await abrirLoja(page, "Empório das Deusas")
  await expect(page.locator("html")).toHaveAttribute("data-loja", "emporio-das-deusas")
  await esperarAnimacoes(page)
  await verificarAcessibilidade(page)

  const corte = page
    .getByTestId("produto-corte-feminino")
    .getByRole("button", { name: "Adicionar Corte Feminino" })
  await corte.scrollIntoViewIfNeeded()
  await corte.click()
  await page.goto("/finalizar")
  await expect(page.getByRole("heading", { name: "Para quem é o pedido?" })).toBeVisible()
  await expect(page.getByRole("navigation", { name: /Passos/ })).toContainText("Horário")
  await preencherDados(page)

  await expect(page.getByRole("heading", { name: "Quando você quer vir?" })).toBeVisible()
  // No celular o resumo lateral fica escondido; do computador para cima, ele diz onde é.
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await expect(page.getByText("Atendimento no salão, no horário marcado")).toBeVisible()
  }
  // Sem horário, não avança.
  await acaoCheckout(page).click()
  await expect(page.getByText("Escolha o dia e o horário")).toBeVisible()

  // A pessoa toca na pílula (o rótulo); o botão de rádio fica escondido dentro dela.
  // Hoje ainda aparece na lista, mas já vem marcado o primeiro dia com horário livre:
  // a terça (domingo e segunda o salão fecha). Escolhe o primeiro horário dela.
  const dias = page.getByRole("radiogroup", { name: "Dia" })
  await expect(dias.getByRole("radio").first()).toHaveAccessibleName("sáb 14/11")
  await expect(dias.getByRole("radio", { name: "ter 17/11" })).toBeChecked()
  await expect(page.getByText(/Nenhum horário livre neste dia/)).toBeHidden()
  await page
    .getByRole("radiogroup", { name: "Horário" })
    .getByText("09:00", { exact: true })
    .click()
  await expect(page.getByText("terça-feira, 17/11, das 09:00 às 10:00")).toBeVisible()
  await verificarAcessibilidade(page)
  await acaoCheckout(page).click()

  await expect(page.getByRole("heading", { name: "Como você prefere pagar?" })).toBeVisible()
  await page.getByRole("radio", { name: /Cartão na maquininha/ }).click()
  await acaoCheckout(page).click()
  await expect(page.getByRole("heading", { name: "Confira e envie" })).toBeVisible()
  await expect(page.getByText("terça-feira, 17/11, às 09:00", { exact: true })).toBeVisible()
  await acaoCheckout(page).click()

  await expect(page).toHaveURL(/\/pedido$/, { timeout: 15_000 })
  await expect(page.getByText("Horário marcado")).toBeVisible()
  await expect(page.getByText("terça-feira, 17/11, às 09:00", { exact: true })).toBeVisible()
})

test("açougue: escolher o peso, ver o estimado e pagar depois da pesagem", async ({ page }) => {
  test.setTimeout(90_000)
  await abrirLoja(page, "Açougue Sabor da Carne")
  await esperarAnimacoes(page)

  const corte = page
    .getByTestId("produto-bisteca-suina")
    .getByRole("button", { name: "Escolher o peso de Bisteca Suína" })
  await corte.scrollIntoViewIfNeeded()
  await corte.click()
  const ficha = page.getByRole("dialog")
  await expect(ficha.getByText(/o quilo$/)).toBeVisible()
  await ficha.getByRole("radiogroup", { name: "Peso" }).getByText("1 kg", { exact: true }).click()
  await expect(
    ficha.getByText("O valor final sai na balança e pode variar um pouco."),
  ).toBeVisible()
  await verificarAcessibilidade(page)
  await ficha.getByTestId("cta-adicionar").click()
  await expect(ficha).toBeHidden()

  await page.goto("/finalizar")
  await preencherDados(page)
  await expect(page.getByRole("heading", { name: "Como você quer receber?" })).toBeVisible()
  await page.getByTestId("opcao-retirada").click()
  await acaoCheckout(page).click()
  await page.getByRole("radio", { name: /Pagar após a pesagem/ }).click()
  await expect(page.getByText(/mandamos pelo WhatsApp o valor exato/)).toBeVisible()
  await acaoCheckout(page).click()
  await expect(page.getByRole("heading", { name: "Confira e envie" })).toBeVisible()
  await acaoCheckout(page).click()
  await expect(page).toHaveURL(/\/pedido$/, { timeout: 15_000 })
  await expect(page.getByText("Pagar após a pesagem")).toBeVisible()
  await expect(page.getByText("1 kg").first()).toBeAttached()
})

test("quiosque: montar o pastel com adicionais e levar para a sacola", async ({ page }) => {
  await abrirLoja(page, "Quiosque do Mineiro")
  await esperarAnimacoes(page)
  const pastel = page
    .getByTestId("produto-pastel-mineiro")
    .getByRole("button", { name: "Escolher opções de Pastel Mineiro" })
  await pastel.scrollIntoViewIfNeeded()
  await pastel.click()

  const ficha = page.getByRole("dialog")
  const adicionais = ficha.getByRole("group", { name: /Adicionais no pastel/ })
  await expect(adicionais.getByText("Escolha até 4")).toBeVisible()
  const opcoes = adicionais.getByRole("checkbox")
  await opcoes.nth(0).click()
  await opcoes.nth(1).click()
  await expect(opcoes.nth(0)).toBeChecked()
  await expect(opcoes.nth(1)).toBeChecked()
  await verificarAcessibilidade(page)
  await ficha.getByTestId("cta-adicionar").click()
  await expect(ficha).toBeHidden()
  await expect(
    page.getByTestId("produto-pastel-mineiro").getByText("1", { exact: true }),
  ).toBeVisible()
})

test("adega: combo com energético e dois sabores de gelo", async ({ page }) => {
  await abrirLoja(page, "Adega da Vila")
  await esperarAnimacoes(page)
  const combo = page
    .getByTestId("produto-master-black-combo-2-gelo")
    .getByRole("button", { name: /^Escolher opções de / })
  await combo.scrollIntoViewIfNeeded()
  await combo.click()

  const ficha = page.getByRole("dialog")
  // 1º passo: o energético, uma escolha só; o botão Avançar leva ao próximo passo.
  await ficha.getByRole("radio").first().click()
  await ficha.getByTestId("cta-adicionar").click()
  const gelos = ficha.getByRole("group", { name: "Sabores do Gelo" })
  await expect(gelos.getByText(/Escolha até 2/)).toBeVisible()
  await gelos.getByRole("checkbox").nth(0).click()
  await gelos.getByRole("checkbox").nth(1).click()
  // No limite, o terceiro sabor fica desligado.
  await expect(gelos.getByRole("checkbox").nth(2)).toBeDisabled()
  await ficha.getByTestId("cta-adicionar").click()
  await expect(ficha).toBeHidden()
})

test("farmácia: oferta com embalagem comprida não alarga a página no celular", async ({ page }) => {
  await abrirLoja(page, "Drogaria Bem Estar")
  // A etiqueta do medidor junta a apresentação longa, o preço antigo e o novo.
  await page.getByTestId("produto-glicosimetro").scrollIntoViewIfNeeded()
  await verificarSemRolagemHorizontal(page)
})

test("folha com opções: tudo rola junto, a foto sai e os passos ficam presos no topo", async ({
  page,
}) => {
  await abrirLoja(page, "Quiosque do Mineiro")
  await esperarAnimacoes(page)
  const pastel = page
    .getByTestId("produto-pastel-escolha-o-sabor")
    .getByRole("button", { name: /^Escolher opções de / })
  await pastel.scrollIntoViewIfNeeded()
  await pastel.click()
  const ficha = page.getByTestId("painel-produto")
  await expect(ficha).toBeVisible()
  await page.waitForTimeout(600)

  const corpo = ficha.getByTestId("corpo-folha")
  await corpo.evaluate((elemento) => elemento.scrollTo({ top: 400, behavior: "instant" }))
  await page.waitForTimeout(200)

  const caixaFicha = await ficha.boundingBox()
  const passos = await ficha.getByRole("tablist", { name: "Passos do produto" }).boundingBox()
  const fechar = await ficha.getByRole("button", { name: "Fechar" }).boundingBox()
  if (!caixaFicha || !passos || !fechar) throw new Error("sem medida")
  // Os passos continuam à vista, presos perto do topo da folha.
  expect(passos.y).toBeGreaterThanOrEqual(caixaFicha.y)
  expect(passos.y).toBeLessThan(caixaFicha.y + 120)
  // E nada fica por cima deles: as setas e o fechar moram na barra de cima.
  expect(fechar.y + fechar.height, "o fechar termina antes dos passos").toBeLessThanOrEqual(
    passos.y,
  )
  // O nome grande saiu de cena; o nome pequeno aparece na barra de cima.
  await expect(ficha.getByTestId("nome-na-barra")).toHaveText("Pastel (Escolha o Sabor)")
  await expect(ficha.getByTestId("nome-na-barra")).toHaveCSS("opacity", "1")
  await expect(
    ficha.getByRole("heading", { name: "Pastel (Escolha o Sabor)", exact: true }),
  ).not.toBeInViewport()
})
