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
    localStorage.removeItem("clickpedido-admin-metas")
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

  for (const aba of ["vendas", "financeiro"] as const) {
    test(`painel: visão geral, aba ${aba} (${tema})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
      await page.goto(`/admin?aba=${aba}`)
      const bloco = aba === "vendas" ? "Canais de venda" : "Formas de pagamento"
      await expect(page.getByRole("region", { name: bloco })).toBeVisible({ timeout: 15_000 })
      await page.waitForLoadState("networkidle")
      await esperarAnimacoes(page)
      await expect(page).toHaveScreenshot(`painel-visao-geral-${aba}-${tema}.png`, {
        fullPage: true,
      })
    })
  }

  test(`painel: visão geral, abas com a página rolada (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin?aba=vendas")
    const mapa = page.getByRole("region", { name: "Quando a loja vende" })
    await expect(mapa).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await mapa.scrollIntoViewIfNeeded()
    await esperarAnimacoes(page)
    // Só a tela visível: no celular, a barra de abas fica presa embaixo do cabeçalho.
    await expect(page).toHaveScreenshot(`painel-visao-geral-abas-rolada-${tema}.png`)
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
    await page.goto("/admin/fila")
    await expect(page.locator("article").first()).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-fila-${tema}.png`, { fullPage: true })
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

  test(`painel: aba Conta e Receber da mesa (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    // A mesa 2 da demonstração já pagou metade da conta em Pix.
    await page.goto("/admin/mesas?mesa=2")
    const gaveta = page.getByRole("dialog", { name: /^Mesa 2\b/ })
    await gaveta.getByRole("tab", { name: "Conta" }).click({ timeout: 15_000 })
    await expect(gaveta.getByRole("list", { name: "Pagamentos" })).toBeVisible()
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-comanda-conta-${tema}.png`)

    await gaveta.getByRole("button", { name: "Fechar conta" }).click()
    const receber = page.getByRole("dialog", { name: "Receber da mesa 2" })
    await receber.getByText("Dinheiro").click()
    await receber.getByRole("group", { name: "Notas" }).getByRole("button").first().click()
    await expect(receber.getByText(/^Troco: /)).toBeVisible()
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-receber-conta-${tema}.png`)
  })

  test(`painel: abrir a mesa livre (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas?mesa=11")
    const gaveta = page.getByRole("dialog", { name: "Mesa 11" })
    await expect(gaveta.getByRole("button", { name: "Abrir mesa" })).toBeVisible({
      timeout: 15_000,
    })
    await page.waitForLoadState("networkidle")
    // 3 pessoas na mesa de 2 lugares: o aviso aparece, sem impedir.
    await gaveta.getByRole("spinbutton", { name: "Pessoas" }).fill("3")
    await expect(gaveta.getByText("A mesa 11 tem 2 lugares.")).toBeVisible()
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-abrir-mesa-${tema}.png`)
  })

  test(`painel: adicionar itens na comanda (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas")
    const ocupada = page.getByRole("button", { name: /^Mesa \d+$/ }).filter({ hasText: "Ocupada" })
    await expect(ocupada.first()).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await ocupada.first().click()
    await page.getByRole("button", { name: "Adicionar itens" }).click()
    const janela = page.getByRole("dialog", { name: /^Adicionar itens · Mesa \d+$/ })
    await expect(janela.getByRole("button", { name: /^Adicionar / }).first()).toBeVisible()
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-adicionar-itens-${tema}.png`)
  })

  test(`painel: transferir e juntar a mesa pela gaveta (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas?mesa=1")
    const gaveta = page.getByRole("dialog", { name: "Mesa 1" })
    await gaveta.getByRole("button", { name: "Transferir mesa" }).click({ timeout: 15_000 })
    const transferir = page.getByRole("dialog", { name: "Transferir a mesa 1" })
    await transferir.getByRole("combobox", { name: "Para a mesa" }).click()
    await page.getByRole("option", { name: "Mesa 8" }).click()
    await expect(transferir.getByRole("combobox", { name: "Para a mesa" })).toHaveText("Mesa 8")
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-transferir-mesa-${tema}.png`)

    await page.keyboard.press("Escape")
    await expect(transferir).toBeHidden()
    await gaveta.getByRole("button", { name: "Juntar mesas" }).click()
    const juntar = page.getByRole("dialog", { name: "Juntar à mesa 1" })
    await juntar.getByRole("checkbox", { name: /^Mesa 8\b/ }).click()
    await expect(juntar.getByRole("checkbox", { name: /^Mesa 8\b/ })).toBeChecked()
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-juntar-mesas-${tema}.png`)
  })
  test(`painel: mapa do salão e a edição do mapa (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas?vista=mapa")
    const salao = page.getByRole("list", { name: "Mapa: Salão" })
    await expect(salao.getByRole("button", { name: "Mesa 1", exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-mapa-${tema}.png`, { fullPage: true })

    // No celular o mapa só é visto: não há edição para fotografar.
    const editar = page.getByRole("button", { name: "Editar mapa" })
    if (!(await editar.isVisible())) return
    await editar.click()
    // A mesa 1 vai para cima da 5: a foto mostra também a mesa marcada como erro.
    await salao.getByRole("button", { name: "Mesa 1", exact: true }).focus()
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("Shift+ArrowDown")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-mapa-edicao-${tema}.png`, { fullPage: true })
  })

  test(`painel: transferir itens da comanda (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas?mesa=1")
    const gaveta = page.getByRole("dialog", { name: "Mesa 1" })
    await gaveta.getByRole("button", { name: "Transferir itens" }).click({ timeout: 15_000 })
    const janela = page.getByRole("dialog", { name: "Transferir itens da mesa 1" })
    await janela.getByRole("spinbutton").and(page.locator(":enabled")).first().fill("1")
    await janela.getByRole("combobox", { name: "Para a mesa" }).click()
    await page.getByRole("option", { name: "Mesa 8" }).click()
    await expect(janela.getByRole("combobox", { name: "Para a mesa" })).toHaveText("Mesa 8")
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-transferir-itens-${tema}.png`)
  })

  test(`painel: folha de atalhos das mesas (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas")
    await expect(page.getByRole("list", { name: "Salão" })).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: "Atalhos do teclado" }).click()
    await expect(page.getByRole("switch", { name: "Atalhos de uma tecla" })).toBeVisible()
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-atalhos-mesas-${tema}.png`)
  })

  test(`painel: janela Nova mesa (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas")
    await expect(page.getByRole("list", { name: "Salão" })).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: "Nova mesa" }).click()
    const janela = page.getByRole("dialog", { name: "Nova mesa" })
    await janela.getByRole("spinbutton", { name: "Número" }).fill("21")
    // Área, lugares e forma vêm preenchidos: Salão, 4 e Quadrada.
    await expect(janela.getByRole("combobox", { name: "Área" })).toHaveText("Salão")
    await expect(janela.getByRole("spinbutton", { name: "Lugares" })).toHaveValue("4")
    await expect(janela.getByRole("combobox", { name: "Forma" })).toHaveText("Quadrada")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-nova-mesa-${tema}.png`)
  })

  test(`painel: Configurar salão (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas")
    await expect(page.getByRole("list", { name: "Salão" })).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: "Configurar salão" }).click()
    const painel = page.getByRole("dialog", { name: "Configurar salão" })
    await expect(painel.getByRole("textbox", { name: "Nome da área" }).first()).toBeVisible()
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-configurar-salao-${tema}.png`)
  })

  test(`painel: janela Nova reserva (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas")
    const reservas = page.getByRole("region", { name: "Reservas e espera" })
    await reservas.getByRole("button", { name: "Nova reserva" }).click({ timeout: 15_000 })
    const janela = page.getByRole("dialog", { name: "Nova reserva" })
    await janela.getByRole("textbox", { name: "Nome" }).fill("Ana Lima")
    await janela.getByLabel("Horário").fill("21:00")
    await janela.getByRole("spinbutton", { name: "Pessoas" }).fill("4")
    // 4 pessoas às 21:00: a sugestão da mesa 8 aparece com o botão para usar.
    await expect(janela.getByRole("button", { name: "Usar a mesa 8" })).toBeVisible()
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-nova-reserva-${tema}.png`)
  })

  test(`painel: Sentar a reserva (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas")
    const reservas = page.getByRole("region", { name: "Reservas e espera" })
    await reservas.getByRole("button", { name: "Sentar Marina Costa" }).click({ timeout: 15_000 })
    const janela = page.getByRole("dialog", { name: "Sentar Marina Costa" })
    await expect(janela.getByRole("combobox", { name: "Mesa" })).toHaveText(/^Mesa 13/)
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-sentar-${tema}.png`)
  })

  test(`painel: aba Espera e Entrar na espera (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas")
    const reservas = page.getByRole("region", { name: "Reservas e espera" })
    await reservas.getByRole("tab", { name: /^Espera/ }).click({ timeout: 15_000 })
    const fila = reservas.getByRole("list", { name: "Lista de espera" })
    await expect(fila.getByRole("listitem")).toHaveCount(3)
    await expect(fila.getByText("Mesa 11 livre")).toBeVisible()
    // Sem o anel de foco do clique na aba: a foto é da lista, não do teclado.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(reservas).toHaveScreenshot(`painel-espera-${tema}.png`)

    await reservas.getByRole("button", { name: "Entrar na espera" }).click()
    const janela = page.getByRole("dialog", { name: "Entrar na espera" })
    await janela.getByRole("textbox", { name: "Nome" }).fill("Ana Lima")
    await janela.getByRole("spinbutton", { name: "Pessoas" }).fill("3")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-entrar-na-espera-${tema}.png`)
  })

  test(`painel: reservas com o cadeado Pro (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas")
    await expect(page.getByRole("list", { name: "Salão" })).toBeVisible({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    // Desliga a função em Configurar salão: as reservas marcadas antes continuam no bloco.
    await page.getByRole("button", { name: "Configurar salão" }).click()
    const salao = page.getByRole("dialog", { name: "Configurar salão" })
    await salao.getByRole("switch", { name: /^Reservas e lista de espera/ }).click()
    await salao.getByRole("button", { name: "Salvar" }).click()
    await expect(salao).toBeHidden()
    const reservas = page.getByRole("region", { name: "Reservas e espera" })
    await expect(reservas.getByRole("button", { name: "Abrir Configurar salão" })).toBeVisible()
    await expect(
      reservas.getByRole("list", { name: "Reservas ativas" }).getByRole("listitem"),
    ).toHaveCount(2)
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(reservas).toHaveScreenshot(`painel-reservas-pro-${tema}.png`)
  })

  test(`painel: folha de QR (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas")
    await page.getByRole("button", { name: "Chamados 1 esperando" }).click({ timeout: 15_000 })
    await page.getByRole("button", { name: "Folha de QR" }).click()
    const folha = page.getByRole("dialog", { name: "Folha de QR" })
    await expect(folha.getByRole("figure")).toHaveCount(19)
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    // O QR e a URL levam a porta do servidor: ficam escondidos na foto (a máscara passaria por
    // cima do rodapé da janela, e o estilo da foto não soma com o `stylePath` da configuração).
    await page.addStyleTag({
      content: '[aria-label^="QR da mesa"], figcaption > span:last-child { visibility: hidden }',
    })
    await expect(folha).toHaveScreenshot(`painel-folha-qr-${tema}.png`)
  })

  test(`painel: lista de chamados (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/admin/mesas")
    await page.getByRole("button", { name: "Chamados 1 esperando" }).click({ timeout: 15_000 })
    const lista = page.getByRole("dialog", { name: "Chamados" })
    await expect(lista.getByRole("listitem", { name: "Mesa 1" })).toBeVisible()
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`painel-chamados-${tema}.png`)
  })

  test(`vitrine da mesa pelo QR (${tema})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
    await page.goto("/mesa?loja=pizzaria&mesa=mesa-11")
    await expect(page.getByRole("heading", { level: 1, name: "Mesa 11" })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole("button", { name: "Adicionar Água sem gás" }).click()
    await expect(
      page.getByRole("region", { name: "Seu pedido" }).getByText("Água sem gás", { exact: true }),
    ).toBeVisible()
    await page.waitForLoadState("networkidle")
    await esperarAnimacoes(page)
    await expect(page).toHaveScreenshot(`vitrine-mesa-${tema}.png`)
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
