import { describe, expect, test } from "vitest"
import type { Pedido, StatusPedido, TipoPedido } from "../dados/tipos"
import {
  colunasDaFila,
  finalizadosHoje,
  novosPedidos,
  pedidosDeDiasAnteriores,
  resumoDaFila,
  resumoDosItens,
  textoCobranca,
  urgencia,
} from "./fila"
import { AGORA_DE_TESTE as AGORA, PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const base = PEDIDOS_DE_TESTE[2]
const LOJA = { tempoEntrega: "40–60 min", tempoRetirada: "20 min" }
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
    expect(urgencia(ontem, AGORA, LOJA)).toBe("atrasado")
  })
})

describe("mesa servida", () => {
  test("a mesa pronta fica em Prontos até ser servida; servida, sai da fila", () => {
    const pronta = pedido(30, "pronto", 20, "mesa")
    const servida = { ...pedido(31, "pronto", 20, "mesa"), servidoEm: AGORA.toISOString() }
    const [, , prontos] = colunasDaFila([pronta, servida], "pizzaria", AGORA)
    expect(prontos.pedidos.map((item) => item.id)).toEqual([30])
  })
})

describe("pedidos de dias anteriores", () => {
  /** Criado ontem às 21:00, ainda em andamento. */
  const deOntem = (id: number, status: StatusPedido, tipo: TipoPedido = "entrega"): Pedido =>
    pedido(id, status, 60 * 23 + 30, tipo)

  test("o que ficou em andamento de outro dia sai das colunas e vai para o aviso", () => {
    const fila = [...FILA, deOntem(40, "em-preparo"), deOntem(41, "recebido")]

    expect(pedidosDeDiasAnteriores(fila, AGORA).map((item) => item.id)).toEqual([40, 41])
    expect(resumo(colunasDaFila(fila, "pizzaria", AGORA))).toEqual([
      ["Novos", [11, 10]],
      ["Em preparo", [12]],
      ["Prontos", [13]],
      ["A caminho", [14]],
    ])
  })

  test("concluído, cancelado e aguardando pagamento de outro dia não entram no aviso", () => {
    const fila = [
      deOntem(42, "concluido"),
      deOntem(43, "cancelado"),
      deOntem(44, "aguardando-pagamento"),
    ]
    expect(pedidosDeDiasAnteriores(fila, AGORA)).toEqual([])
  })

  test("açougue: retirada marcada para hoje ou depois continua na fila", () => {
    const paraHoje = { ...deOntem(45, "recebido", "retirada"), dataRetirada: "2026-11-13" }
    const paraOntem = { ...deOntem(46, "recebido", "retirada"), dataRetirada: "2026-11-12" }

    expect(pedidosDeDiasAnteriores([paraHoje, paraOntem], AGORA)).toEqual([paraOntem])
    expect(colunasDaFila([paraHoje, paraOntem], "acougue", AGORA)[0].pedidos).toEqual([paraHoje])
  })

  test("salão: agendamento de outro dia fica na coluna, atrasado, e não no aviso", () => {
    const marcadoOntem: Pedido = {
      ...deOntem(47, "recebido", "atendimento"),
      agendamento: { inicio: new Date(2026, 10, 12, 15, 0).toISOString(), duracaoMin: 60 },
    }
    expect(pedidosDeDiasAnteriores([marcadoOntem], AGORA)).toEqual([])
  })
})

describe("urgencia", () => {
  test("pelo prazo prometido: âmbar nos 10 últimos minutos e vermelho quando passa", () => {
    // Entrega em até 60 min; retirada em até 20.
    expect(urgencia(pedido(1, "recebido", 49), AGORA, LOJA)).toBe("normal")
    expect(urgencia(pedido(1, "em-preparo", 50), AGORA, LOJA)).toBe("atencao")
    expect(urgencia(pedido(1, "pronto", 60), AGORA, LOJA)).toBe("atrasado")
    expect(urgencia(pedido(1, "recebido", 9, "retirada"), AGORA, LOJA)).toBe("normal")
    expect(urgencia(pedido(1, "recebido", 10, "retirada"), AGORA, LOJA)).toBe("atencao")
  })

  test("a retirada marcada para um dia não atrasa pelo relógio", () => {
    const marcada = { ...pedido(1, "recebido", 300, "retirada"), dataRetirada: "2026-11-13" }
    expect(urgencia(marcada, AGORA, LOJA)).toBe("normal")
  })

  test("no salão, atrasa quem passou da hora marcada e não começou", () => {
    const atrasado = {
      ...pedido(1, "recebido", 120, "atendimento"),
      agendamento: { inicio: new Date(2026, 10, 13, 20, 0).toISOString(), duracaoMin: 60 },
    }
    expect(urgencia(atrasado, AGORA, LOJA)).toBe("atrasado")
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

describe("resumoDosItens", () => {
  test("soma as quantidades e mostra o total do pedido", () => {
    const comItens = (quantidades: number[]): Pedido => ({
      ...base,
      total: 137,
      itens: quantidades.map((quantidade, indice) => ({
        ...base.itens[0],
        id: String(indice),
        quantidade,
      })),
    })
    // O Intl separa "R$" do valor com espaço não separável.
    expect(resumoDosItens(comItens([2, 1]))).toBe("3 itens · R$ 137,00")
    expect(resumoDosItens(comItens([1]))).toBe("1 item · R$ 137,00")
  })
})

describe("finalizadosHoje", () => {
  test("concluídos e cancelados de hoje, sem repetir, do mais recente ao mais antigo", () => {
    const fechou = (id: number, status: StatusPedido, minutosAtras: number): Pedido => ({
      ...pedido(id, status, 90),
      atualizadoEm: new Date(AGORA.getTime() - minutosAtras * 60_000).toISOString(),
    })
    const concluidos = [fechou(1, "concluido", 30), fechou(2, "concluido", 5)]
    const criadosHoje = [
      fechou(2, "concluido", 5),
      fechou(3, "cancelado", 10),
      fechou(4, "pronto", 1),
    ]
    expect(finalizadosHoje(concluidos, criadosHoje).map((item) => item.id)).toEqual([2, 3, 1])
  })
})
