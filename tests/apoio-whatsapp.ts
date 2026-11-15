import type { Page } from "@playwright/test"

/** 19:42 de 14/11/2026, no fuso da loja. */
export const AGORA = new Date("2026-11-14T19:42:00-03:00")

const imagem = {
  src: "/placeholder.png",
  width: 1,
  height: 1,
  blurDataURL: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
}

/** Um pedido já enviado em cada loja, como o checkout salva neste aparelho. */
export const PEDIDOS = {
  "casa-da-pizza": {
    numero: 4821,
    itens: [
      {
        chave: "meio-a-meio",
        produtoId: "meio-a-meio",
        nome: "Pizza meio a meio",
        imagem,
        precoUnitario: 73,
        quantidade: 1,
        resumo: ["½ Calabresa", "½ Pepperoni", "Borda de catupiry"],
        observacao: "Bem assada, por favor",
      },
      {
        chave: "refrigerante-cola",
        produtoId: "refrigerante-cola",
        nome: "Refrigerante de cola 2L",
        imagem,
        precoUnitario: 14,
        quantidade: 2,
        resumo: [],
      },
    ],
    subtotal: 101,
    taxaEntrega: 6,
    total: 107,
    criadoEm: AGORA.getTime(),
    cliente: { nome: "Gabriel", whatsapp: "(12) 99888-7766" },
    tipo: "entrega",
    endereco: "Rua das Palmeiras, 120 - Centro",
    pagamento: "pix",
    troco: null,
  },
  "drogaria-bem-estar": {
    numero: 2234,
    itens: [
      {
        chave: "dipirona-1g",
        produtoId: "dipirona-1g",
        nome: "Dipirona 1 g",
        imagem,
        precoUnitario: 12.9,
        quantidade: 1,
        resumo: ["10 comprimidos"],
      },
    ],
    subtotal: 12.9,
    taxaEntrega: 0,
    total: 12.9,
    criadoEm: AGORA.getTime(),
    cliente: { nome: "Ana", whatsapp: "(12) 99876-5432" },
    tipo: "retirada",
    pagamento: "dinheiro",
    troco: null,
  },
} as const

export type LojaDaConversa = keyof typeof PEDIDOS

/**
 * Abre a conversa simulada com o relógio parado em `AGORA` e, se `loja` vier, com o pedido
 * dela salvo neste aparelho; sem loja, abre sem pedido nenhum.
 */
export async function abrirConversa(page: Page, loja: LojaDaConversa | null) {
  await page.clock.setFixedTime(AGORA)
  await page.addInitScript(
    ({ loja, pedido }) => {
      if (!loja) return
      localStorage.setItem("clickpedido-loja", JSON.stringify({ state: { id: loja }, version: 1 }))
      localStorage.setItem(
        "clickpedido-sacola",
        JSON.stringify({
          state: { itens: [], ultimoPedido: pedido, pedidos: [pedido], dadosLembrados: null },
          version: 0,
        }),
      )
    },
    { loja, pedido: loja ? PEDIDOS[loja] : null },
  )
  await page.goto("/whatsapp")
}
