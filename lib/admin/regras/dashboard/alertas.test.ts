import { subMinutes } from "date-fns"
import { describe, expect, test } from "vitest"
import { catalogoDeTeste } from "../../dados/catalogo-de-teste"
import { pedidoDeTeste as pedido } from "../pedidos-de-teste"
import { alertasDoPainel, type EntradaAlertas } from "./alertas"

/** Sexta, 13/11/2026, 20:30. */
const AGORA = new Date(2026, 10, 13, 20, 30)
const minutosAtras = (minutos: number) => subMinutes(AGORA, minutos)

/** Loja aberta na mão, sem estoque, sem farmácia e sem meta: nada a avisar. */
function entrada(mudancas: Partial<EntradaAlertas> = {}): EntradaAlertas {
  return {
    segmento: "pizzaria",
    agora: AGORA,
    pedidos: [],
    produtos: [],
    loja: { ...catalogoDeTeste().loja, controleAutomatico: false, aberta: true },
    lotes: [],
    receitas: [],
    decisoes: {},
    meta: null,
    ...mudancas,
  }
}

describe("alertasDoPainel", () => {
  test("sem nada fora do normal, não há alerta", () => {
    expect(alertasDoPainel(entrada())).toEqual([])
  })

  test("pedido em andamento há 40 minutos ou mais está atrasado e leva para a fila", () => {
    const pedidos = [
      pedido(1, minutosAtras(45), 50, { status: "recebido", enviarParaCozinha: false }),
      pedido(2, minutosAtras(10), 50, { status: "em-preparo" }),
      pedido(3, minutosAtras(120), 50, { status: "concluido" }),
    ]

    expect(alertasDoPainel(entrada({ pedidos }))).toEqual([
      {
        id: "atrasados",
        texto: "1 pedido atrasado",
        acao: { rotulo: "Abrir a fila", href: "/admin/fila" },
      },
    ])
  })

  test("na cozinha, o pedido fica atrasado a partir de 25 minutos", () => {
    // Entrega: o prazo prometido (40 min) ainda não passou; só a cozinha atrasou.
    const pedidos = [
      pedido(1, minutosAtras(30), 50, {
        tipo: "entrega",
        status: "em-preparo",
        enviarParaCozinha: true,
      }),
      pedido(2, minutosAtras(30), 50, {
        tipo: "entrega",
        status: "pronto",
        enviarParaCozinha: true,
      }),
    ]

    expect(alertasDoPainel(entrada({ pedidos }))[0]?.texto).toBe("1 pedido atrasado")
  })

  test("pagamento online pendente há mais de 15 minutos leva para os pedidos aguardando", () => {
    const pedidos = [
      pedido(1, minutosAtras(16), 50, { status: "aguardando-pagamento" }),
      pedido(2, minutosAtras(20), 50, { status: "aguardando-pagamento" }),
      pedido(3, minutosAtras(15), 50, { status: "aguardando-pagamento" }),
    ]

    expect(alertasDoPainel(entrada({ pedidos }))).toEqual([
      {
        id: "pagamento-pendente",
        texto: "2 pagamentos online pendentes há mais de 15 min",
        acao: { rotulo: "Ver pedidos", href: "/admin/pedidos?status=aguardando-pagamento" },
      },
    ])
  })

  test("loja fechada na mão no horário em que devia abrir", () => {
    const horarios = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
      dia,
      aberto: true,
      abre: "18:00",
      fecha: "23:00",
    }))
    const fechada = { ...entrada().loja, horarios, controleAutomatico: false, aberta: false }

    expect(alertasDoPainel(entrada({ loja: fechada }))).toEqual([
      {
        id: "loja-fechada",
        texto: "A loja está fechada no horário de funcionamento",
        acao: { rotulo: "Configurações da loja", href: "/admin/loja" },
      },
    ])
    // Fora do horário, fechada é o normal.
    const madrugada = new Date(2026, 10, 13, 3)
    expect(alertasDoPainel(entrada({ loja: fechada, agora: madrugada }))).toEqual([])
  })

  test("estoque zerado (ou negativo) e estoque baixo viram dois alertas, só nos controlados", () => {
    const base = catalogoDeTeste().produtos[0]
    const comEstoque = (id: string, quantidade: number, controlar = true) => ({
      ...base,
      id,
      estoque: { controlar, quantidade, minimo: 3, esgotarAoZerar: true },
    })
    const produtos = [
      comEstoque("zerado", 0),
      comEstoque("negativo", -2),
      comEstoque("no-minimo", 3),
      comEstoque("folgado", 10),
      comEstoque("sem-controle", 0, false),
    ]

    expect(alertasDoPainel(entrada({ produtos }))).toEqual([
      {
        id: "estoque-zerado",
        texto: "2 produtos zerados no estoque",
        acao: { rotulo: "Ver estoque", href: "/admin/estoque" },
      },
      {
        id: "estoque-baixo",
        texto: "1 produto com estoque baixo",
        acao: { rotulo: "Ver estoque", href: "/admin/estoque" },
      },
    ])
  })

  test("lote vencido ou que vence em até 30 dias, com saldo, leva para lotes e validade", () => {
    const lote = (id: string, validade: string, quantidade = 5) => ({
      id,
      produtoId: "dipirona",
      codigo: id,
      validade,
      quantidade,
      minimo: 1,
    })
    const lotes = [
      lote("vencido", "2026-11-01"),
      lote("vence-logo", "2026-12-10"),
      lote("vence-depois", "2027-01-30"),
      lote("vencido-sem-saldo", "2026-10-01", 0),
    ]

    expect(alertasDoPainel(entrada({ segmento: "farmacia", lotes }))).toEqual([
      {
        id: "lotes",
        texto: "2 lotes vencidos ou vencendo em 30 dias",
        acao: { rotulo: "Ver lotes", href: "/admin/validade" },
      },
    ])
  })

  test("receita sem decisão do farmacêutico espera conferência", () => {
    const receita = (id: string) => ({
      id,
      recebidaEm: AGORA.toISOString(),
      canal: "site" as const,
      paciente: { nome: "Ana", telefone: "12991230000" },
      prescritor: { nome: "Dr. Leo", conselho: "CRM" as const, numero: "123", uf: "SP" },
      tipo: "simples" as const,
      emitidaEm: "2026-11-10",
      itens: [],
    })
    const receitas = [receita("r1"), receita("r2"), receita("r3")]

    expect(
      alertasDoPainel(entrada({ segmento: "farmacia", receitas, decisoes: { r2: {} } })),
    ).toEqual([
      {
        id: "receitas",
        texto: "2 receitas esperando conferência",
        acao: { rotulo: "Conferir receitas", href: "/admin/receitas" },
      },
    ])
  })

  test("pedido em aberto que ainda falta pesar leva para a fila", () => {
    const porQuilo = {
      id: "picanha",
      produtoId: "picanha",
      nome: "Picanha",
      quantidade: 1,
      precoUnitario: 90,
      opcoes: [],
      total: 90,
      pesoGramas: 1000,
      precoKg: 90,
    }
    const naBalanca = (id: number, mudancas = {}) =>
      pedido(id, minutosAtras(5), 90, {
        status: "recebido",
        pagamento: "pagar-apos-pesagem",
        itens: [porQuilo],
        ...mudancas,
      })
    const pedidos = [
      naBalanca(1),
      naBalanca(2, { pesagem: { totalEstimado: 90, diferenca: 0, pesadoEm: AGORA.toISOString() } }),
      naBalanca(3, { status: "cancelado" }),
    ]

    expect(alertasDoPainel(entrada({ segmento: "acougue", pedidos }))).toEqual([
      {
        id: "pesagem",
        texto: "1 pedido esperando pesagem",
        acao: { rotulo: "Abrir a fila", href: "/admin/fila" },
      },
    ])
  })

  test("meta de hoje em risco aparece por último e leva ao bloco da meta", () => {
    const meta = {
      mes: { meta: 30_000, realizado: 10_300, percentual: 34.3 },
      hoje: { meta: 1333.33, realizado: 300 },
      projecao: 25_000,
      emRisco: true,
      pedidos: null,
    }
    const pedidos = [pedido(1, minutosAtras(50), 50, { status: "recebido" })]

    expect(alertasDoPainel(entrada({ pedidos, meta })).map((alerta) => alerta.id)).toEqual([
      "atrasados",
      "meta-em-risco",
    ])
    expect(alertasDoPainel(entrada({ meta })).at(-1)).toEqual({
      id: "meta-em-risco",
      // O Intl separa o R$ com espaço não separável.
      texto: "A meta de hoje está em risco: faltam R$ 1.033,33",
      acao: { rotulo: "Ver a meta", href: "#meta" },
    })
    expect(alertasDoPainel(entrada({ meta: { ...meta, emRisco: false } }))).toEqual([])
  })
})
