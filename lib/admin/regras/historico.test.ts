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

  test("aceitar vira evento de aceito; recusar não conta como aceito", () => {
    const esperando: Pedido = { ...recebido, esperaAceite: true }

    expect(eventosDaMudanca(esperando, { ...esperando, esperaAceite: false }, EM)).toEqual([
      { tipo: "aceito", em: EM },
    ])
    const recusado: Pedido = { ...esperando, esperaAceite: false, status: "cancelado" }
    expect(eventosDaMudanca(esperando, recusado, EM)).toEqual([
      { tipo: "etapa", status: "cancelado", em: EM },
    ])
  })

  test("sem mudança que importe, não há evento", () => {
    expect(eventosDaMudanca(recebido, { ...recebido, motoboyId: "m1" }, EM)).toEqual([])
  })
})

describe("linhaDoTempo", () => {
  test("o aviso ao cliente entra com o texto que teria saído", () => {
    const avisado: Pedido = {
      ...recebido,
      criadoEm: "2026-11-13T23:02:00.000Z",
      historico: [{ tipo: "aviso", em: "2026-11-13T23:05:00.000Z", texto: "Olá, Ana! Saiu." }],
    }
    expect(linhaDoTempo(avisado).at(-1)).toEqual({
      texto: "Cliente avisado no WhatsApp: “Olá, Ana! Saiu.”",
      em: "2026-11-13T23:05:00.000Z",
    })
  })

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

  test("o aceite aparece como pedido aceito", () => {
    const aceito: Pedido = { ...recebido, historico: [{ tipo: "aceito", em: EM }] }
    expect(linhaDoTempo(aceito)[1]).toEqual({ texto: "Pedido aceito", em: EM })
  })

  test("recusa e cancelamento aparecem com o motivo", () => {
    const evento = { tipo: "etapa", status: "cancelado", em: EM } as const
    const recusado: Pedido = {
      ...recebido,
      status: "cancelado",
      historico: [evento],
      cancelamento: { tipo: "recusa", motivo: "fora-da-area", em: EM },
    }
    expect(linhaDoTempo(recusado)[1].texto).toBe("Recusado: Fora da área de entrega")

    const outro: Pedido = {
      ...recusado,
      cancelamento: { tipo: "cancelamento", motivo: "outro", detalhe: "Acabou o gás", em: EM },
    }
    expect(linhaDoTempo(outro)[1].texto).toBe("Cancelado: Acabou o gás")

    const noSalao: Pedido = {
      ...recusado,
      tipo: "atendimento",
      cancelamento: { tipo: "recusa", motivo: "loja-cheia", em: EM },
    }
    expect(linhaDoTempo(noSalao)[1].texto).toBe("Recusado: Agenda cheia")
  })

  test("pedido antigo, sem eventos, mostra só a chegada", () => {
    expect(linhaDoTempo({ ...recebido, historico: undefined })).toEqual([
      { texto: "Pedido recebido", em: recebido.criadoEm },
    ])
  })
})
