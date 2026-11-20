import { expect, test } from "@playwright/test"
import { esperarAnimacoes } from "./apoio"

/** Sexta, 13/11/2026, 20:30: os pedidos de demonstração saem sempre iguais. */
const AGORA = new Date("2026-11-13T20:30:00-03:00")

test.use({ timezoneId: "America/Sao_Paulo" })

/** Cada teste começa com o painel de fábrica. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AGORA)
  await page.addInitScript(() => {
    localStorage.removeItem("clickpedido-admin")
    localStorage.removeItem("clickpedido-admin-segmento")
  })
})

for (const tema of ["light", "dark"] as const) {
  test(`painel farmácia: receitas (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.addInitScript(() =>
      localStorage.setItem(
        "clickpedido-admin-segmento",
        JSON.stringify({ state: { segmento: "farmacia" }, version: 1 }),
      ),
    )
    await page.goto("/admin/receitas")
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-farmacia-receitas-${tema}.png`, { fullPage: true })
  })

  test(`painel farmácia: lotes e validade (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.addInitScript(() =>
      localStorage.setItem(
        "clickpedido-admin-segmento",
        JSON.stringify({ state: { segmento: "farmacia" }, version: 1 }),
      ),
    )
    await page.goto("/admin/validade")
    await expect(page.getByRole("table", { name: "Lotes" })).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-farmacia-validade-${tema}.png`, { fullPage: true })
  })

  test(`painel: visão geral (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin")
    await expect(page.getByRole("region", { name: "Hoje" })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible()
    // A foto esconde o cursor dos campos com um estilo; antes da hidratação, o React o vê como diferença.
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-visao-geral-${tema}.png`, { fullPage: true })
  })

  test(`painel: pedidos (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/pedidos")
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-pedidos-${tema}.png`, { fullPage: true })
  })

  test(`painel: fila (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    // Sem os alertas secundários: o aviso deles vem e vai com o tempo e mexeria na imagem.
    await page.addInitScript(() =>
      localStorage.setItem(
        "clickpedido-admin-fila",
        JSON.stringify({
          state: {
            alertas: { parado: false, atraso: false, pago: false, cancelou: false, cozinha: false },
          },
          version: 1,
        }),
      ),
    )
    await page.goto("/admin/fila")
    await expect(page.locator("article").first()).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-fila-${tema}.png`, { fullPage: true })
  })

  test(`painel: painel de chamada da TV (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/chamada")
    await expect(
      page.getByRole("region", { name: "Pronto, pode retirar" }).getByRole("listitem").first(),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-chamada-${tema}.png`, { fullPage: true })
  })

  test(`painel: PDV (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/pdv")
    await expect(page.getByRole("button", { name: /^Adicionar / }).first()).toBeVisible({
      timeout: 15_000,
    })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-pdv-${tema}.png`)
  })

  test(`painel: PDV com itens na caixa (${tema})`, async ({ page }, info) => {
    test.skip((info.project.use.viewport?.width ?? 0) < 1024, "No celular a caixa abre pela barra")
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/pdv")
    // Um produto sem opções (preço do cardápio, só leitura) e um avulso (preço digitado).
    await page
      .getByRole("button", { name: /^Adicionar .*\d$/ })
      .first()
      .click({ timeout: 15_000 })
    await page.getByRole("button", { name: "Lançar item avulso" }).click()
    await page.getByLabel("Item avulso", { exact: true }).fill("Água")
    await page.getByLabel("Valor", { exact: true }).fill("5")
    await page.getByRole("button", { name: "Incluir item avulso" }).click()
    const venda = page.getByRole("region", { name: "Venda", exact: true })
    await expect(venda.getByRole("listitem", { name: "Água" })).toBeVisible()
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(venda).toHaveScreenshot(`painel-pdv-caixa-${tema}.png`)
  })

  test(`painel: cozinha (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/cozinha")
    await expect(page.locator("article").first()).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-cozinha-${tema}.png`, { fullPage: true })
  })

  test(`painel: mesas e comanda (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas")
    const ocupada = page.getByRole("button", { name: /^Mesa \d+$/ }).filter({ hasText: "Ocupada" })
    await expect(ocupada.first()).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-mesas-${tema}.png`, { fullPage: true })

    await ocupada.first().click()
    await expect(page.getByRole("list", { name: "Itens da comanda" })).toBeVisible()
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-comanda-${tema}.png`)
  })

  test(`painel: garçom (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/garcom")
    await expect(page.getByRole("button", { name: /^Adicionar / }).first()).toBeVisible({
      timeout: 15_000,
    })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-garcom-${tema}.png`)
  })

  test(`painel: agendamentos do salão (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.addInitScript(() => {
      localStorage.setItem(
        "clickpedido-admin-segmento",
        JSON.stringify({ state: { segmento: "salao" }, version: 1 }),
      )
    })
    // Terça, o dia mais cheio da demonstração.
    await page.goto("/admin/agendamentos?dia=2026-11-17")
    const dia = page.getByRole("region", { name: "Agenda do dia" })
    await expect(dia.getByRole("button").filter({ hasText: " · " }).first()).toBeVisible({
      timeout: 15_000,
    })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-agenda-${tema}.png`, { fullPage: true })

    await page.getByRole("button", { name: "Novo agendamento" }).click()
    const janela = page.getByRole("dialog", { name: "Novo agendamento" })
    await janela.getByRole("checkbox").first().click()
    // Sábado, 14, ainda tem horários livres.
    await janela.getByRole("button", { name: /^sábado, 14 de novembro/ }).click()
    await expect(janela.getByRole("radiogroup", { name: "Horário" })).toBeVisible()
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-novo-agendamento-${tema}.png`)
  })

  test(`painel: motoboys, bairros e configurações (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/motoboys")
    await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-motoboys-${tema}.png`, { fullPage: true })

    await page.goto("/admin/bairros")
    await expect(page.getByRole("table", { name: "Bairros" })).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-bairros-${tema}.png`, { fullPage: true })

    await page.goto("/admin/loja")
    await expect(page.getByRole("textbox", { name: "Nome da loja" })).toBeVisible({
      timeout: 15_000,
    })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-loja-${tema}.png`, { fullPage: true })
  })

  test(`painel: estoque e contagem (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/estoque")
    await expect(page.getByRole("table", { name: "Estoque" })).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-estoque-${tema}.png`, { fullPage: true })

    const primeira = page.getByRole("table", { name: "Estoque" }).getByRole("row").nth(1)
    // A régua fica acima da tabela: em tela baixa, a linha chega rolando a página para baixo.
    await primeira.scrollIntoViewIfNeeded()
    // No celular, a situação e as ações cabem na linha, sem rolagem lateral.
    await expect(primeira.getByText("Zerado").filter({ visible: true })).toBeInViewport()
    await expect(primeira.getByRole("button", { name: /^Ações de / })).toBeInViewport()
    await primeira.getByRole("button", { name: /^Ações de / }).click()
    await page.getByRole("menuitem", { name: "Contagem" }).click()
    const janela = page.getByRole("dialog", { name: /^Contagem de / })
    await janela.getByLabel("Quantidade contada").fill("12")
    await esperarAnimacoes(page)
    await expect(janela).toHaveScreenshot(`painel-estoque-contagem-${tema}.png`)
  })

  test(`painel: pesagem do açougue (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.addInitScript(() => {
      localStorage.setItem(
        "clickpedido-admin-segmento",
        JSON.stringify({ state: { segmento: "acougue" }, version: 1 }),
      )
    })
    await page.goto("/admin/pedidos?pagamento=pagar-apos-pesagem&status=recebido,em-preparo,pronto")
    await page.getByRole("table").getByRole("row").nth(1).click({ timeout: 15_000 })
    const pesagem = page.getByRole("region", { name: "Pesagem" })
    await expect(pesagem.getByRole("textbox").first()).toBeVisible()
    await pesagem.getByRole("textbox").first().fill("620")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-pesagem-${tema}.png`)
  })

  test(`painel: combo da adega no formulário (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.addInitScript(() => {
      localStorage.setItem(
        "clickpedido-admin-segmento",
        JSON.stringify({ state: { segmento: "adega" }, version: 1 }),
      )
    })
    await page.goto("/admin/cardapio?produto=prod-master-black-combo-2-gelo")
    const formulario = page.getByRole("dialog")
    await expect(formulario.getByText("Ligada a GELO DE COCO")).toBeVisible({ timeout: 15_000 })
    await formulario.getByText("Ligada a GELO DE COCO").scrollIntoViewIfNeeded()
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-combo-adega-${tema}.png`)
  })

  test(`painel: cardápio e formulário (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/cardapio?categoria=cat-tradicionais")
    await expect(
      page
        .getByRole("listitem")
        .filter({ has: page.getByRole("button", { name: "Editar" }) })
        .first(),
    ).toBeVisible({
      timeout: 15_000,
    })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-cardapio-${tema}.png`, { fullPage: true })

    await page.getByRole("button", { name: "Editar" }).first().click()
    const formulario = page.getByRole("dialog")
    await expect(formulario.getByRole("button", { name: "Salvar produto" })).toBeVisible()
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-produto-${tema}.png`)
  })

  test(`painel: editor de aparência (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/configuracoes")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("link", { name: /Identidade/ }).first()).toBeVisible()
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-configuracoes-${tema}.png`, { fullPage: true })

    await page.goto("/admin/configuracoes/identidade")
    await expect(page.getByRole("textbox", { name: "Nome da loja" })).toBeVisible({
      timeout: 15_000,
    })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-configuracoes-identidade-${tema}.png`)
  })

  test(`painel: busca de configurações na barra lateral (${tema})`, async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 768, "no celular a barra lateral fica num painel à parte")
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/configuracoes")
    const busca = page.getByRole("textbox", { name: "Buscar configuração" })
    await expect(busca).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await busca.focus()
    const grupo = page.locator('[data-sidebar="group"]').filter({ has: busca })
    await expect(grupo).toHaveScreenshot(`painel-busca-configuracoes-${tema}.png`)
  })
}
