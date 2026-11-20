import { describe, expect, test } from "vitest"
import type {
  DadosMedicamento,
  Lote,
  MovimentoControlado,
  Pedido,
  Produto,
  Receita,
} from "../dados/tipos"
import {
  conferirReceita,
  controladosDoPedido,
  receitaDoPedido,
  receitaExigida,
  saidasDaReceita,
  saldosControlados,
  situacaoDaReceita,
  situacaoDoLote,
} from "./farmacia"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const medicamento = (dados: Partial<DadosMedicamento>): DadosMedicamento => ({
  tarja: "vermelha",
  tipo: "generico",
  principioAtivo: "Losartana potássica",
  apresentacao: "50 mg, 30 comprimidos",
  laboratorio: "EMS",
  registroMs: "1023505830017",
  ...dados,
})

describe("receitaExigida", () => {
  test("sem tarja é venda livre: não pede receita", () => {
    expect(receitaExigida(medicamento({ tarja: "sem-tarja" }))).toBeNull()
  })

  test("tarja vermelha sem lista pede receita simples", () => {
    expect(receitaExigida(medicamento({ tarja: "vermelha" }))).toBe("simples")
  })

  test("antimicrobiano pede a receita de antimicrobiano", () => {
    expect(
      receitaExigida(medicamento({ tarja: "vermelha-retencao", lista: "antimicrobiano" })),
    ).toBe("antimicrobiano")
  })

  test("lista C1 pede receita de controle especial", () => {
    expect(receitaExigida(medicamento({ tarja: "vermelha-retencao", lista: "C1" }))).toBe(
      "controle-especial",
    )
  })

  test("listas B pedem a notificação azul; listas A, a amarela", () => {
    expect(receitaExigida(medicamento({ tarja: "preta", lista: "B1" }))).toBe("notificacao-b")
    expect(receitaExigida(medicamento({ tarja: "preta", lista: "B2" }))).toBe("notificacao-b")
    expect(receitaExigida(medicamento({ tarja: "preta", lista: "A3" }))).toBe("notificacao-a")
    expect(receitaExigida(medicamento({ tarja: "preta", lista: "A1" }))).toBe("notificacao-a")
  })
})

describe("situacaoDaReceita", () => {
  const agora = new Date(2026, 10, 13, 20, 30)

  test("antimicrobiano vale 10 dias a partir da emissão", () => {
    expect(situacaoDaReceita("antimicrobiano", "2026-11-03", agora)).toEqual({
      estado: "valida",
      validaAte: "2026-11-13",
      diasRestantes: 0,
    })
    expect(situacaoDaReceita("antimicrobiano", "2026-11-02", agora)).toEqual({
      estado: "vencida",
      validaAte: "2026-11-12",
      diasRestantes: -1,
    })
  })

  test("controle especial e notificações valem 30 dias", () => {
    expect(situacaoDaReceita("controle-especial", "2026-10-20", agora)).toEqual({
      estado: "valida",
      validaAte: "2026-11-19",
      diasRestantes: 6,
    })
    expect(situacaoDaReceita("notificacao-b", "2026-10-10", agora).estado).toBe("vencida")
    expect(situacaoDaReceita("notificacao-a", "2026-11-01", agora)).toMatchObject({
      validaAte: "2026-12-01",
    })
  })

  test("a receita simples não tem prazo fixo: fica a critério do farmacêutico", () => {
    expect(situacaoDaReceita("simples", "2026-01-15", agora)).toEqual({ estado: "sem-prazo" })
  })
})

describe("conferirReceita", () => {
  const agora = new Date(2026, 10, 13, 20, 30)
  const produto = (id: string, nome: string, dados?: Partial<DadosMedicamento>): Produto => ({
    id,
    categoriaId: "cat-medicamentos",
    nome,
    descricao: "",
    preco: 10,
    ativo: true,
    disponivel: true,
    destaque: false,
    oferta: false,
    ordem: 1,
    unidade: "un",
    grupos: [],
    ...(dados ? { medicamento: medicamento(dados) } : {}),
  })
  const produtos = [
    produto("amoxicilina", "Amoxicilina 500 mg", {
      tarja: "vermelha-retencao",
      lista: "antimicrobiano",
    }),
    produto("clonazepam", "Clonazepam 2 mg", { tarja: "preta", lista: "B1" }),
    produto("losartana", "Losartana 50 mg", { tarja: "vermelha" }),
    produto("protetor", "Protetor solar FPS 50"),
  ]
  const receita = (dados: Partial<Receita>): Receita => ({
    id: "rec-1",
    recebidaEm: "2026-11-13T19:00:00-03:00",
    canal: "site",
    paciente: { nome: "Ana Souza", telefone: "12991112233" },
    prescritor: { nome: "Dr. Paulo Lima", conselho: "CRM", numero: "123456", uf: "SP" },
    tipo: "antimicrobiano",
    emitidaEm: "2026-11-10",
    itens: [{ produtoId: "amoxicilina", quantidade: 1, posologia: "1 a cada 8 horas" }],
    ...dados,
  })

  test("receita em dia, do tipo certo e com CRM completo não tem pendência", () => {
    expect(conferirReceita(receita({}), produtos, agora)).toEqual([])
  })

  test("avisa a receita vencida, com a data", () => {
    expect(conferirReceita(receita({ emitidaEm: "2026-11-01" }), produtos, agora)).toEqual([
      "Receita vencida em 11/11/2026.",
    ])
  })

  test("avisa o remédio que pede outro receituário", () => {
    const pedida = receita({
      tipo: "simples",
      itens: [
        { produtoId: "clonazepam", quantidade: 1, posologia: "1 à noite" },
        { produtoId: "losartana", quantidade: 1, posologia: "1 pela manhã" },
        { produtoId: "protetor", quantidade: 1, posologia: "" },
      ],
    })
    expect(conferirReceita(pedida, produtos, agora)).toEqual([
      "Clonazepam 2 mg exige Notificação de receita B.",
    ])
  })

  test("avisa o registro do prescritor incompleto", () => {
    const pedida = receita({
      prescritor: { nome: "Dra. Lia", conselho: "CRM", numero: "12", uf: "XX" },
    })
    expect(conferirReceita(pedida, produtos, agora)).toEqual([
      "Confira o registro do prescritor (CRM 12/XX).",
    ])
  })
})

describe("situacaoDoLote", () => {
  const agora = new Date(2026, 10, 13, 20, 30)
  const lote = (validade: string, quantidade = 20, minimo = 5): Lote => ({
    id: "lote-1",
    produtoId: "dipirona",
    codigo: "DP2611A",
    validade,
    quantidade,
    minimo,
  })

  test("vencido no dia seguinte à validade", () => {
    expect(situacaoDoLote(lote("2026-11-12"), agora).validade).toBe("vencido")
    expect(situacaoDoLote(lote("2026-11-13"), agora).validade).toBe("vence-em-30")
  })

  test("separa o que vence em 30 dias, em 90 dias e o que está em dia", () => {
    expect(situacaoDoLote(lote("2026-12-13"), agora).validade).toBe("vence-em-30")
    expect(situacaoDoLote(lote("2026-12-14"), agora).validade).toBe("vence-em-90")
    expect(situacaoDoLote(lote("2027-02-11"), agora).validade).toBe("vence-em-90")
    expect(situacaoDoLote(lote("2027-02-12"), agora).validade).toBe("em-dia")
  })

  test("estoque baixo quando chega no mínimo", () => {
    expect(situacaoDoLote(lote("2027-06-01", 5, 5), agora).estoqueBaixo).toBe(true)
    expect(situacaoDoLote(lote("2027-06-01", 6, 5), agora).estoqueBaixo).toBe(false)
  })
})

describe("saldosControlados", () => {
  const movimento = (
    produtoId: string,
    tipo: MovimentoControlado["tipo"],
    quantidade: number,
  ): MovimentoControlado => ({
    id: `${produtoId}-${tipo}-${quantidade}`,
    produtoId,
    em: "2026-11-10T10:00:00-03:00",
    tipo,
    quantidade,
    documento: "NF 1020",
  })

  test("entradas somam; saídas e perdas tiram, por produto", () => {
    const saldos = saldosControlados([
      movimento("clonazepam", "entrada", 30),
      movimento("clonazepam", "saida", 2),
      movimento("clonazepam", "perda", 1),
      movimento("amoxicilina", "entrada", 12),
      movimento("amoxicilina", "saida", 3),
    ])
    expect(saldos).toEqual({ clonazepam: 27, amoxicilina: 9 })
  })
})

describe("saidasDaReceita", () => {
  const controlado = (id: string, dados?: Partial<DadosMedicamento>): Produto => ({
    id,
    categoriaId: "cat-1",
    nome: id,
    descricao: "",
    preco: 10,
    ativo: true,
    disponivel: true,
    destaque: false,
    oferta: false,
    ordem: 1,
    unidade: "un",
    grupos: [],
    ...(dados ? { medicamento: medicamento(dados) } : {}),
  })

  test("só os controlados e antimicrobianos entram na escrituração, com paciente e prescritor", () => {
    const produtos = [
      controlado("clonazepam", { tarja: "preta", lista: "B1" }),
      controlado("losartana", { tarja: "vermelha" }),
      controlado("amoxicilina", { tarja: "vermelha-retencao", lista: "antimicrobiano" }),
    ]
    const receita: Receita = {
      id: "rec-1002",
      recebidaEm: "2026-11-13T19:00:00-03:00",
      canal: "whatsapp",
      paciente: { nome: "Bruno Carvalho", telefone: "12938359086" },
      prescritor: { nome: "Dra. Helena Prado", conselho: "CRM", numero: "98314", uf: "SP" },
      tipo: "notificacao-b",
      emitidaEm: "2026-11-08",
      itens: [
        { produtoId: "clonazepam", quantidade: 2, posologia: "" },
        { produtoId: "losartana", quantidade: 1, posologia: "" },
        { produtoId: "amoxicilina", quantidade: 1, posologia: "" },
      ],
    }
    expect(saidasDaReceita(receita, produtos, "2026-11-13T20:30:00.000Z")).toEqual([
      {
        id: "rec-1002-clonazepam",
        produtoId: "clonazepam",
        em: "2026-11-13T20:30:00.000Z",
        tipo: "saida",
        quantidade: 2,
        documento: "Notificação de receita B rec-1002",
        paciente: "Bruno Carvalho",
        prescritor: "CRM 98314/SP",
      },
      {
        id: "rec-1002-amoxicilina",
        produtoId: "amoxicilina",
        em: "2026-11-13T20:30:00.000Z",
        tipo: "saida",
        quantidade: 1,
        documento: "Notificação de receita B rec-1002",
        paciente: "Bruno Carvalho",
        prescritor: "CRM 98314/SP",
      },
    ])
  })
})

describe("receita e controlado no pedido", () => {
  const produto = (id: string, dados: Partial<DadosMedicamento> | null): Produto =>
    ({ id, nome: id, ...(dados ? { medicamento: medicamento(dados) } : {}) }) as Produto
  const PRODUTOS = [
    produto("dipirona", { tarja: "sem-tarja" }),
    produto("losartana", { tarja: "vermelha" }),
    produto("amoxicilina", { tarja: "vermelha-retencao", lista: "antimicrobiano" }),
    produto("metilfenidato", { tarja: "preta", lista: "A3" }),
    produto("shampoo", null),
  ]
  const com = (...ids: string[]): Pedido => ({
    ...PEDIDOS_DE_TESTE[2],
    itens: ids.map((id) => ({
      id,
      produtoId: id,
      nome: id,
      quantidade: 1,
      precoUnitario: 10,
      opcoes: [],
      total: 10,
    })),
  })

  test("pede receita quando algum item pede; vale o receituário mais exigente", () => {
    expect(receitaDoPedido(com("dipirona", "shampoo"), PRODUTOS)).toBeNull()
    expect(receitaDoPedido(com("losartana", "shampoo"), PRODUTOS)).toBe("simples")
    expect(receitaDoPedido(com("losartana", "amoxicilina"), PRODUTOS)).toBe("antimicrobiano")
    expect(receitaDoPedido(com("amoxicilina", "metilfenidato"), PRODUTOS)).toBe("notificacao-a")
  })

  test("controlado é o da Portaria 344 (listas A, B e C); antimicrobiano não é", () => {
    expect(controladosDoPedido(com("amoxicilina", "losartana"), PRODUTOS)).toEqual([])
    expect(controladosDoPedido(com("metilfenidato", "dipirona"), PRODUTOS)).toEqual([
      "metilfenidato",
    ])
  })
})
