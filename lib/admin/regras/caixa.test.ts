import { describe, expect, test } from "vitest"
import type {
  ConfigLoja,
  FormaPagamento,
  MembroEquipe,
  Pedido,
  StatusPedido,
  TurnoCaixa,
} from "@/lib/admin/dados/tipos"
import {
  CEDULAS,
  conferir,
  configPdv,
  diferencaDinheiro,
  errosDoFechamento,
  errosDoFundo,
  errosDoMovimentoCaixa,
  podeOperarTurno,
  precisaSangria,
  type ResumoTurno,
  resumoDoTurno,
  totalDaContagem,
} from "./caixa"

let proximo = 1
function venda(
  pagamento: FormaPagamento,
  total: number,
  turnoId = "turno-1",
  status: StatusPedido = "concluido",
): Pedido {
  const id = proximo++
  return {
    id,
    numero: id,
    token: `t${id}`,
    origem: "pdv",
    tipo: "retirada",
    status,
    cliente: { nome: "Balcão", telefone: "" },
    itens: [],
    subtotal: total,
    desconto: 0,
    taxaEntrega: 0,
    total,
    pagamento,
    situacaoPagamento: "pago",
    criadoEm: "2026-11-13T12:00:00.000Z",
    atualizadoEm: "2026-11-13T12:00:00.000Z",
    enviarParaCozinha: false,
    turnoId,
    operadorId: "eq-marina",
  }
}

const turno: TurnoCaixa = {
  id: "turno-1",
  abertoPor: "eq-marina",
  abertoEm: "2026-11-13T11:00:00.000Z",
  fundo: 100,
  movimentos: [
    {
      id: "m1",
      tipo: "suprimento",
      valor: 50,
      motivo: "Reforço de moedas",
      feitoPor: "eq-marina",
      criadoEm: "2026-11-13T11:05:00.000Z",
    },
    {
      id: "m2",
      tipo: "sangria",
      valor: 300,
      motivo: "Retirada para o cofre",
      feitoPor: "eq-marina",
      autorizadoPor: "eq-gerente",
      criadoEm: "2026-11-13T15:00:00.000Z",
    },
  ],
}

const resumoCom = (dinheiroNaGaveta: number, dinheiro = 0): ResumoTurno => ({
  vendas: 0,
  total: 0,
  ticketMedio: 0,
  porForma: { dinheiro, pix: 0, "cartao-na-entrega": 0 },
  sangrias: 0,
  suprimentos: 0,
  dinheiroNaGaveta,
})

describe("contagem", () => {
  test("as cédulas e moedas, da maior para a menor", () => {
    expect(CEDULAS).toEqual([200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05])
  })

  test("soma a contagem por cédula", () => {
    // 1×100, 2×20, 1×10, 1×0,10 e 2×0,05
    expect(totalDaContagem([0, 1, 0, 2, 1, 0, 0, 0, 0, 0, 1, 2])).toBe(150.2)
  })

  test("contagem vazia dá zero", () => {
    expect(totalDaContagem([])).toBe(0)
  })
})

describe("resumoDoTurno", () => {
  test("dinheiro na gaveta = fundo + vendas em dinheiro + suprimentos − sangrias", () => {
    const pedidos = [
      venda("dinheiro", 400),
      venda("pix", 80),
      venda("dinheiro", 30, "turno-1", "cancelado"),
    ]
    expect(resumoDoTurno(turno, pedidos)).toEqual({
      vendas: 2,
      total: 480,
      ticketMedio: 240,
      porForma: { dinheiro: 400, pix: 80, "cartao-na-entrega": 0 },
      sangrias: 300,
      suprimentos: 50,
      dinheiroNaGaveta: 250,
    })
  })

  test("ignora vendas de outro turno", () => {
    const resumo = resumoDoTurno(turno, [venda("dinheiro", 10), venda("dinheiro", 99, "turno-2")])
    expect(resumo.vendas).toBe(1)
    expect(resumo.total).toBe(10)
  })

  test("sem vendas, o ticket médio é zero", () => {
    expect(resumoDoTurno({ ...turno, movimentos: [] }, []).ticketMedio).toBe(0)
  })

  test("soma em centavos exatos", () => {
    const resumo = resumoDoTurno({ ...turno, movimentos: [] }, [
      venda("dinheiro", 0.1),
      venda("dinheiro", 0.2),
    ])
    expect(resumo.porForma.dinheiro).toBe(0.3)
    expect(resumo.dinheiroNaGaveta).toBe(100.3)
  })
})

describe("configuração do PDV", () => {
  test("padrões do PDV", () => {
    expect(configPdv({} as ConfigLoja)).toEqual({ fundoSugerido: 100, alertaSangria: 500 })
  })

  test("usa a da loja quando existe", () => {
    const pdv = { fundoSugerido: 150, alertaSangria: 800 }
    expect(configPdv({ pdv } as ConfigLoja)).toEqual(pdv)
  })

  test("alerta de sangria só acima do limite", () => {
    const config = { fundoSugerido: 100, alertaSangria: 500 }
    expect(precisaSangria(resumoCom(500), config)).toBe(false)
    expect(precisaSangria(resumoCom(500.01), config)).toBe(true)
  })
})

describe("validações", () => {
  test("recusa movimento sem valor, sem motivo ou sangria maior que a gaveta", () => {
    const ok = { tipo: "sangria" as const, valor: 100, motivo: "Cofre" }
    expect(errosDoMovimentoCaixa({ ...ok, valor: 0 }, 120)).toBe("Informe um valor maior que zero.")
    expect(errosDoMovimentoCaixa({ ...ok, motivo: "ab" }, 120)).toBe("Diga o motivo.")
    expect(errosDoMovimentoCaixa({ ...ok, valor: 120.01 }, 120)).toBe("A gaveta só tem R$ 120,00.")
    expect(errosDoMovimentoCaixa(ok, 120)).toBeUndefined()
    expect(errosDoMovimentoCaixa({ ...ok, tipo: "suprimento", valor: 500 }, 120)).toBeUndefined()
  })

  test("fundo de 0 a 9.999", () => {
    const erro = "O fundo vai de R$ 0,00 a R$ 9.999,00."
    expect(errosDoFundo(-1)).toBe(erro)
    expect(errosDoFundo(10000)).toBe(erro)
    expect(errosDoFundo(0)).toBeUndefined()
    expect(errosDoFundo(9999)).toBeUndefined()
  })
})

describe("fechamento", () => {
  test("conferência: pix e cartão conciliados, dinheiro contado", () => {
    const resumo: ResumoTurno = {
      ...resumoCom(792.6),
      porForma: { dinheiro: 692.6, pix: 210.4, "cartao-na-entrega": 98.5 },
    }
    const conferencia = conferir(resumo, 790.6)
    expect(conferencia).toEqual({
      esperado: { dinheiro: 792.6, pix: 210.4, "cartao-na-entrega": 98.5 },
      contado: { dinheiro: 790.6, pix: 210.4, "cartao-na-entrega": 98.5 },
    })
    expect(diferencaDinheiro(conferencia)).toBe(-2)
  })

  test("diferença exige justificativa", () => {
    const resumo = resumoCom(792.6)
    expect(errosDoFechamento(conferir(resumo, 790.6))).toBe("Justifique a diferença de −R$ 2,00.")
    expect(errosDoFechamento(conferir(resumo, 795.6))).toBe("Justifique a diferença de +R$ 3,00.")
    expect(errosDoFechamento(conferir(resumo, 790.6, "Troc"))).toBe(
      "Justifique a diferença de −R$ 2,00.",
    )
    expect(errosDoFechamento(conferir(resumo, 790.6, "Troco a mais"))).toBeUndefined()
    expect(errosDoFechamento(conferir(resumo, 792.6))).toBeUndefined()
  })
})

describe("podeOperarTurno", () => {
  const membro = (id: string, perfil: MembroEquipe["perfil"]): MembroEquipe => ({
    id,
    nome: id,
    perfil,
    pin: "1111",
    ativo: true,
  })

  test("opera o turno quem abriu, o gerente ou o dono", () => {
    expect(podeOperarTurno(membro("eq-marina", "caixa"), turno)).toBe(true)
    expect(podeOperarTurno(membro("eq-joao", "caixa"), turno)).toBe(false)
    expect(podeOperarTurno(membro("eq-gerente", "gerente"), turno)).toBe(true)
    expect(podeOperarTurno(membro("eq-dono", "dono"), turno)).toBe(true)
  })
})
