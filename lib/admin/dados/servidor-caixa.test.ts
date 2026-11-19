import "fake-indexeddb/auto"
import { clear } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor } from "./servidor"

/** Sexta, 13/11/2026, 20:30 em São Paulo. */
const AGORA = new Date(2026, 10, 13, 20, 30)

const servidor = () =>
  criarServidor({
    segmento: "pizzaria",
    carregarCatalogo: async () => catalogoDeTeste(),
    espera: 0,
  })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA)
  await clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("equipe", () => {
  test("a base nova traz a equipe de demonstração e turnos fechados", async () => {
    const api = servidor()
    expect((await api.equipe.listar()).map((membro) => membro.nome)).toEqual([
      "Carla N.",
      "Rafael M.",
      "Marina S.",
      "João P.",
    ])
    const { turnos } = await api.base()
    expect(turnos.length).toBeGreaterThan(10)
    expect(turnos.every((turno) => turno.fechadoEm && turno.conferencia)).toBe(true)
    expect(turnos.some((turno) => turno.id === "turno-20261113")).toBe(false)
  })

  test("entrar com o PIN certo devolve a pessoa; errado recusa", async () => {
    const api = servidor()
    expect((await api.equipe.entrar("eq-marina", "1111")).nome).toBe("Marina S.")
    await expect(api.equipe.entrar("eq-marina", "1112")).rejects.toThrow("PIN errado.")
  })

  test("pessoa desativada não entra", async () => {
    const api = servidor()
    const [, , marina] = await api.equipe.listar()
    await api.equipe.salvar({ ...marina, ativo: false })
    await expect(api.equipe.entrar("eq-marina", "1111")).rejects.toThrow(
      "Esta pessoa está desativada.",
    )
  })

  test("salvar confere pelas regras", async () => {
    const api = servidor()
    await expect(
      api.equipe.salvar({ nome: "Bia L.", perfil: "caixa", pin: "12", ativo: true }),
    ).rejects.toThrow("O PIN tem de 4 a 6 números.")
    const [carla] = await api.equipe.listar()
    await expect(api.equipe.salvar({ ...carla, ativo: false })).rejects.toThrow(
      "O painel precisa de um Dono ativo.",
    )
  })

  test("salvar cria com id novo e edita pelo id", async () => {
    const api = servidor()
    const bia = await api.equipe.salvar({
      nome: "Bia L.",
      perfil: "caixa",
      pin: "3333",
      ativo: true,
    })
    expect(bia.id).toMatch(/^eq-/)
    await api.equipe.salvar({ ...bia, nome: "Bia Lima" })
    const equipe = await api.equipe.listar()
    expect(equipe).toHaveLength(5)
    expect(equipe.at(-1)).toEqual({ ...bia, nome: "Bia Lima" })
  })

  test("no dia seguinte, a base ganha os turnos dos dias que faltavam e nenhum de hoje", async () => {
    const antes = (await servidor().base()).turnos
    vi.setSystemTime(new Date(2026, 10, 17, 20, 30))
    const depois = (await servidor().base()).turnos
    const novos = depois.filter((turno) => !antes.some((velho) => velho.id === turno.id))
    expect(depois.slice(0, antes.length)).toEqual(antes)
    expect(novos.length).toBeGreaterThan(0)
    for (const turno of novos) {
      expect(turno.id > "turno-20261113" && turno.id < "turno-20261117").toBe(true)
      expect(turno.fechadoEm).toBeDefined()
    }
    const { pedidos } = await servidor().base()
    const doPdv = pedidos.filter((pedido) => pedido.origem === "pdv")
    expect(doPdv.every((pedido) => depois.some((turno) => turno.id === pedido.turnoId))).toBe(true)
  })
})

/** Uma venda de balcão: água avulsa no valor e na forma dados. */
const venda = (operadorId: string, preco = 30, pagamento: "dinheiro" | "pix" = "dinheiro") => ({
  operadorId,
  itens: [{ avulso: { nome: "Água", preco }, quantidade: 1 }],
  pagamento,
  desconto: { modo: "reais" as const, valor: 0 },
  concluida: true,
})
const RAFAEL = { membroId: "eq-gerente", pin: "2580" }
const abrirMarina = (api: ReturnType<typeof servidor>, fundo = 100) =>
  api.caixa.abrir({ operadorId: "eq-marina", pin: "1111", fundo })

describe("caixa", () => {
  test("abre o caixa com PIN e fundo; abrir de novo recusa", async () => {
    const api = servidor()
    expect(await api.caixa.atual()).toBeNull()
    const turno = await abrirMarina(api, 150)
    expect(turno).toMatchObject({
      abertoPor: "eq-marina",
      abertoEm: AGORA.toISOString(),
      fundo: 150,
      movimentos: [],
    })
    expect(await api.caixa.atual()).toEqual(turno)
    await expect(
      api.caixa.abrir({ operadorId: "eq-joao", pin: "2222", fundo: 100 }),
    ).rejects.toThrow("O caixa já está aberto por Marina S.")
  })

  test("abrir com PIN errado recusa", async () => {
    const api = servidor()
    await expect(
      api.caixa.abrir({ operadorId: "eq-marina", pin: "9999", fundo: 100 }),
    ).rejects.toThrow("PIN errado.")
    await expect(
      api.caixa.abrir({ operadorId: "eq-marina", pin: "1111", fundo: -5 }),
    ).rejects.toThrow("O fundo vai de")
    expect(await api.caixa.atual()).toBeNull()
  })

  test("suprimento do caixa não pede autorização; sangria pede", async () => {
    const api = servidor()
    await abrirMarina(api)
    const comSuprimento = await api.caixa.movimentar({
      operadorId: "eq-marina",
      tipo: "suprimento",
      valor: 50,
      motivo: "Reforço de moedas",
    })
    expect(comSuprimento.movimentos[0]).toMatchObject({
      tipo: "suprimento",
      valor: 50,
      feitoPor: "eq-marina",
      criadoEm: AGORA.toISOString(),
    })
    expect(comSuprimento.movimentos[0].autorizadoPor).toBeUndefined()
    const sangria = {
      operadorId: "eq-marina",
      tipo: "sangria" as const,
      valor: 100,
      motivo: "Cofre",
    }
    await expect(api.caixa.movimentar(sangria)).rejects.toThrow("Precisa do PIN de um gerente.")
    await expect(
      api.caixa.movimentar({ ...sangria, autorizacao: { membroId: "eq-joao", pin: "2222" } }),
    ).rejects.toThrow("Precisa do PIN de um gerente.")
    await expect(
      api.caixa.movimentar({ ...sangria, autorizacao: { ...RAFAEL, pin: "0000" } }),
    ).rejects.toThrow("PIN do gerente errado.")
    const depois = await api.caixa.movimentar({ ...sangria, autorizacao: RAFAEL })
    expect(depois.movimentos[1]).toMatchObject({
      tipo: "sangria",
      valor: 100,
      feitoPor: "eq-marina",
      autorizadoPor: "eq-gerente",
    })
    expect((await api.caixa.resumo(depois.id)).dinheiroNaGaveta).toBe(50)
  })

  test("sangria do gerente não pede autorização", async () => {
    const api = servidor()
    await abrirMarina(api)
    const turno = await api.caixa.movimentar({
      operadorId: "eq-gerente",
      tipo: "sangria",
      valor: 60,
      motivo: "Cofre",
    })
    expect(turno.movimentos[0]).toMatchObject({ feitoPor: "eq-gerente", valor: 60 })
    expect(turno.movimentos[0].autorizadoPor).toBeUndefined()
  })

  test("sangria maior que a gaveta recusa", async () => {
    const api = servidor()
    await abrirMarina(api)
    await expect(
      api.caixa.movimentar({
        operadorId: "eq-marina",
        tipo: "sangria",
        valor: 150,
        motivo: "Cofre",
        autorizacao: RAFAEL,
      }),
    ).rejects.toThrow("A gaveta só tem R$ 100,00.")
  })

  test("João não mexe no caixa de Marina; Rafael mexe", async () => {
    const api = servidor()
    await abrirMarina(api)
    const erro = "Este caixa está aberto por Marina S."
    await expect(
      api.caixa.movimentar({
        operadorId: "eq-joao",
        tipo: "suprimento",
        valor: 10,
        motivo: "Moedas",
      }),
    ).rejects.toThrow(erro)
    await expect(api.caixa.fechar({ operadorId: "eq-joao", contadoDinheiro: 100 })).rejects.toThrow(
      erro,
    )
    await expect(api.pdv.finalizar(venda("eq-joao"))).rejects.toThrow(erro)
    expect((await api.pdv.finalizar(venda("eq-gerente"))).operadorId).toBe("eq-gerente")
    const fechado = await api.caixa.fechar({ operadorId: "eq-gerente", contadoDinheiro: 130 })
    expect(fechado.fechadoPor).toBe("eq-gerente")
  })

  test("fechar confere o dinheiro e exige justificativa", async () => {
    const api = servidor()
    await abrirMarina(api)
    await api.pdv.finalizar(venda("eq-marina", 30))
    await api.pdv.finalizar(venda("eq-marina", 12, "pix"))
    await expect(
      api.caixa.fechar({ operadorId: "eq-marina", contadoDinheiro: 125 }),
    ).rejects.toThrow("Justifique a diferença de −R$ 5,00.")
    const fechado = await api.caixa.fechar({
      operadorId: "eq-marina",
      contadoDinheiro: 125,
      justificativa: "Troco dado a mais",
    })
    expect(fechado).toMatchObject({
      fechadoPor: "eq-marina",
      fechadoEm: AGORA.toISOString(),
      conferencia: {
        esperado: { dinheiro: 130, pix: 12, "cartao-na-entrega": 0 },
        contado: { dinheiro: 125, pix: 12, "cartao-na-entrega": 0 },
        justificativa: "Troco dado a mais",
      },
    })
    expect(await api.caixa.atual()).toBeNull()
    await expect(api.pdv.finalizar(venda("eq-marina"))).rejects.toThrow(
      "Abra o caixa antes de vender.",
    )
  })

  test("reabrir pede o gerente e só vale para o último turno com o caixa fechado", async () => {
    const api = servidor()
    const turno = await abrirMarina(api)
    await expect(
      api.caixa.reabrir({ operadorId: "eq-marina", turnoId: turno.id, autorizacao: RAFAEL }),
    ).rejects.toThrow("O caixa já está aberto por Marina S.")
    await api.caixa.fechar({ operadorId: "eq-marina", contadoDinheiro: 100 })
    await expect(api.caixa.reabrir({ operadorId: "eq-marina", turnoId: turno.id })).rejects.toThrow(
      "Precisa do PIN de um gerente.",
    )
    const [, anterior] = await api.caixa.historico()
    await expect(
      api.caixa.reabrir({
        operadorId: "eq-marina",
        turnoId: anterior.turno.id,
        autorizacao: RAFAEL,
      }),
    ).rejects.toThrow("Só o último caixa pode ser reaberto.")
    const reaberto = await api.caixa.reabrir({
      operadorId: "eq-marina",
      turnoId: turno.id,
      autorizacao: RAFAEL,
    })
    expect(reaberto.fechadoEm).toBeUndefined()
    expect(reaberto.conferencia).toBeUndefined()
    expect(reaberto.reaberturas).toEqual([{ em: AGORA.toISOString(), autorizadoPor: "eq-gerente" }])
    expect((await api.caixa.atual())?.id).toBe(turno.id)
  })

  test("histórico do mais novo para o mais antigo, com resumo", async () => {
    const api = servidor()
    const turno = await abrirMarina(api)
    await api.pdv.finalizar(venda("eq-marina", 30))
    const historico = await api.caixa.historico()
    expect(historico[0].turno.id).toBe(turno.id)
    expect(historico[0].resumo).toMatchObject({ vendas: 1, total: 30, dinheiroNaGaveta: 130 })
    const datas = historico.map((item) => item.turno.abertoEm)
    expect(datas).toEqual([...datas].sort().reverse())
    expect(historico.length).toBeGreaterThan(10)
  })

  test("no dia seguinte, o turno que ficou aberto continua aberto", async () => {
    const turno = await abrirMarina(servidor())
    vi.setSystemTime(new Date(2026, 10, 14, 9, 0))
    const api = servidor()
    expect(await api.caixa.atual()).toEqual(turno)
    expect((await api.pdv.finalizar(venda("eq-marina"))).turnoId).toBe(turno.id)
  })
})
