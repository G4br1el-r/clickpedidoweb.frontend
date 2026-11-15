import { expect, test } from "@playwright/test"
import {
  verificarAcessibilidade,
  verificarAreasDeToque,
  verificarSemRolagemHorizontal,
} from "./apoio"
import { abrirConversa } from "./apoio-whatsapp"

/**
 * A conversa simulada no WhatsApp da loja, aberta direto com um pedido salvo neste aparelho.
 * O caminho até ela, do cardápio ao acompanhamento, fica no fluxo completo de pedido.spec.ts.
 */
test.describe("conversa no WhatsApp da loja", () => {
  test("a loja lê o pedido, digita e responde; no fim, o novo pedido volta ao cardápio", async ({
    page,
  }) => {
    await abrirConversa(page, "casa-da-pizza")

    const topo = page.getByTestId("topo-conversa")
    await expect(topo.getByRole("heading", { name: "Casa da Pizza" })).toBeVisible()
    await expect(topo.getByText("Simulação", { exact: true })).toBeVisible()
    await expect(page.getByText("Nenhuma mensagem foi enviada de verdade.")).toBeVisible()

    const resumo = page.getByRole("article", { name: "Seu pedido" })
    await expect(resumo.getByText("1× Pizza meio a meio")).toBeVisible()
    await expect(resumo.getByText("2× Refrigerante de cola 2L")).toBeVisible()
    await expect(resumo.getByText("Total: R$ 107,00")).toBeVisible()
    await expect(resumo.getByText("19:42")).toBeVisible()
    await expect(resumo.getByRole("img", { name: "Lida" })).toBeVisible()

    await expect(page.getByRole("status", { name: "Casa da Pizza está digitando" })).toBeVisible()
    await expect(topo.getByText("digitando…")).toBeVisible()

    const conversa = page.getByRole("log", { name: "Conversa com a loja" })
    await expect(conversa.getByText(/Recebemos seu pedido nº 4821/)).toBeVisible()
    await expect(conversa.getByText(/A previsão de entrega é de/)).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole("status", { name: "Casa da Pizza está digitando" })).toHaveCount(0)
    await expect(topo.getByText("online")).toBeVisible()

    const novoPedido = page.getByRole("link", { name: "Fazer novo pedido" })
    await expect(novoPedido).toBeVisible()
    await verificarSemRolagemHorizontal(page)
    await verificarAreasDeToque(page.locator("main"))
    await verificarAcessibilidade(page)

    await novoPedido.click()
    await expect(page).toHaveURL("/")
    await expect(page.getByTestId("resumo-sacola")).toHaveText("Sacola vazia")
  })

  test("na farmácia, no escuro, a retirada é no balcão e a tela continua legível", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    await abrirConversa(page, "drogaria-bem-estar")
    const resumo = page.getByRole("article", { name: "Seu pedido" })
    await expect(resumo.getByText("Retirada no balcão")).toBeVisible()
    await expect(page.getByText(/Fica pronto em/)).toBeVisible({ timeout: 8000 })
    await verificarSemRolagemHorizontal(page)
    await verificarAcessibilidade(page)
  })
})
