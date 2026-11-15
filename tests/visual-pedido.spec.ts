import { expect, type Page, test } from "@playwright/test"
import { esperarAnimacoes } from "./apoio"

/**
 * Referências visuais do acompanhamento do pedido e da busca de pedidos.
 * Mudança de estilo só depois de existir a imagem do antes. Roda em um celular e um computador.
 */
const TELAS_VISUAIS = ["celular-390", "desktop-1920"]

/** O andamento depende do relógio: a página roda sempre no mesmo instante, no horário de Brasília. */
const AGORA = new Date("2026-11-14T21:00:00-03:00").getTime()

test.use({ timezoneId: "America/Sao_Paulo" })

const foto = {
  src: "/mock/calabresa.jpg",
  width: 800,
  height: 533,
  blurDataURL: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
}

/** Cada item com a foto dele: o refrigerante não pode aparecer com foto de pizza. */
const fotoRefrigerante = { ...foto, src: "/mock/refrigerante.jpg" }

function pedido(numero: number, segundosAtras: number, extra: Record<string, unknown> = {}) {
  return {
    numero,
    itens: [
      {
        chave: "calabresa",
        produtoId: "calabresa",
        nome: "Pizza Calabresa Especial",
        imagem: foto,
        precoUnitario: 52,
        quantidade: 1,
        resumo: ["Grande", "Borda de catupiry"],
      },
      {
        chave: "refrigerante-cola",
        produtoId: "refrigerante-cola",
        nome: "Refrigerante de cola 2L",
        imagem: fotoRefrigerante,
        precoUnitario: 14,
        quantidade: 2,
        resumo: [],
      },
    ],
    subtotal: 80,
    taxaEntrega: 6,
    total: 86,
    criadoEm: AGORA - segundosAtras * 1000,
    cliente: { nome: "Ana", whatsapp: "(12) 97777-6655" },
    tipo: "entrega",
    endereco: "Rua das Flores, 120 - Vila Adyana",
    pagamento: "dinheiro",
    troco: 100,
    observacao: "Interfone quebrado, pode ligar",
    ...extra,
  }
}

async function abrirCom(
  page: Page,
  tema: "light" | "dark",
  sacola: { ultimoPedido: unknown; pedidos: unknown[] },
  caminho: string,
) {
  await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" })
  await page.clock.setFixedTime(AGORA)
  await page.addInitScript((estado) => {
    localStorage.setItem(
      "clickpedido-sacola",
      JSON.stringify({ state: { itens: [], dadosLembrados: null, ...estado }, version: 0 }),
    )
  }, sacola)
  await page.goto(caminho)
}

test.describe("visual do pedido", () => {
  test.beforeEach(() => {
    test.skip(!TELAS_VISUAIS.includes(test.info().project.name), "referência visual só em 2 telas")
  })

  for (const tema of ["light", "dark"] as const) {
    const nomeTema = tema === "light" ? "claro" : "escuro"

    test(`acompanhamento em preparo, tema ${nomeTema}`, async ({ page }) => {
      const emPreparo = pedido(2234, 10)
      await abrirCom(page, tema, { ultimoPedido: emPreparo, pedidos: [emPreparo] }, "/pedido")
      await expect(page.getByRole("heading", { level: 1, name: "Em preparo" })).toBeVisible()
      await page.waitForLoadState("networkidle")
      await esperarAnimacoes(page)
      await expect(page.locator("main")).toHaveScreenshot(`acompanhamento-preparo-${tema}.png`, {
        animations: "disabled",
      })
    })

    test(`acompanhamento concluído, tema ${nomeTema}`, async ({ page }) => {
      const retirado = pedido(2235, 120, {
        tipo: "retirada",
        endereco: "Rua XV de Novembro, 410 - Centro",
        taxaEntrega: 0,
        total: 80,
        pagamento: "pix",
        troco: null,
        observacao: "",
      })
      await abrirCom(page, tema, { ultimoPedido: retirado, pedidos: [retirado] }, "/pedido")
      await expect(page.getByRole("heading", { level: 1, name: "Retirado" })).toBeVisible()
      await page.waitForLoadState("networkidle")
      await esperarAnimacoes(page)
      await expect(page.locator("main")).toHaveScreenshot(`acompanhamento-concluido-${tema}.png`, {
        animations: "disabled",
      })
    })

    test(`busca de pedidos vazia, tema ${nomeTema}`, async ({ page }) => {
      await abrirCom(page, tema, { ultimoPedido: null, pedidos: [] }, "/pedidos")
      await expect(page.getByLabel("Celular (WhatsApp)")).toBeVisible()
      await page.waitForLoadState("networkidle")
      await esperarAnimacoes(page)
      await expect(page.locator("main")).toHaveScreenshot(`busca-vazia-${tema}.png`, {
        animations: "disabled",
      })
    })

    test(`busca sem pedidos do celular, tema ${nomeTema}`, async ({ page }) => {
      await abrirCom(page, tema, { ultimoPedido: null, pedidos: [] }, "/pedidos")
      await page.getByLabel("Celular (WhatsApp)").fill("12988887766")
      await page.getByRole("button", { name: "Ver meu pedido" }).click()
      // O ponteiro sai do botão: a foto não pega o hover.
      await page.mouse.move(0, 0)
      await expect(page.getByTestId("sem-pedidos")).toBeVisible({ timeout: 4000 })
      await page.waitForLoadState("networkidle")
      await esperarAnimacoes(page)
      await expect(page.locator("main")).toHaveScreenshot(`busca-sem-pedidos-${tema}.png`, {
        animations: "disabled",
      })
    })

    test(`busca com vários pedidos, tema ${nomeTema}`, async ({ page }) => {
      const pedidos = [pedido(2236, 600), pedido(2101, 86_400 * 3)]
      await abrirCom(page, tema, { ultimoPedido: null, pedidos }, "/pedidos")
      await page.getByLabel("Celular (WhatsApp)").fill("12977776655")
      await page.getByRole("button", { name: "Ver meu pedido" }).click()
      // O ponteiro sai do botão: a foto não pega o hover.
      await page.mouse.move(0, 0)
      await expect(page.getByTestId("lista-pedidos")).toBeVisible({ timeout: 4000 })
      await page.waitForLoadState("networkidle")
      await esperarAnimacoes(page)
      await expect(page.locator("main")).toHaveScreenshot(`busca-resultado-${tema}.png`, {
        animations: "disabled",
      })
    })
  }
})
