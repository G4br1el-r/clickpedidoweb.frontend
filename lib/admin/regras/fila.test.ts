import { describe, expect, test } from "vitest"
import type { Pedido, StatusPedido, TipoPedido } from "../dados/tipos"
import { colunasDaFila, novosPedidos, resumoDaFila, textoCobranca, urgencia } from "./fila"
import { AGORA_DE_TESTE as AGORA, PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const base = PEDIDOS_DE_TESTE[2]
function pedido(
  id: number,
  status: StatusPedido,
  minutosAtras: number,
  tipo: TipoPedido = "entrega",
): Pedido {
  const criadoEm = new Date(AGORA.getTime() - minutosAtras * 60_000).toISOString()
  return { ...base, id, numero: id, status, tipo, criadoEm, atualizadoEm: criadoEm }
}

const FILA = [
  pedido(10, "recebido", 3),
  pedido(11, "recebido", 9, "retirada"),
  pedido(12, "em-preparo", 20),
  pedido(13, "pronto", 35, "mesa"),
  pedido(14, "saiu-para-entrega", 50),
  pedido(15, "concluido", 90),
  pedido(16, "aguardando-pagamento", 1),
]

const resumo = (colunas: ReturnType<typeof colunasDaFila>) =>
  colunas.map((coluna) => [coluna.titulo, coluna.pedidos.map((item) => item.id)])

describe("colunasDaFila", () => {
  test("comida: novos, em preparo, prontos e a caminho, do mais antigo ao mais novo", () => {
    expect(resumo(colunasDaFila(FILA, "pizzaria", AGORA))).toEqual([
      ["Novos", [11, 10]],
      ["Em preparo", [12]],
      ["Prontos", [13]],
      ["A caminho", [14]],
    ])
  })

  test("quem espera aceite abre a coluna Novos, do mais antigo ao mais novo", () => {
    const esperando = (id: number, minutosAtras: number): Pedido => ({
      ...pedido(id, "recebido", minutosAtras),
      esperaAceite: true,
    })
    const fila = [...FILA, esperando(30, 1), esperando(31, 2)]
    expect(resumo(colunasDaFila(fila, "pizzaria", AGORA))[0]).toEqual(["Novos", [31, 30, 11, 10]])
  })

  test("salão: agendados de hoje pela hora marcada e em atendimento", () => {
    const marcado = (id: number, status: StatusPedido, inicio: Date): Pedido => ({
      ...pedido(id, status, 60 * 24, "atendimento"),
      agendamento: { inicio: inicio.toISOString(), duracaoMin: 60 },
    })
    const agenda = [
      marcado(20, "recebido", new Date(2026, 10, 13, 21, 30)),
      marcado(21, "recebido", new Date(2026, 10, 13, 20, 45)),
      marcado(22, "recebido", new Date(2026, 10, 14, 10, 0)),
      marcado(23, "em-preparo", new Date(2026, 10, 13, 20, 0)),
      marcado(24, "em-preparo", new Date(2026, 10, 13, 19, 30)),
    ]
    expect(resumo(colunasDaFila(agenda, "salao", AGORA))).toEqual([
      ["Agendados", [21, 20]],
      ["Em atendimento", [24, 23]],
    ])
  })

  test("salão: quem ficou para trás de um dia anterior continua em Agendados, atrasado", () => {
    const ontem: Pedido = {
      ...pedido(25, "recebido", 60 * 30, "atendimento"),
      agendamento: { inicio: new Date(2026, 10, 12, 15, 0).toISOString(), duracaoMin: 60 },
    }
    const hoje: Pedido = {
      ...pedido(26, "recebido", 60, "atendimento"),
      agendamento: { inicio: new Date(2026, 10, 13, 21, 0).toISOString(), duracaoMin: 60 },
    }
    const [agendados] = colunasDaFila([hoje, ontem], "salao", AGORA)
    expect(agendados.pedidos.map((item) => item.id)).toEqual([25, 26])
    expect(urgencia(ontem, AGORA)).toBe("atrasado")
  })
})

describe("urgencia", () => {
  test("âmbar a partir de 25 minutos e vermelho a partir de 40", () => {
    expect(urgencia(pedido(1, "recebido", 24), AGORA)).toBe("normal")
    expect(urgencia(pedido(1, "em-preparo", 25), AGORA)).toBe("atencao")
    expect(urgencia(pedido(1, "pronto", 40), AGORA)).toBe("atrasado")
  })

  test("no salão, atrasa quem passou da hora marcada e não começou", () => {
    const atrasado = {
      ...pedido(1, "recebido", 120, "atendimento"),
      agendamento: { inicio: new Date(2026, 10, 13, 20, 0).toISOString(), duracaoMin: 60 },
    }
    expect(urgencia(atrasado, AGORA)).toBe("atrasado")
  })
})

describe("textoCobranca", () => {
  test("pago, a cobrar com troco e aguardando pagamento online", () => {
    expect(textoCobranca({ ...base, situacaoPagamento: "pago", pagamento: "pix" })).toBe(
      "Pago · Pix",
    )
    expect(
      textoCobranca({
        ...base,
        total: 51,
        situacaoPagamento: "na-entrega",
        pagamento: "dinheiro",
        trocoPara: 100,
      }),
    ).toBe("Cobrar R$ 51,00 · Dinheiro · troco para R$ 100,00")
    expect(
      textoCobranca({
        ...base,
        total: 51,
        situacaoPagamento: "na-entrega",
        pagamento: "cartao-na-entrega",
      }),
    ).toBe("Cobrar R$ 51,00 · Cartão na maquininha")
    expect(textoCobranca({ ...base, situacaoPagamento: "pendente", pagamento: "pix" })).toBe(
      "Aguardando pagamento · Pix",
    )
  })
})

describe("novosPedidos", () => {
  test("pedidos novos que ainda não estavam na fila", () => {
    expect(novosPedidos(new Set([10]), FILA)).toEqual([11])
  })
})

describe("resumoDaFila", () => {
  test("em andamento, concluídos hoje e aguardando pagamento", () => {
    expect(resumoDaFila(FILA, "pizzaria", AGORA)).toEqual({
      emAndamento: 5,
      concluidosHoje: 1,
      aguardandoPagamento: 1,
    })
  })
})
