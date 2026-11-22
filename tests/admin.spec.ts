import { expect, type Page, test } from "@playwright/test"
import { esperarAnimacoes, verificarAcessibilidade } from "./apoio"

/** Cada teste começa com as configurações de fábrica. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("admin-limpo")) {
      localStorage.removeItem("clickpedido-admin")
      localStorage.removeItem("clickpedido-admin-segmento")
      localStorage.removeItem("clickpedido-admin-farmacia")
      localStorage.removeItem("clickpedido-admin-metas")
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

test("o seletor do topo troca o segmento e o menu acompanha", async ({ page }, info) => {
  test.skip(
    (info.project.use.viewport?.width ?? 0) < 768,
    "No celular a barra lateral fica recolhida",
  )
  await page.goto("/admin")
  const lateral = page.locator("[data-slot=sidebar]").first()
  await expect(page.getByRole("heading", { level: 1, name: "Visão geral" })).toBeVisible()
  await expect(lateral.getByRole("link", { name: "Mesas", exact: true })).toBeVisible()
  await expect(lateral.getByRole("link", { name: "Agendamentos" })).toHaveCount(0)

  await page.getByRole("button", { name: /segmento: pizzaria/i }).click()
  await page.getByRole("menuitemradio", { name: /salão de beleza/i }).click()
  await expect(lateral.getByRole("link", { name: "Agendamentos" })).toBeVisible()
  await expect(lateral.getByRole("link", { name: "Mesas", exact: true })).toHaveCount(0)

  // A escolha fica salva neste navegador.
  await page.reload()
  await expect(page.getByRole("button", { name: /segmento: salão de beleza/i })).toBeVisible()

  // Um módulo que não é do segmento avisa e leva de volta.
  await page.goto("/admin/mesas")
  await expect(page.getByText("Mesas não faz parte de Salão de beleza")).toBeVisible()
  await page.getByRole("link", { name: "Ir para a visão geral" }).click()
  await expect(page).toHaveURL(/\/admin$/)

  // O editor da aparência continua no menu, dentro de "Personalizar loja" (fechado fora das configurações).
  await lateral.getByRole("button", { name: "Personalizar loja" }).click()
  await lateral.getByRole("link", { name: "Todas as opções" }).click()
  await expect(page).toHaveURL(/\/admin\/configuracoes$/)
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible()
})

test("a visão geral troca o período pelo atalho e alterna o gráfico", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin")
  const hoje = page.getByRole("region", { name: "Hoje" })
  await expect(hoje).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("radio", { name: "7 dias" })).toBeChecked()

  await page.getByRole("radio", { name: "Este mês" }).click()
  await expect(page).toHaveURL(/de=2026-11-01&ate=2026-11-13/)
  await expect(page.getByRole("button", { name: /01\/11 a 13\/11 · 13 dias/ })).toBeVisible()

  await page.getByRole("radio", { name: "Qtd." }).click()
  await expect(page.getByRole("region", { name: "Pedidos por dia" })).toBeVisible()
  await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible()
  await verificarAcessibilidade(page)
})

test("visão geral: as abas ficam no endereço, a meta se define e o alerta leva ao estoque", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin")
  await expect(page.getByRole("region", { name: "Hoje" })).toBeVisible({ timeout: 15_000 })
  const abas = page.getByRole("tablist", { name: "Abas da visão geral" })

  await abas.getByRole("tab", { name: "Vendas" }).click()
  await expect(page).toHaveURL(/aba=vendas/)
  await expect(page.getByRole("region", { name: "Canais de venda" })).toBeVisible()
  await abas.getByRole("tab", { name: "Financeiro" }).click()
  await expect(page).toHaveURL(/aba=financeiro/)
  await expect(page.getByRole("region", { name: "Formas de pagamento" })).toBeVisible()
  await abas.getByRole("tab", { name: "Resumo" }).click()
  await expect(page).not.toHaveURL(/aba=/)

  const meta = page.getByRole("region", { name: "Meta do mês" })
  await meta.getByRole("button", { name: "Definir meta" }).click()
  await meta.getByRole("textbox", { name: "Faturamento do mês" }).fill("60000")
  await meta.getByRole("button", { name: "Salvar meta" }).click()
  await expect(meta.getByText("Vendido no mês")).toBeVisible()
  await verificarAcessibilidade(page)

  const faixa = page.getByRole("region", { name: "Precisa de atenção" })
  await faixa.getByRole("link", { name: "Ver estoque" }).first().click()
  await expect(page).toHaveURL(/\/admin\/estoque$/)
})

test("aba Vendas: da origem aos pedidos filtrados, com a etiqueta para tirar o filtro", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin?aba=vendas")
  await expect(page.getByRole("region", { name: "Quando a loja vende" })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole("table", { name: "Pedidos por dia da semana e hora" })).toBeVisible()
  await expect(page.locator(".barras-atual .recharts-bar-rectangle").first()).toBeVisible()
  await verificarAcessibilidade(page)

  await page
    .getByRole("region", { name: "Origem dos pedidos" })
    .getByRole("link", { name: "Site" })
    .click()
  await expect(page).toHaveURL(/\/admin\/pedidos\?origem=site&de=2026-11-07&ate=2026-11-13/)
  await expect(page.getByRole("button", { name: /07\/11 a 13\/11 · 7 dias/ })).toBeVisible()
  await expect(page.getByRole("table")).toBeVisible()
  await page.getByRole("button", { name: "Tirar o filtro Origem: Site" }).click()
  await expect(page).not.toHaveURL(/origem=/)
})

test("do gráfico aos pedidos do dia: filtrar, abrir e avançar", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin")
  await expect(page.getByRole("region", { name: "Hoje" })).toBeVisible({ timeout: 15_000 })

  // A última barra é hoje.
  await page.locator(".recharts-bar-rectangle").last().click()
  await expect(page).toHaveURL(/\/admin\/pedidos\?data=2026-11-13/)
  await expect(page.getByRole("button", { name: /13\/11 · 1 dia/ })).toBeVisible()
  await expect(page.getByRole("table")).toBeVisible()

  await page.getByRole("button", { name: /status/i }).click()
  await page.getByRole("option", { name: /novo/i }).click()
  await page.keyboard.press("Escape")
  await expect(page).toHaveURL(/status=recebido/)

  await page
    .getByRole("button", { name: /^Abrir o pedido/ })
    .first()
    .click()
  const detalhes = page.getByRole("dialog", { name: /^Pedido #/ })
  await expect(detalhes).toBeVisible()
  await verificarAcessibilidade(page)

  await detalhes.getByRole("button", { name: "Iniciar preparo" }).click()
  await expect(detalhes.getByRole("button", { name: "Marcar como pronto" })).toBeVisible()

  // Voltar no navegador fecha os detalhes.
  await page.goBack()
  await expect(detalhes).toBeHidden()
})

test("cancelar com o motivo e guardar as taxas de pagamento da loja", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/pedidos?data=2026-11-13&status=recebido")
  await page
    .getByRole("button", { name: /^Abrir o pedido/ })
    .first()
    .click({ timeout: 15_000 })
  const detalhes = page.getByRole("dialog", { name: /^Pedido #/ })
  await detalhes.getByRole("button", { name: "Cancelar pedido" }).click()
  const confirmacao = page.getByRole("alertdialog")
  await confirmacao.getByRole("radio", { name: "Cliente desistiu" }).click()
  await expect(confirmacao.getByRole("radio", { name: "Cliente desistiu" })).toBeChecked()
  await verificarAcessibilidade(page)
  await confirmacao.getByRole("button", { name: "Sim, cancelar" }).click()
  await expect(detalhes.getByText("Motivo: Cliente desistiu")).toBeVisible()

  await page.goto("/admin/loja")
  const taxas = page.getByRole("region", { name: "Taxas de pagamento" })
  await taxas.getByRole("textbox", { name: "Cartão na maquininha" }).fill("3,5")
  await page.getByRole("button", { name: "Salvar alterações" }).click()
  await expect(page.getByText("Configurações salvas.")).toBeVisible()
  await page.reload()
  await expect(
    page
      .getByRole("region", { name: "Taxas de pagamento" })
      .getByRole("textbox", { name: "Cartão na maquininha" }),
  ).toHaveValue("3,5 %", { timeout: 15_000 })
})

test("fila: avançar, tirar da fila e desligar a entrega sem esconder entregas", async ({
  page,
}, info) => {
  test.skip((info.project.use.viewport?.width ?? 0) < 1024, "No celular a fila usa abas")
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/fila")
  const novos = page.getByRole("region", { name: /^Novos, / })
  await expect(novos).toBeVisible({ timeout: 15_000 })

  // Novo → em preparo.
  const primeiro = novos.getByRole("article").first()
  const numero = (await primeiro.getByRole("heading").textContent()) ?? ""
  await primeiro.getByRole("button", { name: "Iniciar preparo" }).click()
  await expect(
    page.getByRole("region", { name: /^Em preparo, / }).getByRole("heading", { name: numero }),
  ).toBeVisible()

  // Retirada pronta sai da fila quando o cliente retira.
  const prontos = page.getByRole("region", { name: /^Prontos, / })
  const retirada = prontos.getByRole("article").filter({ hasText: "Cliente retirou" }).first()
  const numeroRetirada = (await retirada.getByRole("heading").textContent()) ?? ""
  await retirada.getByRole("button", { name: "Cliente retirou" }).click()
  await expect(page.getByRole("heading", { name: numeroRetirada, exact: true })).toHaveCount(0)

  const entregas = page.locator("[data-canal]", { hasText: "Entrega" })
  const antes = await entregas.count()
  await page.getByRole("switch", { name: "Entrega" }).click()
  await expect(page.getByRole("switch", { name: "Entrega" })).not.toBeChecked()
  await expect(entregas).toHaveCount(antes)
  await verificarAcessibilidade(page)
})

test("cardápio: criar produto com opções e mudar o preço na linha", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/cardapio")
  await expect(
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "Editar" }) })
      .first(),
  ).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole("button", { name: "Novo produto" }).click()
  const formulario = page.getByRole("dialog", { name: "Novo produto" })
  await expect(formulario.getByRole("button", { name: "Salvar produto" })).toBeVisible()
  await verificarAcessibilidade(page)

  await formulario.getByLabel("Nome", { exact: true }).fill("Pizza da casa")
  await formulario.getByRole("combobox", { name: "Categoria" }).click()
  await page.getByRole("option", { name: "Tradicionais" }).click()
  await formulario.getByLabel("Preço", { exact: true }).fill("59,90")
  await formulario.getByRole("button", { name: "Adicionar grupo" }).click()
  const grupo = formulario.getByRole("group", { name: "Grupo 1" })
  await grupo.getByLabel("Nome do grupo").fill("Borda")
  await grupo.getByLabel("Nome da opção 1").fill("Catupiry")
  await grupo.getByLabel("Preço da opção 1").fill("8")
  await formulario.getByRole("button", { name: "Salvar produto" }).click()
  await expect(page.getByText("Produto salvo.")).toBeVisible()

  const linha = page.getByRole("listitem", { name: "Pizza da casa" })
  await expect(linha).toContainText("1 grupo de opções")
  const preco = linha.getByRole("textbox", { name: "Preço" })
  await preco.fill("62,50")
  await preco.press("Enter")
  await expect(page.getByText("Pizza da casa: R$ 62,50")).toBeVisible()
})

test("PDV: venda em dinheiro com troco, ticket e últimas vendas", async ({ page }, info) => {
  test.skip((info.project.use.viewport?.width ?? 0) < 1024, "No celular a caixa abre pela barra")
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/pdv")
  await expect(page.getByRole("button", { name: /^Adicionar / }).first()).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole("button", { name: "Lançar item avulso" }).click()
  await page.getByLabel("Item avulso", { exact: true }).fill("Água")
  await page.getByLabel("Qtd.").fill("2")
  await page.getByLabel("Valor", { exact: true }).fill("5")
  await page.getByRole("button", { name: "Incluir item avulso" }).click()

  const venda = page.getByRole("region", { name: "Venda" })
  await expect(venda.getByRole("listitem", { name: "Água" })).toBeVisible()
  await venda.getByText("Dinheiro").click()
  await venda.getByRole("button", { name: "R$ 20" }).click()
  await expect(venda.getByText("Troco: R$ 10,00")).toBeVisible()
  await verificarAcessibilidade(page)

  await page.keyboard.press("F9")
  const ticket = page.getByRole("dialog", { name: /^Venda #\d+/ })
  await expect(ticket).toContainText("troco R$ 10,00")
  await ticket.getByRole("button", { name: "Nova venda" }).click()
  await expect(venda.getByText("Nenhum item na venda.")).toBeVisible()
  await expect(page.getByRole("row", { name: /2× Água/ })).toBeVisible()
})

test("salão: o garçom lança, a cozinha prepara e a mesa fecha a conta", async ({ page }) => {
  test.setTimeout(90_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))

  // Mesas: uma mesa nova, livre.
  await page.goto("/admin/mesas")
  // A janela precisa das áreas do salão: espera a grade carregar antes de abrir.
  await expect(page.getByRole("button", { name: "Mesa 1", exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole("button", { name: "Nova mesa" }).click()
  await page.getByRole("spinbutton", { name: "Número" }).fill("90")
  await page.getByRole("button", { name: "Criar mesa" }).click()
  await expect(page.getByRole("button", { name: "Mesa 90", exact: true })).toContainText("Livre")

  // Garçom: mesa, nome, cliente e um produto sem opções, direto para a cozinha.
  await page.goto("/admin/garcom")
  await page.getByRole("textbox", { name: "Seu nome" }).fill("Rafa")
  await page.getByRole("combobox", { name: "Mesa" }).click()
  await page.getByRole("option", { name: "Mesa 90 · livre" }).click()
  await page.getByRole("textbox", { name: "Cliente" }).fill("Léo")
  // Produto sem opções: o preço no fim do nome não tem o "+".
  await page
    .getByRole("button", { name: /^Adicionar .*\d$/ })
    .first()
    .click()
  const verBandeja = page.getByRole("button", { name: /^Ver bandeja/ })
  if (await verBandeja.isVisible()) await verBandeja.click()
  const bandeja = page.getByRole("region", { name: "Bandeja" })
  await expect(bandeja.getByRole("listitem")).toHaveCount(1)
  await verificarAcessibilidade(page)
  await bandeja.getByRole("button", { name: "Enviar para a cozinha" }).click()
  await expect(page.getByText("Mesa 90: enviado para a cozinha.")).toBeVisible()

  // Cozinha: a rodada chega em "A fazer", vai para o preparo e fica pronta.
  await page.goto("/admin/cozinha")
  // O ticket é procurado dentro da coluna: o que sai de uma coluna ainda fica no DOM
  // enquanto a animação de saída termina.
  const naColuna = (coluna: string) =>
    page
      .getByRole("region", { name: new RegExp(`^${coluna}`) })
      .getByRole("article", { name: /^Mesa 90 ·/ })
  await expect(naColuna("A fazer")).toContainText("Garçom: Rafa", { timeout: 15_000 })
  await verificarAcessibilidade(page)
  await naColuna("A fazer").getByRole("button", { name: "Iniciar preparo" }).click()
  const abaPreparando = page.getByRole("tab", { name: /Preparando/ })
  if (await abaPreparando.isVisible()) await abaPreparando.click()
  await naColuna("Preparando").getByRole("button", { name: "Marcar pronto" }).click()
  const abaProntos = page.getByRole("tab", { name: /Prontos/ })
  if (await abaProntos.isVisible()) await abaProntos.click()
  await expect(naColuna("Prontos")).toContainText("Servir na mesa")

  // Mesas: a comanda está aberta; fechar a conta no Pix libera a mesa.
  await page.goto("/admin/mesas")
  const mesa = page.getByRole("button", { name: "Mesa 90", exact: true })
  await expect(mesa).toContainText("Léo")
  await mesa.click()
  const comanda = page.getByRole("dialog", { name: "Mesa 90" })
  await expect(comanda.getByRole("list", { name: "Itens da comanda" })).toBeVisible()
  await verificarAcessibilidade(page)
  await comanda.getByRole("button", { name: "Fechar conta" }).click()
  // Fase 4: fechar a conta é receber o saldo, na janela "Receber".
  const fechar = page.getByRole("dialog", { name: "Receber da mesa 90" })
  await fechar.getByText("Pix").click()
  await fechar.getByRole("button", { name: /^Receber/ }).click()
  await expect(page.getByText("Conta da mesa 90 fechada.")).toBeVisible()
  // Conta fechada: a mesa vai para a limpeza antes de ficar livre.
  await expect(mesa).toContainText("Limpeza")
})

test("salão: marcar um horário, ver na agenda, atender e concluir", async ({ page }) => {
  test.setTimeout(90_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.addInitScript(() => {
    localStorage.setItem(
      "clickpedido-admin-segmento",
      JSON.stringify({ state: { segmento: "salao" }, version: 1 }),
    )
  })
  await page.goto("/admin/agendamentos?dia=2026-12-01")
  await expect(
    page.getByRole("heading", { level: 2, name: /^terça-feira, 1 de dezembro/ }),
  ).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole("button", { name: "Novo agendamento" }).click()
  const janela = page.getByRole("dialog", { name: "Novo agendamento" })
  await janela.getByRole("textbox", { name: "Nome da cliente" }).fill("Elisa Rocha")
  await janela.getByRole("textbox", { name: "Telefone" }).fill("12991112222")
  await janela.getByRole("checkbox").first().click()
  // 1/12 está longe dos atendimentos de demonstração: o primeiro horário livre é o das 9h.
  await janela.getByRole("radiogroup", { name: "Horário" }).getByText("09:00").click()
  await janela.getByText("Pix", { exact: true }).click()
  await verificarAcessibilidade(page)
  await janela.getByRole("button", { name: "Marcar" }).click()
  await expect(page.getByText(/^Marcado para terça-feira, 01\/12, às 09:00\.$/)).toBeVisible()

  const bloco = page
    .getByRole("region", { name: "Agenda do dia" })
    .getByRole("button", { name: /^09:00 · Elisa Rocha/ })
  await expect(bloco).toBeVisible()
  await verificarAcessibilidade(page)
  await bloco.click()

  const detalhes = page.getByRole("dialog", { name: /^Pedido #\d+/ })
  await detalhes.getByRole("button", { name: "Iniciar atendimento" }).click()
  await detalhes.getByRole("button", { name: "Concluir atendimento" }).click()
  await expect(detalhes).toContainText("Concluído")
  await expect(detalhes).toContainText("Pago")
})

test("entrega: motoboy novo na Fila, bairro novo e a loja que fecha pelo horário", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))

  // Motoboys: cadastra o Davi.
  await page.goto("/admin/motoboys")
  await page.getByRole("button", { name: "Novo motoboy" }).click()
  const janela = page.getByRole("dialog", { name: "Novo motoboy" })
  await janela.getByRole("textbox", { name: "Nome" }).fill("Davi Souza")
  await janela.getByRole("textbox", { name: "WhatsApp" }).fill("12992220000")
  await janela.getByRole("button", { name: "Salvar" }).click()
  await expect(page.getByRole("row", { name: /Davi Souza/ })).toBeVisible()
  await verificarAcessibilidade(page)

  // Pedidos: uma entrega em andamento recebe o Davi.
  await page.goto("/admin/pedidos?canal=entrega&status=em-preparo")
  await page.getByRole("table").getByRole("row").nth(1).click()
  const detalhes = page.getByRole("dialog", { name: /^Pedido #\d+/ })
  await detalhes.getByRole("combobox", { name: "Motoboy" }).click()
  await page.getByRole("option", { name: "Davi Souza" }).click()
  await expect(detalhes.getByRole("combobox", { name: "Motoboy" })).toContainText("Davi Souza")
  await page.keyboard.press("Escape")

  // Bairros: um bairro novo com taxa.
  await page.goto("/admin/bairros")
  await page.getByRole("button", { name: "Novo bairro" }).click()
  const bairro = page.getByRole("dialog", { name: "Novo bairro" })
  await bairro.getByRole("textbox", { name: "Cidade" }).fill("Jacareí")
  await bairro.getByRole("textbox", { name: "Bairro" }).fill("Centro")
  await bairro.getByRole("textbox", { name: "Taxa" }).fill("9")
  await bairro.getByRole("button", { name: "Salvar" }).click()
  await expect(page.getByRole("row", { name: /^Selecionar Centro, Jacareí/ })).toBeVisible()
  await verificarAcessibilidade(page)

  // Configurações: sexta deixa de abrir; pelo horário, a loja fecha.
  await page.goto("/admin/loja")
  await page.getByRole("switch", { name: "Aberto na sexta" }).click()
  await page.getByRole("button", { name: "Salvar alterações" }).click()
  await expect(page.getByText("Configurações salvas.")).toBeVisible()
  await verificarAcessibilidade(page)

  await page.goto("/admin/fila")
  await expect(page.getByRole("switch", { name: "Loja aberta" })).not.toBeChecked({
    timeout: 15_000,
  })
  await expect(page.getByText("Pelo horário")).toBeVisible()
})

/** Abre o painel já no segmento pedido (o seletor é testado à parte). */
async function noSegmento(page: Page, segmento: string) {
  await page.addInitScript((escolhido) => {
    localStorage.setItem(
      "clickpedido-admin-segmento",
      JSON.stringify({ state: { segmento: escolhido }, version: 1 }),
    )
  }, segmento)
}

test("açougue: pesar o pedido e mandar o link de pagamento", async ({ page }) => {
  test.setTimeout(90_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await noSegmento(page, "acougue")
  await page.goto("/admin/pedidos?pagamento=pagar-apos-pesagem&status=recebido,em-preparo,pronto")
  await page.getByRole("table").getByRole("row").nth(1).click()

  const pesagem = page
    .getByRole("dialog", { name: /^Pedido #\d+/ })
    .getByRole("region", { name: "Pesagem" })
  const campos = pesagem.getByRole("textbox")
  // count() não espera: primeiro o painel carrega.
  await expect(campos.first()).toBeVisible({ timeout: 15_000 })
  for (let posicao = 0; posicao < (await campos.count()); posicao += 1) {
    await campos.nth(posicao).fill("1200")
  }
  await expect(pesagem.getByText(/^Diferença:/)).toBeVisible()
  await verificarAcessibilidade(page)
  await pesagem.getByRole("button", { name: "Registrar pesagem" }).click()
  await expect(pesagem.getByText(/^Pesado às \d{2}:\d{2}$/)).toBeVisible()
  await expect(pesagem.getByRole("link", { name: "Enviar link de pagamento" })).toHaveAttribute(
    "href",
    // O token é opaco: nada do segmento nem do número do pedido.
    /checkout%2F[0-9a-f-]{32,36}(?![0-9a-z-])/,
  )
})

test("adega: esgotar um gelo tira a opção do combo no PDV", async ({ page }, info) => {
  test.skip((info.project.use.viewport?.width ?? 0) < 1024, "No celular a caixa abre pela barra")
  test.setTimeout(90_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await noSegmento(page, "adega")

  const opcoesDoCombo = async () => {
    await page.goto("/admin/pdv")
    await page.getByRole("searchbox", { name: "Buscar no cardápio" }).fill("master black combo")
    await page.getByRole("button", { name: /^Adicionar MASTER BLACK COMBO \+ 2 GELO/ }).click()
    return page.getByRole("dialog", { name: "Opções de MASTER BLACK COMBO + 2 GELO" })
  }
  await expect((await opcoesDoCombo()).getByText("Gelo de Coco")).toBeVisible({ timeout: 15_000 })

  await page.goto("/admin/cardapio?busca=gelo de coco")
  const gelo = page.getByRole("listitem").filter({ hasText: "GELO DE COCO" }).first()
  await gelo.getByRole("switch", { name: "Disponível" }).click()
  await expect(gelo.getByText("Esgotado")).toBeVisible()

  const janela = await opcoesDoCombo()
  await expect(janela.getByText("Gelo de Maracujá")).toBeVisible({ timeout: 15_000 })
  await expect(janela.getByText("Gelo de Coco")).toHaveCount(0)
  await verificarAcessibilidade(page)
})

test("estoque: contagem, a venda no PDV baixa e esgota, o cancelamento devolve", async ({
  page,
}, info) => {
  test.skip((info.project.use.viewport?.width ?? 0) < 1024, "No celular a caixa abre pela barra")
  test.setTimeout(120_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await noSegmento(page, "adega")
  const nome = "CERVEJA HEINEKEN ZERO 350ML"

  const linhaNoEstoque = async () => {
    await page.goto("/admin/estoque")
    await page.getByRole("searchbox", { name: "Buscar produto" }).fill("heineken zero")
    const linha = page.getByRole("row", { name: nome, exact: true })
    await expect(linha).toBeVisible({ timeout: 15_000 })
    return linha
  }

  // Contagem: sobrou 1 na prateleira.
  let linha = await linhaNoEstoque()
  await linha.getByRole("button", { name: `Ações de ${nome}` }).click()
  await page.getByRole("menuitem", { name: "Contagem" }).click()
  const contagem = page.getByRole("dialog", { name: `Contagem de ${nome}` })
  await contagem.getByLabel("Quantidade contada").fill("1")
  await verificarAcessibilidade(page)
  await contagem.getByRole("button", { name: "Registrar contagem" }).click()
  await expect(linha.getByText("1 un", { exact: true })).toBeVisible()

  // A venda no balcão leva a última; a fila recebe, para dar para cancelar depois.
  await page.goto("/admin/pdv")
  await expect(page.getByRole("button", { name: /^Adicionar / }).first()).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole("searchbox", { name: "Buscar no cardápio" }).fill("heineken zero")
  await page.getByRole("button", { name: new RegExp(`^Adicionar ${nome}`) }).click()
  const venda = page.getByRole("region", { name: "Venda" })
  await venda.getByText("Pix", { exact: true }).click()
  await venda.getByRole("switch", { name: "Venda concluída no balcão" }).click()
  await venda.getByRole("button", { name: /Mandar para a fila/ }).click()
  await page
    .getByRole("dialog", { name: /^Venda #\d+/ })
    .getByRole("button", { name: "Nova venda" })
    .click()
  const cartao = page.getByRole("button", { name: new RegExp(`^Adicionar ${nome}`) })
  await expect(cartao).toBeDisabled()
  await expect(cartao.getByText("Esgotado")).toBeVisible()

  linha = await linhaNoEstoque()
  await expect(linha.getByText("Zerado").filter({ visible: true })).toBeVisible()
  await expect(linha.getByText("0 un", { exact: true })).toBeVisible()

  // Cancelar a venda devolve a cerveja e ela volta a vender.
  await page.goto("/admin/pedidos")
  await page.getByRole("table").getByRole("row").nth(1).click()
  await page.getByRole("button", { name: "Cancelar pedido" }).click()
  await page.getByRole("button", { name: "Sim, cancelar" }).click()
  await expect(page.getByRole("button", { name: "Cancelar pedido" })).toHaveCount(0)
  // O botão some na hora (otimista); navegar antes de o IndexedDB gravar o cancelamento
  // perde a devolução. Espera a gravação, o que a pessoa não precisa fazer.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<string>((resolver, rejeitar) => {
            const abertura = indexedDB.open("keyval-store")
            abertura.onerror = () => rejeitar(abertura.error)
            abertura.onsuccess = () => {
              const leitura = abertura.result
                .transaction("keyval")
                .objectStore("keyval")
                .get("clickpedido-admin-dados:adega")
              leitura.onerror = () => rejeitar(leitura.error)
              leitura.onsuccess = () => {
                abertura.result.close()
                const pedidos: { numero: number; status: string }[] =
                  leitura.result?.base?.pedidos ?? []
                resolver(pedidos.reduce((a, b) => (b.numero > a.numero ? b : a)).status)
              }
            }
          }),
      ),
    )
    .toBe("cancelado")

  linha = await linhaNoEstoque()
  await expect(linha.getByText("1 un", { exact: true })).toBeVisible()
  await linha.getByRole("button", { name: `Ações de ${nome}` }).click()
  await page.getByRole("menuitem", { name: "Histórico" }).click()
  const historico = page.getByRole("dialog", { name: `Histórico de ${nome}` })
  await expect(historico.getByText("Devolução")).toBeVisible()
  await expect(historico.getByText(/^Venda/)).toBeVisible()
  await verificarAcessibilidade(page)
})

test("farmácia: mesma cor do painel, aprovar a receita e ver a saída nos controlados", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.goto("/admin/receitas")
  await expect(page.getByText("Receitas não faz parte de Pizzaria")).toBeVisible()
  await expect(page.locator("html")).not.toHaveAttribute("data-segmento")

  await page.getByRole("button", { name: /segmento: pizzaria/i }).click()
  await page.getByRole("menuitemradio", { name: /farmácia/i }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Receitas" })).toBeVisible()
  await expect(page.locator("html")).not.toHaveAttribute("data-segmento")

  const ana = page.getByRole("article", { name: "Receita de Ana Paula Ferreira" })
  await expect(ana.getByRole("button", { name: "Aprovar" })).toBeDisabled()
  await ana.getByRole("checkbox", { name: "Via da receita retida na farmácia" }).click()
  await ana.getByRole("button", { name: "Aprovar" }).click()
  await expect(page.getByText("Receita de Ana Paula Ferreira aprovada")).toBeVisible()
  await expect(ana).toHaveCount(0)
  await verificarAcessibilidade(page)

  // A dispensação do antibiótico baixa o saldo na escrituração (24 entraram, 2 saíram antes).
  await page.goto("/admin/controlados")
  const amoxicilina = page
    .getByRole("table", { name: "Saldo por medicamento" })
    .getByRole("row", { name: /Amoxicilina 500 mg/ })
  await expect(amoxicilina.getByRole("cell", { name: "21", exact: true })).toBeVisible()
})

test("no celular o seletor de segmento fica no topo", async ({ page }) => {
  await page.goto("/admin/agendamentos")
  await expect(page.getByText("Agendamentos não faz parte de Pizzaria")).toBeVisible()
  await page.getByRole("button", { name: /segmento: pizzaria/i }).click()
  await page.getByRole("menuitemradio", { name: /salão de beleza/i }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Agendamentos" })).toBeVisible()
  await verificarAcessibilidade(page)
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
    const conteudo = () => document.getElementById(botao.getAttribute("aria-controls") ?? "")
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

  // E o grupo "Personalizar loja" também fecha.
  const painel = page.locator("[data-sidebar=group-label]", { hasText: "Personalizar loja" })
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

test("o painel fala a mesma família da vitrine, título e texto", async ({ page }) => {
  await page.goto("/admin/pedidos")
  const titulo = page.getByRole("heading", { level: 1, name: "Pedidos" })
  await expect(titulo).toBeVisible()
  const fontes = await titulo.evaluate((el) => ({
    titulo: getComputedStyle(el).fontFamily,
    texto: getComputedStyle(document.body).fontFamily,
  }))
  expect(fontes.titulo).toMatch(/Geist/)
  expect(fontes.texto).toMatch(/Geist/)
})

test("fila: ao avançar, o pedido anda de uma coluna para a outra", async ({ page }, info) => {
  test.skip((info.project.use.viewport?.width ?? 0) < 1024, "No celular a fila usa abas")
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/fila")
  const novos = page.getByRole("region", { name: /^Novos, / })
  const preparo = page.getByRole("region", { name: /^Em preparo, / })
  await expect(novos).toBeVisible({ timeout: 15_000 })
  const cartao = novos.getByRole("article").first()
  const titulo = (await cartao.getAttribute("aria-labelledby")) ?? ""
  const xNovos = (await novos.boundingBox())?.x ?? 0
  const xPreparo = (await preparo.boundingBox())?.x ?? 0

  // Anota, quadro a quadro, onde está o cartão desse pedido.
  await page.evaluate((id) => {
    const w = window as unknown as { posicoes: number[] }
    w.posicoes = []
    const inicio = performance.now()
    const anotar = () => {
      const el = document.querySelector(`[aria-labelledby="${id}"]`)
      if (el) w.posicoes.push(el.getBoundingClientRect().x)
      if (performance.now() - inicio < 2000) requestAnimationFrame(anotar)
    }
    requestAnimationFrame(anotar)
  }, titulo)
  await cartao.getByRole("button", { name: "Iniciar preparo" }).click()
  await expect(preparo.locator(`[aria-labelledby="${titulo}"]`)).toBeVisible()
  await page.waitForTimeout(800)
  const posicoes = await page.evaluate(() => (window as unknown as { posicoes: number[] }).posicoes)
  // Passou pelo meio do caminho: nem na coluna de origem, nem já parado na de destino.
  const noCaminho = posicoes.filter((x) => x > xNovos + 24 && x < xPreparo - 24)
  expect(noCaminho.length).toBeGreaterThan(2)
})

test("cozinha: ao iniciar o preparo, o ticket anda de uma coluna para a outra", async ({
  page,
}, info) => {
  test.skip((info.project.use.viewport?.width ?? 0) < 1024, "No celular a cozinha usa abas")
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/cozinha")
  const aFazer = page.getByRole("region", { name: /^A fazer, / })
  const preparando = page.getByRole("region", { name: /^Preparando, / })
  await expect(aFazer.getByRole("article").first()).toBeVisible({ timeout: 15_000 })
  const ticket = aFazer.getByRole("article").first()
  const nome = (await ticket.getAttribute("aria-label")) ?? ""
  const xAFazer = (await aFazer.boundingBox())?.x ?? 0
  const xPreparando = (await preparando.boundingBox())?.x ?? 0

  // Anota, quadro a quadro, onde está o ticket desse pedido.
  await page.evaluate((rotulo) => {
    const w = window as unknown as { posicoes: number[] }
    w.posicoes = []
    const inicio = performance.now()
    const anotar = () => {
      for (const el of document.querySelectorAll(`article[aria-label="${rotulo}"]`)) {
        w.posicoes.push(el.getBoundingClientRect().x)
      }
      if (performance.now() - inicio < 2000) requestAnimationFrame(anotar)
    }
    requestAnimationFrame(anotar)
  }, nome)
  await ticket.getByRole("button", { name: "Iniciar preparo" }).click()
  await expect(preparando.locator(`article[aria-label="${nome}"]`)).toBeVisible()
  await page.waitForTimeout(800)
  const posicoes = await page.evaluate(() => (window as unknown as { posicoes: number[] }).posicoes)
  // Passou pelo meio do caminho: nem na coluna de origem, nem já parado na de destino.
  const noCaminho = posicoes.filter((x) => x > xAFazer + 24 && x < xPreparando - 24)
  expect(noCaminho.length).toBeGreaterThan(2)
})

test("mesas: o filtro de atenção mostra só a mesa que pediu a conta e fica no endereço", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/mesas")
  const filtro = page.getByRole("button", { name: "Precisam de atenção (1)" })
  await expect(filtro).toBeVisible({ timeout: 15_000 })
  await filtro.click()

  await expect(page).toHaveURL(/atencao=sim/)
  await expect(filtro).toHaveAttribute("aria-pressed", "true")
  // Cada mesa é um botão "Mesa N"; só a que pediu a conta sobra na grade.
  const mesas = page.getByRole("button", { name: /^Mesa \d+$/ })
  await expect(mesas).toHaveCount(1)
  await expect(mesas).toContainText("Pediu a conta há 12 min")
})

test("mesas: bloquear uma mesa livre com um motivo e desbloquear", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/mesas")
  // A mesa 5 está ocupada nos dados de demonstração e mesa ocupada não bloqueia; a 11 está livre.
  const menu = page.getByRole("button", { name: "Ações da mesa 11", exact: true })
  await expect(menu).toBeVisible({ timeout: 15_000 })
  const mesa = page.getByRole("button", { name: "Mesa 11", exact: true })
  await expect(mesa).not.toContainText("Bloqueada")

  await menu.click()
  await page.getByRole("menuitem", { name: "Bloquear" }).click()
  const janela = page.getByRole("dialog", { name: "Bloquear mesa 11" })
  await janela.getByRole("textbox", { name: "Motivo (opcional)" }).fill("Em manutenção")
  await janela.getByRole("button", { name: "Bloquear" }).click()
  await expect(page.getByText("Mesa 11 bloqueada.")).toBeVisible()
  await expect(mesa).toContainText("Bloqueada")

  await menu.click()
  await page.getByRole("menuitem", { name: "Desbloquear" }).click()
  await expect(page.getByText("Mesa 11 desbloqueada.")).toBeVisible()
  await expect(mesa).not.toContainText("Bloqueada")
})

test("mesas: abrir a mesa, adicionar itens, a cozinha prepara, marcar servido e pedir a conta", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))

  // Mesas: a mesa 11, livre, abre pela gaveta com pessoas e garçom.
  await page.goto("/admin/mesas?mesa=11")
  const gaveta = page.getByRole("dialog", { name: "Mesa 11" })
  await gaveta.getByRole("spinbutton", { name: "Pessoas" }).fill("2", { timeout: 15_000 })
  await gaveta.getByRole("combobox", { name: "Garçom" }).click()
  await page.getByRole("option", { name: "Bia" }).click()
  await gaveta.getByRole("textbox", { name: "Cliente (opcional)" }).fill("Carla")
  await gaveta.getByRole("button", { name: "Abrir mesa" }).click()
  await expect(page.getByText("Mesa 11 aberta.")).toBeVisible()

  // Adicionar itens: um produto sem opções, direto para a cozinha.
  await gaveta.getByRole("button", { name: "Adicionar itens" }).click()
  const adicionar = page.getByRole("dialog", { name: "Adicionar itens · Mesa 11" })
  await adicionar
    .getByRole("button", { name: /^Adicionar .*\d$/ })
    .first()
    .click()
  const bandeja = adicionar.getByRole("region", { name: "Bandeja" })
  await expect(bandeja.getByRole("listitem")).toHaveCount(1)
  await verificarAcessibilidade(page)
  await bandeja.getByRole("button", { name: "Enviar para a cozinha" }).click()
  await expect(page.getByText("Mesa 11: enviado para a cozinha.")).toBeVisible()
  await expect(
    gaveta.getByRole("list", { name: "Itens da comanda" }).getByRole("listitem"),
  ).toHaveCount(1)

  // Cozinha: a rodada vai para o preparo e fica pronta.
  await page.goto("/admin/cozinha")
  const naColuna = (coluna: string) =>
    page
      .getByRole("region", { name: new RegExp(`^${coluna}`) })
      .getByRole("article", { name: /^Mesa 11 ·/ })
  await expect(naColuna("A fazer")).toContainText("Garçom: Bia", { timeout: 15_000 })
  await naColuna("A fazer").getByRole("button", { name: "Iniciar preparo" }).click()
  const abaPreparando = page.getByRole("tab", { name: /Preparando/ })
  if (await abaPreparando.isVisible()) await abaPreparando.click()
  await naColuna("Preparando").getByRole("button", { name: "Marcar pronto" }).click()
  const abaProntos = page.getByRole("tab", { name: /Prontos/ })
  if (await abaProntos.isVisible()) await abaProntos.click()
  await expect(naColuna("Prontos")).toContainText("Servir na mesa")

  // Mesas: a mesa está em Servir; marcar servido e pedir a conta.
  await page.goto("/admin/mesas")
  const mesa = page.getByRole("button", { name: "Mesa 11", exact: true })
  await expect(mesa).toContainText("Servir", { timeout: 15_000 })
  await mesa.click()
  await expect(page).toHaveURL(/mesa=11/)
  await gaveta.getByRole("button", { name: "Marcar servido" }).click()
  await expect(page.getByText("Mesa 11 servida.")).toBeVisible()
  await gaveta.getByRole("tab", { name: "Conta" }).click()
  await gaveta.getByRole("button", { name: "Pediu a conta" }).click()
  await expect(page.getByText("Mesa 11 pediu a conta.")).toBeVisible()
  await gaveta.getByRole("tab", { name: "Histórico" }).click()
  await expect(gaveta.getByRole("list", { name: "Histórico da comanda" })).toContainText(
    "Mesa aberta para 2 pessoas · Bia",
  )
  await verificarAcessibilidade(page)
  await page.keyboard.press("Escape")
  await expect(page).not.toHaveURL(/mesa=11/)
  await expect(mesa).toContainText("Pediu a conta")
})

test("mesas: dividir a conta por 3, uma parte no Pix e o resto em dinheiro com troco, e ver Misto em Pedidos", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))

  // A mesa 11 abre para 2 pessoas: a pizzaria cobra 10% de taxa e R$ 8,00 de couvert.
  await page.goto("/admin/mesas?mesa=11")
  const gaveta = page.getByRole("dialog", { name: "Mesa 11" })
  await gaveta.getByRole("spinbutton", { name: "Pessoas" }).fill("2", { timeout: 15_000 })
  await gaveta.getByRole("combobox", { name: "Garçom" }).click()
  await page.getByRole("option", { name: "Bia" }).click()
  await gaveta.getByRole("textbox", { name: "Cliente (opcional)" }).fill("Teodoro")
  await gaveta.getByRole("button", { name: "Abrir mesa" }).click()
  await expect(page.getByText("Mesa 11 aberta.")).toBeVisible()

  // Um rodízio avulso de R$ 100,00: a conta fica em 100 + 10 + 16 = R$ 126,00.
  await gaveta.getByRole("textbox", { name: "Item avulso" }).fill("Rodízio")
  await gaveta.getByRole("textbox", { name: "Valor" }).fill("100")
  await gaveta.getByRole("button", { name: "Incluir item avulso" }).click()
  await expect(gaveta.getByRole("listitem", { name: "Rodízio" })).toBeVisible()

  // Conta: dividir por 3 e receber uma parte no Pix.
  await gaveta.getByRole("tab", { name: "Conta" }).click()
  const resumo = gaveta.getByRole("region", { name: "Resumo da conta" })
  await expect(resumo).toContainText("R$ 126,00")
  const dividir = gaveta.getByRole("region", { name: "Dividir igualmente" })
  await dividir.getByRole("spinbutton", { name: "Partes" }).fill("3")
  await expect(dividir.getByRole("button", { name: "Receber R$ 42,00" })).toHaveCount(3)
  await dividir.getByRole("button", { name: "Receber R$ 42,00" }).first().click()
  const receber = page.getByRole("dialog", { name: "Receber da mesa 11" })
  await receber.getByText("Pix").click()
  await receber.getByRole("button", { name: "Receber R$ 42,00" }).click()
  await expect(page.getByText("R$ 42,00 recebido da mesa 11.")).toBeVisible()
  await expect(gaveta.getByRole("list", { name: "Pagamentos" })).toContainText("Pix")
  await verificarAcessibilidade(page)

  // O resto em dinheiro: o cliente entrega R$ 100,00 e leva R$ 16,00 de troco.
  await gaveta.getByRole("button", { name: "Fechar conta" }).click()
  await receber.getByText("Dinheiro").click()
  await receber
    .getByRole("group", { name: "Notas" })
    .getByRole("button", { name: "R$ 100,00" })
    .click()
  await expect(receber.getByText("Troco: R$ 16,00")).toBeVisible()
  await verificarAcessibilidade(page)
  await receber.getByRole("button", { name: "Receber R$ 84,00" }).click()
  await expect(page.getByText("Conta da mesa 11 fechada.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Mesa 11", exact: true })).toContainText("Limpeza")

  // Pedidos: a conta aparece como Misto, com cada pagamento no detalhe.
  await page.goto("/admin/pedidos")
  await page.getByRole("searchbox").first().fill("Teodoro")
  const linha = page.getByRole("row").filter({ hasText: "Teodoro" })
  await expect(linha).toContainText("Misto", { timeout: 15_000 })
  await linha.click()
  const detalhe = page.getByRole("dialog", { name: /^Pedido #/ })
  const pagamentos = detalhe.getByRole("list", { name: "Pagamentos" })
  await expect(pagamentos).toContainText("Pix · R$ 42,00")
  await expect(pagamentos).toContainText("Dinheiro · R$ 84,00 · troco R$ 16,00")
  await verificarAcessibilidade(page)
})

test("mesas: juntar a mesa 8 à 1, ver Mesa 1 + 8 na cozinha, separar e desfazer pelo aviso", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))

  // Mesas: a mesa 1 (aberta) junta a 8 (livre) pelo menu ⋯.
  await page.goto("/admin/mesas")
  const menu = page.getByRole("button", { name: "Ações da mesa 1", exact: true })
  await expect(menu).toBeVisible({ timeout: 15_000 })
  await menu.click()
  await page.getByRole("menuitem", { name: "Juntar mesas" }).click()
  const juntar = page.getByRole("dialog", { name: "Juntar à mesa 1" })
  await juntar.getByRole("checkbox", { name: /^Mesa 8\b/ }).click()
  await verificarAcessibilidade(page)
  await juntar.getByRole("button", { name: "Juntar" }).click()
  await expect(page.getByText("Mesa 8 junto com a mesa 1.")).toBeVisible()
  const mesa8 = page.getByRole("button", { name: "Mesa 8", exact: true })
  await expect(mesa8).toContainText("Com a mesa 1")

  // Uma rodada nova da mesa 1 vai para a cozinha.
  await page.getByRole("button", { name: "Mesa 1", exact: true }).click()
  const gaveta = page.getByRole("dialog", { name: "Mesa 1" })
  await expect(gaveta).toContainText("Junto com a mesa 8")
  await gaveta.getByRole("button", { name: "Adicionar itens" }).click()
  const adicionar = page.getByRole("dialog", { name: "Adicionar itens · Mesa 1" })
  await adicionar
    .getByRole("button", { name: /^Adicionar .*\d$/ })
    .first()
    .click()
  await adicionar
    .getByRole("region", { name: "Bandeja" })
    .getByRole("button", { name: "Enviar para a cozinha" })
    .click()
  await expect(page.getByText("Mesa 1: enviado para a cozinha.")).toBeVisible()

  // Cozinha: o ticket diz as duas mesas.
  await page.goto("/admin/cozinha")
  await expect(
    page.getByRole("region", { name: /^A fazer/ }).getByRole("article", { name: /^Mesa 1 \+ 8 ·/ }),
  ).toBeVisible({ timeout: 15_000 })

  // Mesas: separar e desfazer pelo aviso.
  await page.goto("/admin/mesas")
  await expect(menu).toBeVisible({ timeout: 15_000 })
  await menu.click()
  await page.getByRole("menuitem", { name: "Separar" }).click()
  await expect(page.getByText("Mesas separadas.")).toBeVisible()
  await expect(mesa8).toContainText("Livre")
  await page.getByRole("button", { name: "Desfazer" }).click()
  await expect(page.getByText("Desfeito.")).toBeVisible()
  await expect(mesa8).toContainText("Com a mesa 1")
})

test("mesas: mover a mesa 1 no mapa pelo teclado, salvar e recarregar", async ({ page }, info) => {
  test.skip((info.project.use.viewport?.width ?? 0) < 768, "No celular o mapa só é visto")
  test.setTimeout(60_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/mesas?vista=mapa")
  const salao = page.getByRole("list", { name: "Mapa: Salão" })
  const mesa1 = salao.getByRole("button", { name: "Mesa 1", exact: true })
  await expect(mesa1).toBeVisible({ timeout: 15_000 })
  await verificarAcessibilidade(page)

  await page.getByRole("button", { name: "Editar mapa" }).click()
  await expect(mesa1).toHaveAccessibleDescription(/, coluna 2, linha 2$/)
  await mesa1.focus()
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Shift+ArrowDown")
  await page.keyboard.press("Shift+ArrowDown")
  await expect(mesa1).toHaveAccessibleDescription(/, coluna 3, linha 10$/)
  await expect(mesa1).toBeFocused()
  await verificarAcessibilidade(page)
  await page.getByRole("button", { name: "Salvar posições" }).click()
  await expect(page.getByText("Mapa salvo.")).toBeVisible()

  await page.reload()
  await expect(mesa1).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: "Editar mapa" }).click()
  await expect(mesa1).toHaveAccessibleDescription(/, coluna 3, linha 10$/)
  await page.getByRole("button", { name: "Cancelar" }).click()
})

test("mesas: arrastar a mesa 2 no mapa encaixa na grade e salva", async ({ page }, info) => {
  test.skip((info.project.use.viewport?.width ?? 0) < 768, "No celular o mapa só é visto")
  test.setTimeout(60_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/mesas?vista=mapa")
  const salao = page.getByRole("list", { name: "Mapa: Salão" })
  const mesa2 = salao.getByRole("button", { name: "Mesa 2", exact: true })
  await expect(mesa2).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: "Editar mapa" }).click()

  /**
   * Arrasta a mesa 2 algumas células para baixo, soltando um pouco fora do meio. Antes, a mesa
   * sobe para logo abaixo do cabeçalho preso: na tela baixa (celular deitado), chegar perto da
   * borda de baixo rolaria a página durante o arrasto, e a mesa iria mais longe.
   */
  async function arrastarParaBaixo(celulas: number) {
    const inicio = await mesa2.boundingBox()
    if (!inicio) throw new Error("O mapa não apareceu")
    await page.evaluate((dy) => window.scrollBy(0, dy), inicio.y - 80)
    const planta = await salao.boundingBox()
    const mesa = await mesa2.boundingBox()
    if (!planta || !mesa) throw new Error("O mapa não apareceu")
    const altura = planta.height / 16
    const x = mesa.x + mesa.width / 2
    const y = mesa.y + mesa.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 6, y + (altura * celulas) / 2, { steps: 8 })
    await page.mouse.move(x + 6, y + altura * celulas + 5, { steps: 8 })
    await page.mouse.up()
  }

  // Da coluna 5, linha 2, até a linha 10, em dois arrastos de 4 células (no meio do caminho a
  // mesa passa por cima da 6, o que o rascunho aceita).
  await arrastarParaBaixo(4)
  await expect(mesa2).toHaveAccessibleDescription(/, coluna 5, linha 6, sobre outra mesa$/)
  await page.waitForTimeout(100)
  await arrastarParaBaixo(4)
  await expect(mesa2).toHaveAccessibleDescription(/, coluna 5, linha 10$/)
  // O dnd-kit engole os cliques dos 50 ms depois de soltar (o clique do próprio arrasto).
  await page.waitForTimeout(100)
  await page.getByRole("button", { name: "Salvar posições" }).click()
  await expect(page.getByText("Mapa salvo.")).toBeVisible()
  await page.reload()
  await expect(mesa2).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: "Editar mapa" }).click()
  await expect(mesa2).toHaveAccessibleDescription(/, coluna 5, linha 10$/)
})

test("mesas: no celular o mapa só é visto, e a página não rola de lado", async ({ page }, info) => {
  test.skip((info.project.use.viewport?.width ?? 0) >= 768, "Só no celular")
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/mesas?vista=mapa")
  const salao = page.getByRole("list", { name: "Mapa: Salão" })
  await expect(salao.getByRole("button", { name: "Mesa 1", exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole("button", { name: "Editar mapa" })).toHaveCount(0)
  await esperarAnimacoes(page)
  // A planta rola de lado dentro da própria faixa; a página não.
  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(sobra).toBeLessThanOrEqual(0)
  await verificarAcessibilidade(page)
})

test("mesas: reservar a mesa 8, chegar a hora, sentar a reserva e fechar a conta", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/mesas")

  // Às 20:30, Helena reserva a mesa 8 para as 21:15, com 4 pessoas.
  const painel = page.getByRole("region", { name: "Reservas e espera" })
  await painel.getByRole("button", { name: "Nova reserva" }).click({ timeout: 15_000 })
  const janela = page.getByRole("dialog", { name: "Nova reserva" })
  await janela.getByRole("textbox", { name: "Nome" }).fill("Helena")
  await janela.getByLabel("Horário").fill("21:15")
  await janela.getByRole("spinbutton", { name: "Pessoas" }).fill("4")
  await janela.getByRole("combobox", { name: "Mesa" }).click()
  await page.getByRole("option", { name: "Mesa 8 · 4 lugares" }).click()
  await verificarAcessibilidade(page)
  await janela.getByRole("button", { name: "Salvar reserva" }).click()
  await expect(page.getByText("Reserva de Helena salva.")).toBeVisible()
  const mesa8 = page.getByRole("button", { name: "Mesa 8", exact: true })
  await expect(mesa8).toContainText("Livre")

  // Às 20:50 (25 min antes), a mesa 8 já está reservada.
  await page.clock.setFixedTime(new Date("2026-11-13T20:50:00-03:00"))
  await page.reload()
  await expect(mesa8).toContainText("Reservada 21:15", { timeout: 15_000 })
  await expect(mesa8).toContainText("Helena · 4 pessoas")

  // Helena chegou: sentar abre a mesa 8 no nome dela, com a Bia.
  await painel.getByRole("button", { name: "Sentar Helena" }).click()
  const sentar = page.getByRole("dialog", { name: "Sentar Helena" })
  await expect(sentar.getByRole("combobox", { name: "Mesa" })).toContainText("Mesa 8")
  await sentar.getByRole("combobox", { name: "Garçom" }).click()
  await page.getByRole("option", { name: "Bia" }).click()
  await verificarAcessibilidade(page)
  await sentar.getByRole("button", { name: "Sentar" }).click()
  await expect(page.getByText("Helena na mesa 8.")).toBeVisible()
  await expect(mesa8).toContainText("Helena")
  await expect(painel.getByRole("list", { name: "Reservas de hoje" })).toContainText("Sentou")

  // Uma água de R$ 4,00: a conta fica em 4 + 0,40 de taxa + 4 × 8 de couvert = R$ 36,40.
  await mesa8.click()
  const gaveta = page.getByRole("dialog", { name: "Mesa 8" })
  await gaveta.getByRole("textbox", { name: "Item avulso" }).fill("Água")
  await gaveta.getByRole("textbox", { name: "Valor" }).fill("4")
  await gaveta.getByRole("button", { name: "Incluir item avulso" }).click()
  await expect(gaveta.getByRole("listitem", { name: "Água" })).toBeVisible()

  // Recebe no Pix e a mesa vai para a limpeza.
  await gaveta.getByRole("tab", { name: "Conta" }).click()
  await gaveta.getByRole("button", { name: "Fechar conta" }).click()
  const receber = page.getByRole("dialog", { name: "Receber da mesa 8" })
  await receber.getByText("Pix").click()
  await receber.getByRole("button", { name: "Receber R$ 36,40" }).click()
  await expect(page.getByText("Conta da mesa 8 fechada.")).toBeVisible()
  await expect(mesa8).toContainText("Limpeza")
})

test("mesas: o cliente pede pelo QR da mesa 11, o painel aceita; o cliente chama e o painel atende", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000)
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/mesas?mesa=11")

  // A gaveta da mesa livre abre a vitrine da mesa numa aba nova, como o QR.
  const gaveta = page.getByRole("dialog", { name: "Mesa 11" })
  const [cliente] = await Promise.all([
    context.waitForEvent("page"),
    gaveta.getByRole("button", { name: "Simular cliente na mesa" }).click({ timeout: 15_000 }),
  ])
  await expect(cliente).toHaveURL(/\/mesa\?loja=pizzaria&mesa=mesa-11$/)
  await expect(cliente.getByRole("heading", { level: 1, name: "Mesa 11" })).toBeVisible({
    timeout: 15_000,
  })
  await expect(cliente.getByText("Peça daqui e pague na mesa, com o garçom.")).toBeVisible()
  await verificarAcessibilidade(cliente)

  // O cliente pede uma água para a mesa.
  await cliente.getByRole("button", { name: "Adicionar Água sem gás" }).click()
  await cliente.getByRole("button", { name: "Pedir para a mesa" }).click()
  await expect(cliente.getByText("Pedido enviado. O garçom vai confirmar.")).toBeVisible()

  // O painel recebe na hora (o chamado da mesa 1 é da demonstração) e aceita.
  await page.keyboard.press("Escape")
  const mesa11 = page.getByRole("button", { name: "Mesa 11", exact: true })
  await expect(mesa11).toContainText("Pedido pelo QR")
  await page.getByRole("button", { name: "Chamados 2 esperando" }).click()
  const lista = page.getByRole("dialog", { name: "Chamados" })
  await expect(lista.getByRole("listitem", { name: "Mesa 11" })).toContainText("1× Água sem gás")
  await verificarAcessibilidade(page)
  await lista.getByRole("button", { name: "Aceitar o pedido da mesa 11" }).click()
  await expect(page.getByText("Pedido da mesa 11 aceito.")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(mesa11).toContainText("Na cozinha")

  // O cliente chama o garçom, e o painel atende.
  await cliente.getByRole("button", { name: "Chamar o garçom" }).click()
  await expect(cliente.getByText("O garçom já vem.")).toBeVisible()
  await expect(mesa11).toContainText("Chamou o garçom")
  await page.getByRole("button", { name: "Chamados 2 esperando" }).click()
  await lista.getByRole("button", { name: "Atender a mesa 11" }).click()
  await expect(lista.getByRole("listitem", { name: "Mesa 11" })).toBeHidden()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "Chamados 1 esperando" })).toBeVisible()
  await expect(mesa11).not.toContainText("Chamou o garçom")
})
