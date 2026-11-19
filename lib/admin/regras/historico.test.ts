import { describe, expect, test } from "vitest"
import type { Pedido } from "../dados/tipos"
import { eventosDaMudanca, linhaDoTempo } from "./historico"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const EM = "2026-11-13T23:40:00.000Z"
const recebido: Pedido = { ...PEDIDOS_DE_TESTE[2], status: "recebido" }

describe("eventosDaMudanca", () => {
  test("a troca de etapa vira um evento com a etapa nova e a hora", () => {
    const depois: Pedido = { ...recebido, status: "em-preparo" }

    expect(eventosDaMudanca(recebido, depois, EM)).toEqual([
      { tipo: "etapa", status: "em-preparo", em: EM },
    ])
  })

  test("receber o pagamento vira um evento de pago", () => {
    const aPagar: Pedido = { ...recebido, situacaoPagamento: "na-entrega" }
    const pago: Pedido = { ...aPagar, situacaoPagamento: "pago", pagoEm: EM }

    expect(eventosDaMudanca(aPagar, pago, EM)).toEqual([{ tipo: "pago", em: EM }])
  })

  test("cada impressão, a primeira ou uma reimpressão, vira um evento", () => {
    const impresso: Pedido = { ...recebido, impressoEm: "2026-11-13T23:35:00.000Z" }

    expect(eventosDaMudanca(recebido, impresso, EM)).toEqual([{ tipo: "impresso", em: EM }])
    expect(eventosDaMudanca(impresso, { ...impresso, impressoEm: EM }, EM)).toEqual([
      { tipo: "impresso", em: EM },
    ])
  })

  test("sem mudança que importe, não há evento", () => {
    expect(eventosDaMudanca(recebido, { ...recebido, motoboyId: "m1" }, EM)).toEqual([])
  })
})

describe("linhaDoTempo", () => {
  test("começa na chegada e segue os eventos, com o nome de cada etapa no canal do pedido", () => {
    const retirada: Pedido = {
      ...recebido,
      tipo: "retirada",
      status: "concluido",
      criadoEm: "2026-11-13T23:02:00.000Z",
      historico: [
        { tipo: "etapa", status: "em-preparo", em: "2026-11-13T23:03:00.000Z" },
        { tipo: "impresso", em: "2026-11-13T23:03:30.000Z" },
        { tipo: "etapa", status: "pronto", em: "2026-11-13T23:21:00.000Z" },
        { tipo: "pago", em: "2026-11-13T23:30:00.000Z" },
        { tipo: "etapa", status: "concluido", em: "2026-11-13T23:30:00.000Z" },
      ],
    }

    expect(linhaDoTempo(retirada)).toEqual([
      { texto: "Pedido recebido", em: "2026-11-13T23:02:00.000Z" },
      { texto: "Em preparo", em: "2026-11-13T23:03:00.000Z" },
      { texto: "Cupom impresso", em: "2026-11-13T23:03:30.000Z" },
      { texto: "Pronto para retirada", em: "2026-11-13T23:21:00.000Z" },
      { texto: "Pagamento recebido", em: "2026-11-13T23:30:00.000Z" },
      { texto: "Retirado", em: "2026-11-13T23:30:00.000Z" },
    ])
  })

  test("pedido antigo, sem eventos, mostra só a chegada", () => {
    expect(linhaDoTempo({ ...recebido, historico: undefined })).toEqual([
      { texto: "Pedido recebido", em: recebido.criadoEm },
    ])
  })
})
