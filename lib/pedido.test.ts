import { describe, expect, test } from "vitest"
import {
  codigoPix,
  descricaoDoTroco,
  etapasDoPedido,
  horario,
  previsaoDoPedido,
  situacaoDoPedido,
  tempoRestantePix,
} from "./pedido"
import type { Pedido } from "./sacola"

// Os testes rodam no horário de Brasília (vitest.config.mts). Tempos da loja vêm do mock:
// entrega "35–50 min", retirada "20–30 min".
const CRIADO = new Date("2026-11-08T21:00:00-03:00").getTime()
const depois = (segundos: number) => CRIADO + segundos * 1000

function pedido(mudancas: Partial<Pedido> = {}): Pedido {
  return {
    numero: 2234,
    itens: [],
    subtotal: 80,
    taxaEntrega: 8,
    total: 88,
    criadoEm: CRIADO,
    tipo: "entrega",
    pagamento: "pix",
    ...mudancas,
  }
}

describe("etapasDoPedido", () => {
  test("na entrega, o pedido sai para entrega e termina entregue", () => {
    expect(etapasDoPedido("entrega").map(({ titulo }) => titulo)).toEqual([
      "Pedido recebido",
      "Em preparo",
      "Saiu para entrega",
      "Entregue",
    ])
  })

  test("na retirada, o pedido fica pronto para retirar e termina retirado", () => {
    expect(etapasDoPedido("retirada")).toEqual([
      { titulo: "Pedido recebido", texto: "A loja já viu seu pedido." },
      { titulo: "Em preparo", texto: "Sua pizza está no forno a lenha." },
      { titulo: "Pronto para retirar", texto: "Pode vir buscar no balcão." },
      { titulo: "Retirado", texto: "Bom apetite! Obrigado pela preferência." },
    ])
  })

  test("pedido antigo, sem tipo, é tratado como entrega", () => {
    expect(etapasDoPedido(undefined)[2].titulo).toBe("Saiu para entrega")
  })
})

describe("horario", () => {
  test("mostra hora e minuto com dois dígitos", () => {
    expect(horario(CRIADO)).toBe("21:00")
    expect(horario(new Date("2026-11-09T08:05:00-03:00").getTime())).toBe("08:05")
  })
})

describe("previsaoDoPedido", () => {
  test("na entrega, soma o tempo de entrega da loja ao início", () => {
    expect(previsaoDoPedido("entrega", CRIADO)).toBe("21:35 – 21:50")
  })

  test("na retirada, soma o tempo de retirada", () => {
    expect(previsaoDoPedido("retirada", CRIADO)).toBe("21:20 – 21:30")
  })
})

describe("codigoPix", () => {
  test("monta o copia e cola com número do pedido, total e nome da loja", () => {
    expect(codigoPix(pedido({ numero: 2234, total: 88 }))).toBe(
      "00020126580014br.gov.bcb.pix0136demo-clickpedido-22345204000053039865406" +
        "88.005802BR5913Casa da Pizza6009SAO PAULO62070503***6304DEMO",
    )
  })

  test("o total vai sempre com duas casas", () => {
    expect(codigoPix(pedido({ total: 49.9 }))).toContain("540649.905802BR")
  })
})

describe("tempoRestantePix", () => {
  test("o Pix vale 30 minutos a partir do pedido", () => {
    expect(tempoRestantePix(CRIADO, CRIADO)).toBe("30:00")
    expect(tempoRestantePix(CRIADO, depois(61))).toBe("28:59")
  })

  test("depois do prazo, fica parado em zero", () => {
    expect(tempoRestantePix(CRIADO, depois(31 * 60))).toBe("00:00")
  })

  test("pedido sem horário conta a partir de agora", () => {
    expect(tempoRestantePix(undefined, CRIADO)).toBe("30:00")
  })
})

describe("situacaoDoPedido", () => {
  test("no Pix, espera 14 s pelo pagamento antes de começar as etapas", () => {
    expect(situacaoDoPedido(pedido(), depois(13))).toEqual({
      pago: false,
      atual: -1,
      concluido: false,
      atualNaLista: 0,
      momentos: [depois(14), depois(20), depois(30), depois(42)],
      pagamentoAcabouDeConfirmar: false,
      criadoEm: CRIADO,
    })
    expect(situacaoDoPedido(pedido(), depois(14))).toMatchObject({ pago: true, atual: 0 })
  })

  test("depois de pago, avança as etapas aos 6, 16 e 28 s", () => {
    expect(situacaoDoPedido(pedido(), depois(20)).atual).toBe(1)
    expect(situacaoDoPedido(pedido(), depois(30)).atual).toBe(2)
    expect(situacaoDoPedido(pedido(), depois(42))).toMatchObject({
      atual: 3,
      concluido: true,
      atualNaLista: 4,
    })
  })

  test("no cartão online, a confirmação leva 5 s", () => {
    const cartao = pedido({ pagamento: "cartao-online" })
    expect(situacaoDoPedido(cartao, depois(4)).pago).toBe(false)
    expect(situacaoDoPedido(cartao, depois(5))).toMatchObject({
      pago: true,
      atual: 0,
      momentos: [depois(5), depois(11), depois(21), depois(33)],
    })
  })

  test("pago na entrega, as etapas começam na hora", () => {
    for (const pagamento of ["dinheiro", "maquininha"] as const) {
      expect(situacaoDoPedido(pedido({ pagamento }), CRIADO)).toMatchObject({
        pago: true,
        atual: 0,
        momentos: [CRIADO, depois(6), depois(16), depois(28)],
        pagamentoAcabouDeConfirmar: false,
      })
    }
  })

  test("o aviso de pagamento aprovado fica 8 s na tela, só no pagamento online", () => {
    expect(situacaoDoPedido(pedido(), depois(14)).pagamentoAcabouDeConfirmar).toBe(true)
    expect(situacaoDoPedido(pedido(), depois(21)).pagamentoAcabouDeConfirmar).toBe(true)
    expect(situacaoDoPedido(pedido(), depois(22)).pagamentoAcabouDeConfirmar).toBe(false)
    expect(
      situacaoDoPedido(pedido({ pagamento: "cartao-online" }), depois(5))
        .pagamentoAcabouDeConfirmar,
    ).toBe(true)
  })

  test("pedido sem horário começa agora", () => {
    expect(situacaoDoPedido(pedido({ criadoEm: undefined }), CRIADO)).toMatchObject({
      criadoEm: CRIADO,
      pago: false,
    })
  })
})

describe("descricaoDoTroco", () => {
  test("mostra para quanto é o troco e quanto volta", () => {
    expect(descricaoDoTroco(100, 88)).toBe("Troco para R$ 100,00 (volta R$ 12,00)")
  })

  test("sem troco informado, diz que não precisa", () => {
    expect(descricaoDoTroco(null, 88)).toBe("Sem troco")
    expect(descricaoDoTroco(undefined, 88)).toBe("Sem troco")
  })

  test("troco zero conta como sem troco", () => {
    expect(descricaoDoTroco(0, 88)).toBe("Sem troco")
  })
})
