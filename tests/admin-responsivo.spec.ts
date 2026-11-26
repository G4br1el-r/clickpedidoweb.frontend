import { expect, type Page, test } from "@playwright/test"
import { esperarAnimacoes, verificarSemRolagemHorizontal } from "./apoio"
import { botoesCortados, controlesPequenos } from "./apoio-responsivo"

/** Sexta, 13/11/2026, 20:30: os pedidos de demonstração saem sempre iguais. */
const AGORA = new Date("2026-11-13T20:30:00-03:00")

test.use({ timezoneId: "America/Sao_Paulo" })

type Tela = { rota: string; segmento: string; titulo: string }

/** Toda tela do painel, no segmento que tem o módulo. */
const TELAS: Tela[] = [
  { rota: "/admin", segmento: "pizzaria", titulo: "Visão geral" },
  { rota: "/admin/fila", segmento: "pizzaria", titulo: "Fila de pedidos" },
  { rota: "/admin/pdv", segmento: "pizzaria", titulo: "PDV" },
  { rota: "/admin/cozinha", segmento: "pizzaria", titulo: "Cozinha" },
  { rota: "/admin/mesas", segmento: "pizzaria", titulo: "Mesas" },
  { rota: "/admin/garcom", segmento: "pizzaria", titulo: "Garçom" },
  { rota: "/admin/pedidos", segmento: "pizzaria", titulo: "Pedidos" },
  { rota: "/admin/cardapio", segmento: "pizzaria", titulo: "Cardápio" },
  { rota: "/admin/categorias", segmento: "pizzaria", titulo: "Categorias" },
  { rota: "/admin/estoque", segmento: "pizzaria", titulo: "Estoque" },
  { rota: "/admin/motoboys", segmento: "pizzaria", titulo: "Motoboys" },
  { rota: "/admin/bairros", segmento: "pizzaria", titulo: "Bairros" },
  { rota: "/admin/loja", segmento: "pizzaria", titulo: "Loja" },
  { rota: "/admin/agendamentos", segmento: "salao", titulo: "Agendamentos" },
  { rota: "/admin/receitas", segmento: "farmacia", titulo: "Receitas" },
  { rota: "/admin/controlados", segmento: "farmacia", titulo: "Controlados" },
  { rota: "/admin/validade", segmento: "farmacia", titulo: "Lotes e validade" },
  { rota: "/admin/configuracoes", segmento: "pizzaria", titulo: "Configurações" },
]

async function abrir(page: Page, { rota, segmento }: Tela) {
  await page.clock.setFixedTime(AGORA)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript((seg) => {
    localStorage.removeItem("clickpedido-admin")
    localStorage.removeItem("clickpedido-admin-metas")
    localStorage.setItem(
      "clickpedido-admin-segmento",
      JSON.stringify({ state: { segmento: seg }, version: 1 }),
    )
  }, segmento)
  await page.goto(rota)
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("status", { name: /^Carregando/ })).toHaveCount(0, {
    timeout: 15_000,
  })
  await page.waitForLoadState("networkidle")
  await esperarAnimacoes(page)
}

test.describe("painel: toda tela cabe e se toca em qualquer tamanho", () => {
  for (const tela of TELAS) {
    test(`${tela.titulo}: sem rolagem lateral e sem aviso de módulo fora do segmento`, async ({
      page,
    }) => {
      await abrir(page, tela)
      await expect(page.getByText(/não faz parte d/)).toHaveCount(0)
      await verificarSemRolagemHorizontal(page)
    })

    test(`${tela.titulo}: abaixo de 1024 px a barra lateral é gaveta e o conteúdo usa a largura toda`, async ({
      page,
    }) => {
      const largura = page.viewportSize()?.width ?? 0
      test.skip(largura >= 1024, "Com a janela larga, a barra lateral fica aberta ao lado")
      await abrir(page, tela)
      const miolo = await page.locator("[data-slot=sidebar-inset]").boundingBox()
      expect(miolo?.width ?? 0, "o conteúdo começa na borda da janela").toBeGreaterThanOrEqual(
        largura - 1,
      )
    })

    test(`${tela.titulo}: abre no topo, sem a página rolar sozinha`, async ({ page }) => {
      await abrir(page, tela)
      // Tempo de uma rolagem suave terminar, caso alguma comece.
      await page.waitForTimeout(800)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
    })

    test(`${tela.titulo}: nenhum botão com texto cortado`, async ({ page }) => {
      await abrir(page, tela)
      const cortados = await botoesCortados(page)
      expect(cortados).toEqual([])
    })

    test(`${tela.titulo}: em tela de toque, todo controle tem 44 px para o dedo`, async ({
      page,
    }, info) => {
      test.skip(!info.project.use.hasTouch, "Só em tela de toque")
      await abrir(page, tela)
      expect(await controlesPequenos(page)).toEqual([])
    })
  }
})
