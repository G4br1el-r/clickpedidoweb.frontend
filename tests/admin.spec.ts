import { expect, type Page, test } from "@playwright/test"
import { esperarAnimacoes, verificarAcessibilidade } from "./apoio"

/** Cada teste começa com as configurações de fábrica. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("admin-limpo")) {
      localStorage.removeItem("clickpedido-admin")
      localStorage.removeItem("clickpedido-admin-segmento")
      localStorage.removeItem("clickpedido-admin-farmacia")
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
  const fechar = page.getByRole("dialog", { name: "Fechar a conta da mesa 90" })
  await fechar.getByText("Pix").click()
  await fechar.getByRole("button", { name: /^Receber/ }).click()
  await expect(page.getByText("Conta da mesa 90 fechada.")).toBeVisible()
  await expect(mesa).toContainText("Livre")
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
  await page.getByRole("radio", { name: "Cliente pediu para cancelar" }).click()
  await page.getByRole("button", { name: "Sim, cancelar" }).click()
  await expect(page.getByRole("button", { name: "Cancelar pedido" })).toHaveCount(0)

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

test("fila: os botões de cada cartão ficam dentro do cartão, em qualquer tela", async ({
  page,
}) => {
  await page.goto("/admin/fila")
  const cartoes = page.getByRole("article")
  await expect(cartoes.first()).toBeVisible({ timeout: 15_000 })
  await esperarAnimacoes(page)
  for (const cartao of await cartoes.all()) {
    if (!(await cartao.isVisible())) continue
    const borda = await cartao.boundingBox()
    if (!borda) continue
    for (const botao of await cartao.getByRole("button").all()) {
      const caixa = await botao.boundingBox()
      if (!caixa) continue
      const nome = await botao.getAttribute("aria-label")
      expect(caixa.x, nome ?? "botão").toBeGreaterThanOrEqual(borda.x)
      expect(caixa.x + caixa.width, nome ?? "botão").toBeLessThanOrEqual(borda.x + borda.width)
    }
  }
})

test("fila: pedido do site espera aceite; aceitar e recusar com motivo", async ({ page }, info) => {
  test.skip((info.project.use.viewport?.width ?? 0) < 1024, "No celular a fila usa abas")
  // Relógio controlado: a simulação manda um pedido do site por minuto.
  await page.clock.install({ time: new Date("2026-11-13T20:30:00-03:00") })
  await page.goto("/admin/fila")
  const novos = page.getByRole("region", { name: /^Novos, / })
  await expect(novos).toBeVisible({ timeout: 15_000 })
  // A simulação já vem ligada de fábrica.
  await expect(page.getByRole("switch", { name: "Simular pedidos chegando" })).toBeChecked()

  await page.clock.fastForward(61_000)
  const esperando = novos.getByRole("article").filter({ hasText: "Esperando aceite" }).first()
  await expect(esperando).toBeVisible({ timeout: 10_000 })
  const numero = (await esperando.getByRole("heading").textContent()) ?? ""
  await esperando.getByRole("button", { name: "Aceitar" }).click()
  const aceito = novos
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: numero, exact: true }) })
  await expect(aceito.getByRole("button", { name: "Iniciar preparo" })).toBeVisible()

  await page.clock.fastForward(61_000)
  const outro = novos.getByRole("article").filter({ hasText: "Esperando aceite" }).first()
  await expect(outro).toBeVisible({ timeout: 10_000 })
  const numeroRecusado = (await outro.getByRole("heading").textContent()) ?? ""
  await outro.getByRole("button", { name: "Recusar" }).click()
  const dialogo = page.getByRole("alertdialog", { name: `Recusar o pedido ${numeroRecusado}?` })
  await dialogo.getByRole("radio", { name: "Loja cheia" }).click()
  await dialogo.getByRole("button", { name: "Sim, recusar" }).click()
  await expect(page.getByRole("heading", { name: numeroRecusado, exact: true })).toHaveCount(0)
  // Sem axe aqui: com o relógio controlado as animações param no meio (cartão transparente).
})

test("fila: pedidos de dias anteriores saem do quadro e se resolvem de uma vez", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-13T20:30:00-03:00"))
  await page.goto("/admin/fila")
  // Abre no dia 13 (com pedidos em andamento) e volta no dia seguinte.
  await expect(page.getByRole("heading", { level: 1, name: "Fila de pedidos" })).toBeVisible()
  await expect(page.getByText(/em andamento/)).toBeVisible({ timeout: 15_000 })
  await page.clock.setFixedTime(new Date("2026-11-14T11:00:00-03:00"))
  await page.reload()

  const aviso = page.getByRole("button", { name: /pedidos? de dias anteriores$/ })
  await expect(aviso).toBeVisible({ timeout: 15_000 })
  await aviso.click()
  const lista = page.getByRole("dialog", { name: "Pedidos de dias anteriores" })
  await expect(lista.getByRole("listitem").first()).toBeVisible()
  await verificarAcessibilidade(page, "[role=dialog]")
  await lista.getByRole("button", { name: "Concluir todos" }).click()

  await expect(lista).toBeHidden()
  await expect(aviso).toBeHidden()
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
