import { expect, type Page, test } from "@playwright/test"
import { esperarAnimacoes, verificarAcessibilidade } from "./apoio"

/** Cada teste começa com as configurações de fábrica. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("admin-limpo")) {
      localStorage.removeItem("clickpedido-admin")
      sessionStorage.setItem("admin-limpo", "1")
    }
  })
})

async function abrirSecao(page: Page, secao: string) {
  await page.goto(`/admin/configuracoes/${secao}`)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  // Os campos só aparecem depois de ler o que estava salvo.
  await expect(page.getByRole("group").first()).toBeVisible()
}

/** A prévia fica ao lado em telas largas; nas outras, abre pelo botão "Prévia". */
async function previa(page: Page) {
  const botao = page.getByRole("button", { name: "Prévia", exact: true })
  if (await botao.isVisible()) await botao.click()
  const regiao = page.getByRole("region", { name: "Prévia da loja" })
  await expect(regiao).toBeVisible()
  return regiao
}

test("o painel tem a barra lateral e o centro vazio", async ({ page }, info) => {
  test.skip(
    (info.project.use.viewport?.width ?? 0) < 768,
    "No celular a barra lateral fica recolhida",
  )
  await page.goto("/admin")
  const lateral = page.locator("[data-slot=sidebar]").first()
  await expect(lateral.getByRole("link", { name: "Início", exact: true })).toBeVisible()
  await expect(page.getByText("Em breve").first()).toBeVisible()
  await lateral.getByRole("link", { name: "Visão geral" }).click()
  await expect(page).toHaveURL(/\/admin\/configuracoes$/)
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible()
})

function salvo(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("clickpedido-admin") ?? "{}").state)
}

test("opção Pro vai para a sacola, aparece na prévia e é contratada ao aplicar", async ({
  page,
}) => {
  await abrirSecao(page, "cards")
  const mosaico = page.locator("#escolha-cards-variante-mosaico")

  // Sem o Pro, escolher não é recusado: vale na prévia e entra na sacola do painel.
  // A barra de ações fica presa embaixo: o cartão vai para o meio da tela antes do toque.
  await mosaico.evaluate((radio) => radio.scrollIntoView({ block: "center", behavior: "instant" }))
  await mosaico.click({ force: true })
  await expect(mosaico).toBeChecked()
  await expect(page.getByText("Mosaico foi para a sacola")).toBeVisible()
  await expect(page.getByText("Na sacola").first()).toBeVisible()
  await expect(page.getByTestId("botao-sacola-admin")).toContainText("1 na sacola")

  // Aplicar no site com Pro na sacola abre a sacola para contratar.
  await page.getByTestId("aplicar-no-site").click()
  const sacola = page.getByTestId("sacola-admin")
  await expect(sacola.getByText("Falta contratar para aplicar no site")).toBeVisible()
  await expect(sacola.getByText("Card Mosaico")).toBeVisible()
  await sacola.getByTestId("contratar").click()
  await expect(sacola.getByText("Tudo certo!")).toBeVisible()

  const estado = await salvo(page)
  expect(estado.compradas).toContain("cards.variante:mosaico")
  expect(estado.publicada.cards.variante).toBe("mosaico")
})

test("aplicar sem Pro na sacola publica direto, e dá para voltar ao original", async ({ page }) => {
  await abrirSecao(page, "identidade")
  await page.getByLabel("Nome da loja").fill("Bella Napoli")
  await page.getByTestId("aplicar-no-site").click()
  await expect(page.getByText("Configurações aplicadas no site")).toBeVisible()
  expect((await salvo(page)).publicada.identidade.nome).toBe("Bella Napoli")

  await page.getByRole("button", { name: /Voltar ao original|Original/ }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Voltar ao original" }).click()
  await expect(page.getByLabel("Nome da loja")).toHaveValue("Casa da Pizza")
  expect((await salvo(page)).publicada.identidade.nome).toBe("Casa da Pizza")
})

test("liberar todos desbloqueia tudo e as opções brilham", async ({ page }, info) => {
  test.skip(
    (info.project.use.viewport?.width ?? 0) < 768,
    "No celular a barra lateral fica recolhida",
  )
  await abrirSecao(page, "cards")
  await page.getByTestId("liberar-todos").click()
  await expect(page.locator("[data-pro-liberada]").first()).toBeVisible()
  await expect(page.getByText("Na sacola")).toHaveCount(0)
  expect((await salvo(page)).pro).toBe(true)
})

test("grupos da barra lateral abrem e fecham com animação", async ({ page }, info) => {
  test.skip(
    (info.project.use.viewport?.width ?? 0) < 768,
    "No celular a barra lateral fica recolhida",
  )
  await abrirSecao(page, "cards")
  const telas = page.locator("[data-sidebar=menu-button]", { hasText: /^Telas$/ })
  await expect(telas).toHaveAttribute("aria-expanded", "true")

  // Mede a altura do conteúdo enquanto fecha: precisa passar por valores intermediários.
  const alturas = await telas.evaluate(async (botao) => {
    const item = botao.closest("li") as HTMLElement
    const conteudo = () => item.querySelector(":scope > div.overflow-hidden")
    const cheia = conteudo()?.getBoundingClientRect().height ?? 0
    ;(botao as HTMLElement).click()
    const medidas: number[] = []
    for (let quadro = 0; quadro < 30; quadro += 1) {
      await new Promise((pronto) => requestAnimationFrame(pronto))
      medidas.push(conteudo()?.getBoundingClientRect().height ?? 0)
    }
    return { cheia, medidas }
  })
  expect(alturas.cheia).toBeGreaterThan(100)
  expect(alturas.medidas.some((altura) => altura > 1 && altura < alturas.cheia - 1)).toBe(true)
  await expect(telas).toHaveAttribute("aria-expanded", "false")

  // E o grupo "Painel" também fecha.
  const painel = page.locator("[data-sidebar=group-label]", { hasText: "Painel" })
  await painel.click()
  await expect(painel).toHaveAttribute("aria-expanded", "false")
  const idPainel = await painel.getAttribute("aria-controls")
  await expect
    .poll(() =>
      page.locator(`[id="${idPainel}"]`).evaluate((el) => el.getBoundingClientRect().height),
    )
    .toBe(0)
})

test("reordena a página pelo teclado e a prévia acompanha", async ({ page }) => {
  await abrirSecao(page, "inicio")
  // Bebidas começa abaixo da dobra: a alça precisa ser medida depois de entrar na tela.
  const posicaoDeBebidas = () =>
    page.evaluate(() => {
      const salvo = JSON.parse(localStorage.getItem("clickpedido-admin") ?? "{}")
      const blocos = (salvo.state?.config?.inicio?.blocos ?? []) as { id: string }[]
      return blocos.findIndex((bloco) => bloco.id === "categoria:bebidas")
    })
  // A ordem das alças na tela é a ordem dos blocos.
  const nomesDasAlcas = await page
    .getByTestId("wireframe")
    .getByRole("button", { name: /^Mover / })
    .evaluateAll((alcas) => alcas.map((alca) => alca.getAttribute("aria-label") ?? ""))
  const inicial = nomesDasAlcas.findIndex((nome) => nome.startsWith("Mover Bebidas"))
  expect(inicial, "Bebidas está na lista").toBeGreaterThanOrEqual(5)
  const alca = page.getByRole("button", { name: /^Mover Bebidas/ })
  await alca.focus()
  await page.keyboard.press("Space")
  // As setas só valem depois que o arraste começa (o anúncio para leitor de tela confirma).
  await expect(page.locator("[id^=DndLiveRegion]")).toHaveText(/Bebidas/)
  for (let passo = 0; passo < 5; passo += 1) {
    await page.keyboard.press("ArrowUp")
    await page.waitForTimeout(120)
  }
  await page.keyboard.press("Space")

  // Cinco toques na seta para cima sobem exatamente cinco posições.
  await expect.poll(posicaoDeBebidas).toBe(inicial - 5)

  const regiao = await previa(page)
  const categorias = regiao.getByRole("navigation", { name: "Categorias" }).getByRole("listitem")
  const nomes = await categorias.allTextContents()
  // A barra de categorias da prévia segue a mesma ordem que ficou salva.
  const ordemSalva = (await salvo(page)).config.inicio.blocos
    .filter(
      (bloco: { id: string; ativo: boolean }) => bloco.id.startsWith("categoria:") && bloco.ativo,
    )
    .map((bloco: { id: string }) => bloco.id)
  // Bebidas era a última categoria e passou por cima de cinco.
  expect(ordemSalva.indexOf("categoria:bebidas")).toBe(ordemSalva.length - 6)
  expect(nomes).toHaveLength(ordemSalva.length)
  expect(nomes.indexOf("Bebidas")).toBe(ordemSalva.indexOf("categoria:bebidas"))
})

test("nome da loja muda na prévia na hora", async ({ page }) => {
  await abrirSecao(page, "identidade")
  await page.getByLabel("Nome da loja").fill("Bella Napoli")
  const regiao = await previa(page)
  await expect(regiao.getByRole("heading", { name: "Bella Napoli" })).toBeVisible()
})

test("configurações cabem na tela, sem rolagem lateral, e são acessíveis", async ({ page }) => {
  for (const secao of ["cards", "inicio", "cores"]) {
    await abrirSecao(page, secao)
    await esperarAnimacoes(page)
    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(sobra, `rolagem lateral em ${secao}`).toBeLessThanOrEqual(0)
  }
  await abrirSecao(page, "cards")
  await verificarAcessibilidade(page)
})

test("não mostra erro no console do painel", async ({ page }) => {
  const erros: string[] = []
  page.on("console", (mensagem) => {
    if (mensagem.type() === "error") erros.push(mensagem.text())
  })
  page.on("pageerror", (erro) => erros.push(String(erro)))

  for (const secao of [
    "identidade",
    "produto",
    "sacola",
    "finalizar",
    "acompanhamento",
    "conversa",
  ]) {
    await abrirSecao(page, secao)
  }
  await page.waitForTimeout(400)
  // O aviso do next-themes sobre o <script> de tema é do React 19 e aparece em todo o site.
  expect(erros.filter((erro) => !erro.includes("Encountered a script tag"))).toEqual([])
})
