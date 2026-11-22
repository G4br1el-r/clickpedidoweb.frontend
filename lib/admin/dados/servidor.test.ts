import "fake-indexeddb/auto"
import { clear, get, set } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { mesasSeCruzam } from "../regras/salao"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { carregarCatalogo } from "./catalogos"
import type { BaseLojaV3 } from "./migracao"
import {
  criarServidor,
  type NovoAgendamento,
  type PagamentoMesa,
  type Servidor,
  type VendaPdv,
} from "./servidor"
import type { Mesa, Pedido, StatusPedido } from "./tipos"

/** Sexta, 13/11/2026, 20:30 em São Paulo. */
const AGORA = new Date(2026, 10, 13, 20, 30)
const EM_ANDAMENTO: StatusPedido[] = ["recebido", "em-preparo", "pronto", "saiu-para-entrega"]
/** `crypto.randomUUID()` inteiro: 128 bits, sem nada do pedido. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function servidor() {
  return criarServidor({
    segmento: "lanchonete",
    carregarCatalogo: async () => catalogoDeTeste(),
    espera: 0,
  })
}

/** Açougue com o catálogo de demonstração: tem pedido a pagar depois da pesagem. */
const acougue = () =>
  criarServidor({
    segmento: "acougue",
    carregarCatalogo: () => carregarCatalogo("acougue"),
    espera: 0,
  })

/** Pedido aberto, a pagar depois da pesagem, ainda não pesado. */
async function aPesar(api: Servidor): Promise<Pedido> {
  const abertos = await api.pedidos.listar({ status: ["recebido", "em-preparo", "pronto"] })
  const pedido = abertos.find((item) => item.pagamento === "pagar-apos-pesagem" && !item.pesagem)
  if (!pedido) throw new Error("A demonstração do açougue devia ter um pedido a pesar")
  return pedido
}

/** Cada item por quilo pesa exatamente o que foi pedido. */
const pesosPedidos = (pedido: Pedido) =>
  Object.fromEntries(
    pedido.itens
      .filter((item) => item.pesoGramas)
      .map((item) => [item.id, (item.pesoGramas as number) * item.quantidade]),
  )

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA)
  await clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("servidor de demonstração", () => {
  test("na primeira vez gera 90 dias de pedidos e guarda neste navegador", async () => {
    const pedidos = await servidor().pedidos.listar()

    const maisAntigo = new Date(Math.min(...pedidos.map((pedido) => Date.parse(pedido.criadoEm))))
    expect(maisAntigo >= new Date(2026, 7, 16)).toBe(true)
    expect(maisAntigo < new Date(2026, 7, 20)).toBe(true)
    // Outra aba (ou recarregar) lê o que ficou guardado.
    expect(await servidor().pedidos.listar()).toEqual(pedidos)
  })

  test("os dados guardados na versão 2 são recriados: a demonstração nova traz custo e histórico", async () => {
    await set("clickpedido-admin-dados:lanchonete", {
      versao: 2,
      geradoEm: AGORA.toISOString(),
      base: { ...catalogoDeTeste(), pedidos: [], movimentosEstoque: [] },
    })

    const base = await servidor().base()
    expect(base.pedidos.length).toBeGreaterThan(0)
    const comCusto = base.produtos.filter((produto) => produto.custo !== undefined)
    expect(comCusto.length).toBeGreaterThan(base.produtos.length / 2)
    const custos = new Map(comCusto.map((produto) => [produto.id, produto.custo]))
    for (const item of base.pedidos.flatMap((pedido) => pedido.itens)) {
      expect(item.custoUnitario).toBe(custos.get(item.produtoId ?? ""))
    }
  })

  test("lista do mais novo para o mais antigo e filtra por período e status", async () => {
    const api = servidor()
    const todos = await api.pedidos.listar()
    expect(Date.parse(todos[0].criadoEm)).toBeGreaterThan(Date.parse(todos[1].criadoEm))

    const deHoje = await api.pedidos.listar({
      de: new Date(2026, 10, 13),
      ate: new Date(2026, 10, 13),
    })
    expect(deHoje.length).toBeGreaterThan(0)
    for (const pedido of deHoje) expect(new Date(pedido.criadoEm).getDate()).toBe(13)

    const cancelados = await api.pedidos.listar({ status: ["cancelado"] })
    expect(cancelados.length).toBeGreaterThan(0)
    for (const pedido of cancelados) expect(pedido.status).toBe("cancelado")
  })

  test("concluídos do dia contam pela hora da conclusão, não pela criação", async () => {
    vi.setSystemTime(new Date(2026, 10, 13, 23, 50))
    const api = servidor()
    const mesa = await api.mesas.criar({ numero: 9 })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    vi.setSystemTime(new Date(2026, 10, 14, 0, 10))
    await api.mesas.fecharConta(comanda.id, "pix")

    const concluidos = await api.pedidos.listar({ concluidosEm: new Date(2026, 10, 14) })
    expect(concluidos.map((pedido) => pedido.id)).toEqual([comanda.id])
    const doDia13 = await api.pedidos.listar({ concluidosEm: new Date(2026, 10, 13) })
    expect(doDia13.length).toBeGreaterThan(0)
    for (const pedido of doDia13) {
      expect(pedido.status).toBe("concluido")
      expect(new Date(pedido.atualizadoEm).getDate()).toBe(13)
    }
  })

  test("avançar muda a etapa e continua assim depois de reabrir", async () => {
    const api = servidor()
    const [novo] = await api.pedidos.listar({ status: ["recebido"] })
    expect(novo).toBeDefined()

    const avancado = await api.pedidos.avancar(novo.id, "recebido")
    expect(avancado.status).toBe("em-preparo")
    expect((await servidor().pedidos.buscar(novo.id))?.status).toBe("em-preparo")
  })

  test("duas abas: avançar ou cancelar a partir de uma etapa que já passou é recusado", async () => {
    const api = servidor()
    const [novo] = await api.pedidos.listar({ status: ["recebido"] })
    await api.pedidos.avancar(novo.id, "recebido")

    const mensagem = "Este pedido já mudou de etapa. Atualize a tela."
    await expect(api.pedidos.avancar(novo.id, "recebido")).rejects.toThrow(mensagem)
    await expect(api.pedidos.cancelar(novo.id, "recebido")).rejects.toThrow(mensagem)
    expect((await api.pedidos.buscar(novo.id))?.status).toBe("em-preparo")
  })

  test("avançar um pedido sem próxima etapa avisa", async () => {
    const api = servidor()
    const [concluido] = await api.pedidos.listar({ status: ["concluido"] })
    await expect(api.pedidos.avancar(concluido.id, "concluido")).rejects.toThrow(
      "Este pedido não tem próxima etapa",
    )
  })

  test("concluir um pedido que se paga na entrega marca como pago", async () => {
    const api = servidor()
    const pedidos = await api.pedidos.listar({ status: ["saiu-para-entrega"] })
    const naEntrega = pedidos.find((pedido) => pedido.situacaoPagamento === "na-entrega")
    expect(naEntrega).toBeDefined()

    const entregue = await api.pedidos.avancar(naEntrega?.id ?? 0, "saiu-para-entrega")
    expect(entregue.status).toBe("concluido")
    expect(entregue.situacaoPagamento).toBe("pago")
    expect(entregue.pagoEm).toBe(AGORA.toISOString())
  })

  test("cancelar e marcar como pago", async () => {
    const api = servidor()
    const [novo] = await api.pedidos.listar({ status: ["recebido"] })

    const pago = await api.pedidos.marcarPago(novo.id)
    expect(pago.situacaoPagamento).toBe("pago")

    const cancelado = await api.pedidos.cancelar(novo.id, "recebido")
    expect(cancelado.status).toBe("cancelado")
    // Já estava pago: o dinheiro não some do registro.
    expect(cancelado.situacaoPagamento).toBe("pago")

    const [concluido] = await api.pedidos.listar({ status: ["concluido"] })
    await expect(api.pedidos.cancelar(concluido.id, "concluido")).rejects.toThrow(
      "Pedido concluído não pode ser cancelado",
    )
  })

  test("cancelar guarda o motivo escolhido; sem motivo, o pedido fica sem o campo", async () => {
    const api = servidor()
    const [primeiro, segundo] = await api.pedidos.listar({ status: ["recebido"] })

    const comMotivo = await api.pedidos.cancelar(primeiro.id, "recebido", "fora-da-area")
    expect(comMotivo.motivoCancelamento).toBe("fora-da-area")
    expect((await servidor().pedidos.buscar(primeiro.id))?.motivoCancelamento).toBe("fora-da-area")

    const semMotivo = await api.pedidos.cancelar(segundo.id, "recebido")
    expect(semMotivo).not.toHaveProperty("motivoCancelamento")
  })

  test("mesas com comanda aberta aparecem ocupadas", async () => {
    const base = await servidor().base()
    const comandas = base.pedidos.filter(
      (pedido) => pedido.tipo === "mesa" && EM_ANDAMENTO.includes(pedido.status),
    )
    expect(comandas.length).toBeGreaterThan(0)
    for (const comanda of comandas) {
      const mesa = base.mesas.find((item) => item.id === comanda.mesa?.id)
      expect(mesa?.status).toBe("ocupada")
      expect(mesa?.pedidoAtivoId).toBe(comanda.id)
    }
  })

  describe("demonstração com o salão cheio", () => {
    const antes = (min: number) => new Date(AGORA.getTime() - min * 60_000).toISOString()

    async function salaoCheio() {
      const api = criarServidor({
        segmento: "acougue",
        carregarCatalogo: () => carregarCatalogo("acougue"),
        espera: 0,
      })
      const mesas = await api.mesas.listar()
      const base = await api.base()
      return { mesas, base }
    }

    test("abre com 8 mesas ocupadas, cada uma com pessoas entre 1 e os lugares", async () => {
      const { mesas, base } = await salaoCheio()
      const ocupadas = mesas.filter((mesa) => mesa.status === "ocupada")
      expect(ocupadas).toHaveLength(8)
      for (const mesa of ocupadas) {
        const comanda = base.pedidos.find((pedido) => pedido.id === mesa.pedidoAtivoId)
        expect(comanda?.mesa?.pessoas).toBeGreaterThanOrEqual(1)
        expect(comanda?.mesa?.pessoas).toBeLessThanOrEqual(mesa.lugares)
      }
    })

    test("a comanda aberta há mais tempo já pediu a conta, 12 min atrás", async () => {
      const { mesas, base } = await salaoCheio()
      const comandas = mesas
        .filter((mesa) => mesa.status === "ocupada")
        .map((mesa) => base.pedidos.find((pedido) => pedido.id === mesa.pedidoAtivoId) as Pedido)
      const maisAntiga = comandas.reduce((a, b) => (a.criadoEm < b.criadoEm ? a : b))
      expect(maisAntiga.contaPedidaEm).toBe(antes(12))
      expect(comandas.filter((comanda) => comanda.contaPedidaEm)).toHaveLength(1)
    })

    test("uma comanda está pronta para servir há 4 min", async () => {
      const { base } = await salaoCheio()
      const paraServir = base.pedidos.filter((pedido) => pedido.servirDesde)
      expect(paraServir).toHaveLength(1)
      expect(paraServir[0].servirDesde).toBe(antes(4))
      expect(paraServir[0].status).toBe("pronto")
      const { mesas } = await salaoCheio()
      expect(mesas.find((mesa) => mesa.pedidoAtivoId === paraServir[0].id)?.status).toBe("ocupada")
    })

    test.each([
      ["acougue" as const, new Date(2026, 10, 5, 20, 30)],
      ["pizzaria" as const, new Date(2026, 10, 8, 20, 30)],
    ])("em qualquer dia a promessa vale: %s em %s", async (segmento, dia) => {
      vi.setSystemTime(dia)
      const api = criarServidor({
        segmento,
        carregarCatalogo: () => carregarCatalogo(segmento),
        espera: 0,
      })
      const mesas = await api.mesas.listar()
      const base = await api.base()
      const ocupadas = mesas.filter((mesa) => mesa.status === "ocupada")
      expect(ocupadas).toHaveLength(8)
      const comandas = ocupadas.map(
        (mesa) => base.pedidos.find((pedido) => pedido.id === mesa.pedidoAtivoId) as Pedido,
      )
      const maisAntiga = comandas.reduce((a, b) => (a.criadoEm < b.criadoEm ? a : b))
      expect(maisAntiga.contaPedidaEm).toBe(new Date(dia.getTime() - 12 * 60_000).toISOString())
      const mesa9 = mesas.find((mesa) => mesa.id === "mesa-9")
      expect(mesa9?.status).toBe("livre")
      expect(mesa9?.limpezaDesde).toBe(new Date(dia.getTime() - 3 * 60_000).toISOString())
    })

    test("com a limpeza desligada no salão, a mesa 9 não fica em limpeza", async () => {
      const api = criarServidor({
        segmento: "acougue",
        carregarCatalogo: async () => {
          const catalogo = structuredClone(await carregarCatalogo("acougue"))
          catalogo.salao.limpeza = false
          return catalogo
        },
        espera: 0,
      })
      const mesa9 = (await api.mesas.listar()).find((mesa) => mesa.id === "mesa-9")
      expect(mesa9?.status).toBe("livre")
      expect(mesa9?.limpezaDesde).toBeUndefined()
    })

    test("a mesa 9 está em limpeza há 3 min; a 20 continua bloqueada e nunca recebe comanda", async () => {
      const { mesas, base } = await salaoCheio()
      const mesa9 = mesas.find((mesa) => mesa.id === "mesa-9")
      expect(mesa9?.status).toBe("livre")
      expect(mesa9?.limpezaDesde).toBe(antes(3))
      const mesa20 = mesas.find((mesa) => mesa.id === "mesa-20")
      expect(mesa20?.bloqueio).toEqual({ motivo: "Em manutenção" })
      expect(mesa20?.status).toBe("livre")
      expect(
        base.pedidos.filter(
          (pedido) => pedido.mesa?.id === "mesa-20" && EM_ANDAMENTO.includes(pedido.status),
        ),
      ).toEqual([])
    })
  })

  test("ao reabrir em outro dia, completa os dias e encerra o que ficou aberto", async () => {
    await servidor().pedidos.listar()

    vi.setSystemTime(new Date(2026, 10, 15, 21, 0))
    const pedidos = await servidor().pedidos.listar()

    expect(pedidos.some((pedido) => new Date(pedido.criadoEm).getDate() === 15)).toBe(true)
    for (const pedido of pedidos.filter((item) => new Date(item.criadoEm).getDate() === 13)) {
      expect(["concluido", "cancelado"]).toContain(pedido.status)
    }
    const ids = pedidos.map((pedido) => pedido.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  describe("histórico de status", () => {
    const etapas = (pedido: Pedido) => pedido.historico.map((etapa) => etapa.status)

    test("cada mudança de etapa entra no fim do histórico, com a hora em que aconteceu", async () => {
      const api = servidor()
      const [novo] = await api.pedidos.listar({ status: ["recebido"] })
      const antes = novo.historico.length

      vi.setSystemTime(new Date(2026, 10, 13, 20, 34))
      const emPreparo = await api.pedidos.avancar(novo.id, "recebido")
      expect(emPreparo.historico.slice(antes)).toEqual([
        { status: "em-preparo", em: new Date(2026, 10, 13, 20, 34).toISOString() },
      ])

      // Mudar o que não é a etapa (aqui, o pagamento) não anota nada.
      const pago = await api.pedidos.marcarPago(novo.id)
      expect(pago.historico).toEqual(emPreparo.historico)

      vi.setSystemTime(new Date(2026, 10, 13, 20, 40))
      const cancelado = await api.pedidos.cancelar(novo.id, "em-preparo")
      expect(cancelado.historico.at(-1)).toEqual({
        status: "cancelado",
        em: new Date(2026, 10, 13, 20, 40).toISOString(),
      })
      expect((await servidor().pedidos.buscar(novo.id))?.historico).toEqual(cancelado.historico)
    })

    test("o pedido criado no painel começa o histórico na etapa em que nasce", async () => {
      const api = servidor()
      const venda = await api.pdv.finalizar({
        itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
        pagamento: "pix",
        desconto: { modo: "reais", valor: 0 },
        concluida: true,
      })
      expect(venda.historico).toEqual([{ status: "concluido", em: AGORA.toISOString() }])

      const mesa = await api.mesas.criar({ numero: 9 })
      const comanda = await api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: false,
        itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
      })
      expect(etapas(comanda)).toEqual(["pronto"])
      // Rodada para a cozinha: a comanda volta para Novo, e isso fica anotado.
      const rodada = await api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: true,
        itens: [{ avulso: { nome: "Suco", preco: 8 }, quantidade: 1 }],
      })
      expect(etapas(rodada)).toEqual(["pronto", "recebido"])

      expect(etapas(await api.pedidos.simular())).toEqual(["recebido"])
    })

    test("o que ficou aberto num dia que passou é encerrado com a etapa anotada", async () => {
      const [aberto] = await servidor().pedidos.listar({ status: ["em-preparo"] })

      vi.setSystemTime(new Date(2026, 10, 15, 21, 0))
      const encerrado = await servidor().pedidos.buscar(aberto.id)
      expect(encerrado?.historico.at(-1)?.status).toBe(encerrado?.status)
      expect(encerrado?.historico.at(-1)?.em).toBe(new Date(2026, 10, 15, 21, 0).toISOString())
    })
  })

  test("escolhe o motoboy de uma entrega e guarda", async () => {
    const api = servidor()
    expect((await api.motoboys.listar()).map((motoboy) => motoboy.nome)).toEqual(["Carlos"])
    const entrega = (await api.pedidos.listar({ status: ["em-preparo"] })).find(
      (pedido) => pedido.tipo === "entrega",
    )
    expect(entrega).toBeDefined()

    const comMotoboy = await api.pedidos.atribuirMotoboy(entrega?.id ?? 0, "moto-1")
    expect(comMotoboy.motoboyId).toBe("moto-1")
    expect((await servidor().pedidos.buscar(entrega?.id ?? 0))?.motoboyId).toBe("moto-1")
  })

  test("motoboy só em pedido de entrega e só motoboy ativo", async () => {
    const api = servidor()
    const pedidos = await api.pedidos.listar()
    const retirada = pedidos.find((pedido) => pedido.tipo === "retirada")
    const entrega = pedidos.find((pedido) => pedido.tipo === "entrega")

    await expect(api.pedidos.atribuirMotoboy(retirada?.id ?? 0, "moto-1")).rejects.toThrow(
      "Só pedido de entrega tem motoboy",
    )
    await expect(api.pedidos.atribuirMotoboy(entrega?.id ?? 0, "moto-9")).rejects.toThrow(
      "Motoboy não encontrado ou inativo",
    )
  })

  test("ação em pedido que não existe é recusada", async () => {
    await expect(servidor().pedidos.avancar(999_999, "recebido")).rejects.toThrow(
      "Pedido não encontrado",
    )
  })

  test("pagar um pedido que aguardava o Pix põe ele na fila como novo", async () => {
    const api = servidor()
    const [aguardando] = await api.pedidos.listar({ status: ["aguardando-pagamento"] })
    expect(aguardando).toBeDefined()

    const pago = await api.pedidos.marcarPago(aguardando.id)
    expect(pago.status).toBe("recebido")
    expect(pago.situacaoPagamento).toBe("pago")
  })

  test("fechar e abrir a loja fica guardado", async () => {
    const api = servidor()
    expect((await api.loja()).aberta).toBe(true)
    await api.definirAberta(false)
    expect((await servidor().loja()).aberta).toBe(false)
  })

  test("desligar a entrega não fecha a loja", async () => {
    const loja = await servidor().definirEntrega(false)
    expect(loja.aceitaEntrega).toBe(false)
    expect(loja.aberta).toBe(true)
  })

  test("pedido criado aqui tem token opaco de 128 bits, sem segmento nem número", async () => {
    const api = servidor()
    const venda = await api.pdv.finalizar({
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
      pagamento: "pix",
      desconto: { modo: "reais", valor: 0 },
      concluida: true,
    })
    const mesa = await api.mesas.criar({ numero: 9 })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    const simulado = await api.pedidos.simular()
    const tokens = [venda, comanda, simulado].map((pedido) => pedido.token)
    for (const token of tokens) expect(token).toMatch(UUID)
    expect(new Set(tokens).size).toBe(3)
  })

  test("um pedido simulado chega como novo, com o número seguinte", async () => {
    const api = servidor()
    const [ultimo] = await api.pedidos.listar()

    const novo = await api.pedidos.simular()
    expect(novo.id).toBe(ultimo.id + 1)
    expect(novo.status).toBe("recebido")
    expect((await api.pedidos.listar())[0].id).toBe(novo.id)
  })

  describe("PDV", () => {
    /** X-Burger (R$ 20) com Bacon (+ R$ 3), duas vezes, e uma água avulsa de R$ 4,50. */
    const venda: VendaPdv = {
      itens: [
        {
          produtoId: "prod-x-burger",
          escolhas: { "grp-x-burger-1": ["opc-x-burger-1-1"] },
          quantidade: 2,
        },
        { avulso: { nome: "Água", preco: 4.5 }, quantidade: 1 },
      ],
      pagamento: "dinheiro" as const,
      desconto: { modo: "reais" as const, valor: 0.5 },
      valorRecebido: 100,
      concluida: true,
    }

    test("a venda concluída nasce paga, com as contas refeitas no servidor", async () => {
      const api = servidor()
      const pedido = await api.pdv.finalizar(venda)
      expect(pedido).toMatchObject({
        origem: "pdv",
        tipo: "retirada",
        status: "concluido",
        situacaoPagamento: "pago",
        subtotal: 50.5,
        desconto: 0.5,
        total: 50,
        trocoPara: 100,
      })
      expect(pedido.cliente.nome).toBe("Venda no balcão")
      expect(pedido.itens.map((item) => [item.nome, item.precoUnitario, item.total])).toEqual([
        ["X-Burger", 23, 46],
        ["Água", 4.5, 4.5],
      ])
      expect(pedido.itens[0].opcoes).toEqual(["Adicional: Bacon"])
    })

    test("o item vendido guarda o custo do produto daquela hora; mudar o custo depois não mexe na venda", async () => {
      const api = servidor()
      const xBurger = (await api.produtos.listar()).find((item) => item.id === "prod-x-burger")
      if (!xBurger) throw new Error("O catálogo de teste devia ter o X-Burger")
      await api.produtos.salvar({ ...xBurger, custo: 9.4 })

      const pedido = await api.pdv.finalizar(venda)
      expect(pedido.itens.map((item) => item.custoUnitario)).toEqual([9.4, undefined])

      const mesa = await api.mesas.criar({ numero: 7 })
      const comanda = await api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: false,
        itens: [venda.itens[0]],
      })
      expect(comanda.itens[0].custoUnitario).toBe(9.4)

      await api.produtos.salvar({ ...xBurger, custo: 12 })
      expect((await api.pedidos.buscar(pedido.id))?.itens[0].custoUnitario).toBe(9.4)
    })

    test("o preço do item do cardápio sai do servidor, nunca da tela", async () => {
      const comPrecoDaTela = {
        produtoId: "prod-x-burger",
        escolhas: { "grp-x-burger-1": ["opc-x-burger-1-1"] },
        quantidade: 1,
        precoUnitario: 1,
        nome: "Lanche barato",
      }
      const pedido = await servidor().pdv.finalizar({
        ...venda,
        valorRecebido: undefined,
        desconto: { modo: "reais", valor: 0 },
        itens: [comPrecoDaTela],
      })
      expect(pedido.itens[0]).toMatchObject({ nome: "X-Burger", precoUnitario: 23, total: 23 })
      expect(pedido.total).toBe(23)
    })

    test("no segmento com preço de balcão, o PDV cobra o preço de balcão", async () => {
      const api = criarServidor({
        segmento: "pizzaria",
        carregarCatalogo: async () => catalogoDeTeste(),
        espera: 0,
      })
      const [lanche] = await api.produtos.listar()
      await api.produtos.salvar({ ...lanche, precoBalcao: 18 })
      const pedido = await api.pdv.finalizar({
        ...venda,
        valorRecebido: undefined,
        desconto: { modo: "reais", valor: 0 },
        itens: [venda.itens[0]],
      })
      expect(pedido.itens[0]).toMatchObject({ precoUnitario: 21, total: 42 })
    })

    test("recusa opção que falta e produto esgotado", async () => {
      const api = servidor()
      const semBacon = { produtoId: "prod-x-burger", escolhas: {}, quantidade: 1 }
      await expect(api.pdv.finalizar({ ...venda, itens: [semBacon] })).rejects.toThrow(
        "X-Burger: Escolha 1 opção.",
      )
      await api.produtos.alternar("prod-x-burger", "disponivel")
      await expect(api.pdv.finalizar(venda)).rejects.toThrow("X-Burger está esgotado.")
    })

    test("quantidade quebrada é arredondada; abaixo de 1 o item fica de fora", async () => {
      const api = servidor()
      const agua = (quantidade: number) => ({
        avulso: { nome: "Água", preco: 4 },
        quantidade,
      })
      await expect(api.pdv.finalizar({ ...venda, itens: [agua(0.4)] })).rejects.toThrow(
        "Inclua pelo menos um item.",
      )
      await expect(api.pdv.finalizar({ ...venda, itens: [agua(Number.NaN)] })).rejects.toThrow(
        "Inclua pelo menos um item.",
      )
      const pedido = await api.pdv.finalizar({
        ...venda,
        itens: [agua(0.4), agua(2.6)],
        desconto: { modo: "reais", valor: 0 },
      })
      expect(pedido.itens.map((item) => [item.quantidade, item.total])).toEqual([[3, 12]])
    })

    test("corta os textos longos e recusa forma de pagamento desconhecida", async () => {
      const api = servidor()
      const pedido = await api.pdv.finalizar({
        ...venda,
        clienteNome: "A".repeat(100),
        observacao: "B".repeat(300),
        itens: [
          {
            avulso: { nome: "C".repeat(100), preco: 4 },
            quantidade: 1,
            observacao: "D".repeat(200),
          },
        ],
        desconto: { modo: "reais", valor: 0 },
      })
      expect(pedido.cliente.nome).toHaveLength(80)
      expect(pedido.observacao).toHaveLength(280)
      expect(pedido.itens[0].nome).toHaveLength(80)
      expect(pedido.itens[0].observacao).toHaveLength(140)

      const estranho = { ...venda, pagamento: "cheque" } as unknown as VendaPdv
      await expect(api.pdv.finalizar(estranho)).rejects.toThrow(
        "Escolha uma forma de pagamento válida.",
      )
    })

    test("venda não concluída vai para a fila, já paga", async () => {
      const pedido = await servidor().pdv.finalizar({
        ...venda,
        concluida: false,
        clienteNome: "Bia",
      })
      expect(pedido).toMatchObject({
        status: "recebido",
        situacaoPagamento: "pago",
        enviarParaCozinha: true,
      })
      expect(pedido.cliente.nome).toBe("Bia")
    })

    test("recusa venda vazia, dinheiro a menos e desconto acima do subtotal", async () => {
      const api = servidor()
      await expect(api.pdv.finalizar({ ...venda, itens: [] })).rejects.toThrow(
        "Inclua pelo menos um item.",
      )
      await expect(api.pdv.finalizar({ ...venda, valorRecebido: 20 })).rejects.toThrow(
        "O valor recebido é menor que o total.",
      )
      await expect(
        api.pdv.finalizar({ ...venda, desconto: { modo: "reais", valor: 60 } }),
      ).rejects.toThrow("O desconto passa do subtotal.")
    })

    test("ignora item zerado, guarda a observação e recusa desconto acima de 100%", async () => {
      const api = servidor()
      const zerado = { avulso: { nome: "Nada", preco: 9 }, quantidade: 0 }
      const pedido = await api.pdv.finalizar({
        ...venda,
        itens: [...venda.itens, zerado],
        observacao: "  Para viagem ",
      })
      expect(pedido.itens).toHaveLength(2)
      expect(pedido.observacao).toBe("Para viagem")
      await expect(
        api.pdv.finalizar({ ...venda, desconto: { modo: "porcento", valor: 120 } }),
      ).rejects.toThrow("O desconto passa do subtotal.")
    })

    test("últimas vendas são só as do PDV de hoje, da mais nova para a mais antiga", async () => {
      const api = servidor()
      const primeira = await api.pdv.finalizar(venda)
      const segunda = await api.pdv.finalizar({
        ...venda,
        pagamento: "pix",
        valorRecebido: undefined,
      })
      const ultimas = await api.pdv.ultimasVendas()
      expect(ultimas.slice(0, 2).map((pedido) => pedido.id)).toEqual([segunda.id, primeira.id])
      for (const pedido of ultimas) expect(pedido.origem).toBe("pdv")
    })
  })

  describe("cardápio", () => {
    test("salva um produto novo e altera um existente", async () => {
      const api = servidor()
      const [xBurger] = await api.produtos.listar()
      await api.produtos.salvar({ ...xBurger, id: "prod-x-salada", nome: "X-Salada", ordem: 2 })
      await api.produtos.salvar({ ...xBurger, nome: "X-Burger Duplo" })

      const nomes = (await servidor().produtos.listar()).map((produto) => produto.nome)
      expect(nomes).toEqual(["X-Burger Duplo", "X-Salada"])
    })

    test("alterna disponível e visível, e muda o preço na linha", async () => {
      const api = servidor()
      const [xBurger] = await api.produtos.listar()
      expect((await api.produtos.alternar(xBurger.id, "disponivel")).disponivel).toBe(false)
      expect((await api.produtos.alternar(xBurger.id, "ativo")).ativo).toBe(false)
      expect((await api.produtos.definirPreco(xBurger.id, 22.5)).preco).toBe(22.5)
      await expect(api.produtos.definirPreco(xBurger.id, 0)).rejects.toThrow(
        "Informe um preço válido.",
      )
    })

    test("copiar põe a cópia logo depois do original, e excluir tira", async () => {
      const api = servidor()
      const [xBurger] = await api.produtos.listar()
      const copia = await api.produtos.copiar(xBurger.id)
      expect(copia.nome).toBe("X-Burger (Cópia)")
      expect((await api.produtos.listar()).map((produto) => produto.nome)).toEqual([
        "X-Burger",
        "X-Burger (Cópia)",
      ])

      await api.produtos.excluir(copia.id)
      expect(await api.produtos.listar()).toHaveLength(1)
    })

    test("replicar as opções conta quantos produtos mudaram", async () => {
      const api = servidor()
      const [xBurger] = await api.produtos.listar()
      await api.produtos.salvar({ ...xBurger, id: "prod-x-salada", nome: "X-Salada", grupos: [] })
      expect(await api.produtos.replicarOpcoes(xBurger.id)).toBe(1)
      const salada = (await api.produtos.listar()).find((produto) => produto.id === "prod-x-salada")
      expect(salada?.grupos.map((grupo) => grupo.nome)).toEqual(["Adicional"])
    })

    test("categorias: criar no fim, renomear, ocultar e reordenar", async () => {
      const api = servidor()
      const bebidas = await api.categorias.criar("  Bebidas ")
      expect(bebidas).toMatchObject({ nome: "Bebidas", ordem: 2, ativa: true })
      await api.categorias.salvar({ ...bebidas, nome: "Bebidas geladas", ativa: false })
      await api.categorias.reordenar(bebidas.id, "cat-lanches")

      expect(
        (await servidor().categorias.listar()).map(({ nome, ordem, ativa }) => [
          nome,
          ordem,
          ativa,
        ]),
      ).toEqual([
        ["Bebidas geladas", 1, false],
        ["Lanches", 2, true],
      ])
      await expect(api.categorias.criar("")).rejects.toThrow("Informe o nome da categoria.")
      await expect(
        api.categorias.salvar({ id: "cat-nada", nome: "Sobremesas", ordem: 9, ativa: true }),
      ).rejects.toThrow("Categoria não encontrada")
    })

    test("recusa produto em categoria que não existe e ações em produto que não existe", async () => {
      const api = servidor()
      const [xBurger] = await api.produtos.listar()
      await expect(api.produtos.salvar({ ...xBurger, categoriaId: "cat-nada" })).rejects.toThrow(
        "Escolha uma categoria que exista.",
      )
      for (const acao of [api.produtos.copiar, api.produtos.replicarOpcoes]) {
        await expect(acao("prod-nada")).rejects.toThrow("Produto não encontrado")
      }
      await expect(api.produtos.definirPreco("prod-nada", 10)).rejects.toThrow(
        "Produto não encontrado",
      )
    })

    test("salvar confere o produto com o esquema do formulário", async () => {
      const api = servidor()
      const [xBurger] = await api.produtos.listar()
      await expect(api.produtos.salvar({ ...xBurger, nome: "  " })).rejects.toThrow(
        "Informe o nome do produto.",
      )
      await expect(api.produtos.salvar({ ...xBurger, preco: 0 })).rejects.toThrow(
        "Informe um preço maior que zero.",
      )
      await expect(
        api.produtos.salvar({ ...xBurger, oferta: true, precoOriginal: 10 }),
      ).rejects.toThrow("O preço “de” precisa ser maior que o preço.")
      expect((await api.produtos.listar())[0]).toEqual(xBurger)
    })

    test("categoria com produtos não pode ser excluída", async () => {
      const api = servidor()
      await expect(api.categorias.excluir("cat-lanches")).rejects.toThrow(
        "Mova ou exclua os produtos antes.",
      )
      const vazia = await api.categorias.criar("Sobremesas")
      await api.categorias.excluir(vazia.id)
      expect(await api.categorias.listar()).toHaveLength(1)
    })
  })

  describe("motoboys", () => {
    test("criar, editar e alternar, com WhatsApp só em números", async () => {
      const api = servidor()
      const novo = await api.motoboys.salvar({
        nome: " Davi ",
        telefone: "(12) 99222-0000",
        ativo: true,
      })
      expect(novo).toMatchObject({ nome: "Davi", telefone: "12992220000", ativo: true })
      const editado = await api.motoboys.salvar({ ...novo, nome: "Davi Souza" })
      expect(editado.id).toBe(novo.id)
      expect((await api.motoboys.alternar(novo.id)).ativo).toBe(false)
      expect((await api.motoboys.listar()).map((item) => item.nome)).toEqual([
        "Carlos",
        "Davi Souza",
      ])

      await expect(api.motoboys.salvar({ nome: "", telefone: "12", ativo: true })).rejects.toThrow(
        "Informe o nome do motoboy.",
      )
      await expect(
        api.motoboys.salvar({ nome: "Eva", telefone: "12", ativo: true }),
      ).rejects.toThrow("WhatsApp com DDD, só números.")
    })

    test("só exclui quem não tem entrega em andamento", async () => {
      const api = servidor()
      const livre = await api.motoboys.salvar({
        nome: "Davi",
        telefone: "12992220000",
        ativo: true,
      })
      await api.motoboys.excluir(livre.id)
      expect((await api.motoboys.listar()).map((item) => item.id)).toEqual(["moto-1"])

      const entrega = (
        await api.pedidos.listar({ status: ["recebido", "em-preparo", "pronto"] })
      ).find((pedido) => pedido.tipo === "entrega")
      if (!entrega) throw new Error("A demonstração devia ter uma entrega em andamento")
      await api.pedidos.atribuirMotoboy(entrega.id, "moto-1")
      await expect(api.motoboys.excluir("moto-1")).rejects.toThrow(
        "Carlos tem entrega em andamento. Desative em vez de excluir.",
      )
    })
  })

  describe("bairros", () => {
    const bairro = { cidade: "Cachoeira Paulista", nome: "Vila Carmem", taxa: 7, ativo: true }

    test("criar, editar e recusar repetido na mesma cidade, sem olhar acento e maiúscula", async () => {
      const api = servidor()
      const novo = await api.bairros.salvar(bairro)
      expect(novo).toMatchObject(bairro)
      await expect(api.bairros.salvar({ ...bairro, nome: " vila CÁRMEM " })).rejects.toThrow(
        "Já existe o bairro Vila Carmem em Cachoeira Paulista.",
      )
      // Mesmo nome em outra cidade pode.
      await api.bairros.salvar({ ...bairro, cidade: "Lorena" })
      // Editar sem mudar o nome não conta como repetido.
      expect((await api.bairros.salvar({ ...novo, taxa: 9 })).taxa).toBe(9)
      await expect(api.bairros.salvar({ ...bairro, nome: "Jardim", taxa: -1 })).rejects.toThrow(
        "A taxa vai de R$ 0,00 a R$ 999,00.",
      )
      expect((await api.bairros.listar()).map((item) => `${item.cidade}/${item.nome}`)).toEqual([
        "Cachoeira Paulista/Centro",
        "Cachoeira Paulista/Vila Carmem",
        "Lorena/Vila Carmem",
      ])
    })

    test("mudar a taxa e desativar vários de uma vez; excluir", async () => {
      const api = servidor()
      const novo = await api.bairros.salvar(bairro)
      await api.bairros.mudarVarios([novo.id, "bairro-centro"], { taxa: 6 })
      await api.bairros.mudarVarios([novo.id], { ativo: false })
      expect(
        (await api.bairros.listar()).map((item) => [item.nome, item.taxa, item.ativo]),
      ).toEqual([
        ["Centro", 6, true],
        ["Vila Carmem", 6, false],
      ])
      await api.bairros.excluir(novo.id)
      expect(await api.bairros.listar()).toHaveLength(1)
    })
  })

  describe("configurações da loja", () => {
    test("salvar valida com o esquema e guarda os textos limpos", async () => {
      const api = servidor()
      const loja = await api.loja()
      const salva = await api.salvarLoja({
        ...loja,
        nome: "  Lanches da Ana  ",
        taxaEntregaPadrao: 6,
      })
      expect(salva).toMatchObject({ nome: "Lanches da Ana", taxaEntregaPadrao: 6 })
      expect((await api.loja()).nome).toBe("Lanches da Ana")
      await expect(api.salvarLoja({ ...loja, nome: "" })).rejects.toThrow("Informe o nome da loja.")
    })

    test("a chave de abrir e fechar passa a loja para o controle manual", async () => {
      const api = servidor()
      expect((await api.loja()).controleAutomatico).toBe(true)
      const loja = await api.definirAberta(false)
      expect(loja).toMatchObject({ aberta: false, controleAutomatico: false })
    })

    test("desconectar a conta online desliga Pix e cartão online", async () => {
      const api = servidor()
      const loja = await api.conectarPagamentoOnline(false)
      expect(loja.pagamentoOnlineConectado).toBe(false)
      expect(loja.pagamentos).toMatchObject({ pix: false, "cartao-online": false, dinheiro: true })
      expect((await api.conectarPagamentoOnline(true)).pagamentoOnlineConectado).toBe(true)
    })

    test("salvar não conecta a conta online: vale a conexão guardada", async () => {
      const api = servidor()
      const desconectada = await api.conectarPagamentoOnline(false)
      await expect(
        api.salvarLoja({
          ...desconectada,
          pagamentoOnlineConectado: true,
          pagamentos: { ...desconectada.pagamentos, pix: true },
        }),
      ).rejects.toThrow("Conecte a conta de pagamento online para usar o Pix.")

      const salva = await api.salvarLoja({ ...desconectada, pagamentoOnlineConectado: true })
      expect(salva.pagamentoOnlineConectado).toBe(false)
      expect((await api.loja()).pagamentoOnlineConectado).toBe(false)
    })
  })

  describe("recursos próprios", () => {
    test("açougue: a pesagem grava os valores novos e a hora; pedido pago é recusado", async () => {
      const catalogo = catalogoDeTeste()
      catalogo.produtos[0] = { ...catalogo.produtos[0], unidade: "kg", preco: 60, grupos: [] }
      const api = criarServidor({
        segmento: "acougue",
        carregarCatalogo: async () => catalogo,
        espera: 0,
      })
      const abertos = await api.pedidos.listar({ status: ["recebido", "em-preparo", "pronto"] })
      const pedido = abertos.find(
        (item) => item.situacaoPagamento !== "pago" && item.itens.some((i) => i.pesoGramas),
      )
      if (!pedido) throw new Error("A demonstração devia ter um pedido por quilo a pesar")
      // Cada item pesa o que foi pedido; o primeiro, 100 g a mais (a R$ 60 o quilo, R$ 6,00).
      const pesos = Object.fromEntries(
        pedido.itens
          .filter((i) => i.pesoGramas)
          .map((i, posicao) => [
            i.id,
            (i.pesoGramas as number) * i.quantidade + (posicao === 0 ? 100 : 0),
          ]),
      )
      const pesado = await api.pedidos.registrarPesagem(pedido.id, pesos)
      expect(pesado.pesagem).toEqual({
        totalEstimado: pedido.total,
        diferenca: 6,
        pesadoEm: AGORA.toISOString(),
      })
      expect(Math.round((pesado.total - pedido.total) * 100)).toBe(600)

      await api.pedidos.marcarPago(pedido.id)
      await expect(api.pedidos.registrarPesagem(pedido.id, pesos)).rejects.toThrow(
        "Pedido já pago: a pesagem não muda o valor.",
      )
    })

    test("marcar como pago recusa pedido cancelado e pedido já pago", async () => {
      const api = servidor()
      const [cancelado] = await api.pedidos.listar({ status: ["cancelado"] })
      await expect(api.pedidos.marcarPago(cancelado.id)).rejects.toThrow(
        "Pedido cancelado não recebe pagamento.",
      )
      const [novo] = await api.pedidos.listar({ status: ["recebido"] })
      await api.pedidos.marcarPago(novo.id)
      await expect(api.pedidos.marcarPago(novo.id)).rejects.toThrow("Este pedido já está pago.")
    })

    test("açougue: pagar após a pesagem só recebe depois de pesar", async () => {
      const api = acougue()
      const pedido = await aPesar(api)
      await expect(api.pedidos.marcarPago(pedido.id)).rejects.toThrow(
        "Pese o pedido antes de receber.",
      )
      await api.pedidos.registrarPesagem(pedido.id, pesosPedidos(pedido))
      expect((await api.pedidos.marcarPago(pedido.id)).situacaoPagamento).toBe("pago")
    })

    test("açougue: pedido encerrado não muda de valor na pesagem", async () => {
      const api = acougue()
      const cancelado = await aPesar(api)
      await api.pedidos.cancelar(cancelado.id, cancelado.status)
      await expect(
        api.pedidos.registrarPesagem(cancelado.id, pesosPedidos(cancelado)),
      ).rejects.toThrow("Pedido encerrado não muda de valor.")

      const concluido = (await api.pedidos.listar({ status: ["concluido"] })).find((pedido) =>
        pedido.itens.some((item) => item.pesoGramas),
      )
      if (!concluido) throw new Error("A demonstração do açougue devia ter um pedido concluído")
      await expect(
        api.pedidos.registrarPesagem(concluido.id, pesosPedidos(concluido)),
      ).rejects.toThrow("Pedido encerrado não muda de valor.")
    })

    test("lanchonete: a comanda nova recomeça a numeração no mês novo", async () => {
      // A base é gerada no fim de novembro; a comanda abre já em dezembro.
      vi.setSystemTime(new Date(2026, 10, 30, 23, 59))
      const api = servidor()
      await api.pedidos.listar()
      vi.setSystemTime(new Date(2026, 11, 1, 8))
      const mesa = await api.mesas.criar({ numero: 9 })
      const comanda = await api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: false,
        itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
      })
      expect(comanda.numero).toBe(1)
      expect(comanda.id).toBeGreaterThan(1)
    })

    test("combos: esgotar e renomear o produto mudam a opção ligada a ele", async () => {
      const api = servidor()
      const bacon = await api.produtos.salvar({
        ...(await api.produtos.listar())[0],
        id: "prod-bacon",
        nome: "Bacon extra",
        grupos: [],
      })
      const [lanche] = (await api.produtos.listar()).filter((item) => item.id === "prod-x-burger")
      await api.produtos.salvar({
        ...lanche,
        grupos: lanche.grupos.map((grupo) => ({
          ...grupo,
          itens: grupo.itens.map((opcao) => ({ ...opcao, produtoId: bacon.id })),
        })),
      })
      const opcao = async () =>
        (await api.produtos.listar()).find((item) => item.id === "prod-x-burger")?.grupos[0]
          .itens[0]

      await api.produtos.alternar(bacon.id, "disponivel")
      expect(await opcao()).toMatchObject({ ativo: false })
      await api.produtos.alternar(bacon.id, "disponivel")
      expect(await opcao()).toMatchObject({ ativo: true })
      await api.produtos.salvar({ ...bacon, nome: "Bacon crocante" })
      expect(await opcao()).toMatchObject({ nome: "Bacon crocante" })
    })

    /** X-Burger com a opção "Bacon" ligada ao produto "prod-bacon". */
    async function comboComBacon() {
      const api = servidor()
      const [lanche] = await api.produtos.listar()
      const bacon = await api.produtos.salvar({
        ...lanche,
        id: "prod-bacon",
        nome: "Bacon extra",
        grupos: [],
      })
      const ligar = (ativo: boolean) =>
        api.produtos.salvar({
          ...lanche,
          grupos: lanche.grupos.map((grupo) => ({
            ...grupo,
            itens: grupo.itens.map((opcao) => ({ ...opcao, produtoId: bacon.id, ativo })),
          })),
        })
      const opcao = async () =>
        (await api.produtos.listar()).find((item) => item.id === "prod-x-burger")?.grupos[0]
          .itens[0]
      return { api, bacon, ligar, opcao }
    }

    test("combos: a opção desligada à mão não religa quando o produto é salvo", async () => {
      const { api, bacon, ligar, opcao } = await comboComBacon()
      await ligar(false)
      await api.produtos.salvar({ ...bacon, preco: 25 })
      await api.produtos.definirPreco(bacon.id, 26)
      expect(await opcao()).toMatchObject({ ativo: false })
    })

    test("combos: excluir o produto desliga a opção e tira a ligação", async () => {
      const { api, bacon, ligar, opcao } = await comboComBacon()
      await ligar(true)
      await api.produtos.excluir(bacon.id)
      const depois = await opcao()
      expect(depois).toMatchObject({ nome: "Bacon", ativo: false })
      expect(depois).not.toHaveProperty("produtoId")
    })

    test("combos: opção ligada a produto que não existe mais é recusada", async () => {
      const api = servidor()
      const [lanche] = await api.produtos.listar()
      await api.produtos.salvar({
        ...lanche,
        grupos: lanche.grupos.map((grupo) => ({
          ...grupo,
          itens: grupo.itens.map((opcao) => ({ ...opcao, produtoId: "prod-que-sumiu" })),
        })),
      })
      const mesa = await api.mesas.criar({ numero: 5 })
      await expect(
        api.mesas.lancar({
          mesaId: mesa.id,
          enviarParaCozinha: true,
          itens: [
            {
              produtoId: "prod-x-burger",
              escolhas: { "grp-x-burger-1": ["opc-x-burger-1-1"] },
              quantidade: 1,
            },
          ],
        }),
      ).rejects.toThrow("X-Burger: Bacon não está mais no cardápio.")
    })
  })

  test("marcar como impresso guarda a hora da impressão", async () => {
    const api = servidor()
    const [pedido] = await api.pedidos.listar({ status: ["recebido"] })
    const impresso = await api.pedidos.marcarImpresso(pedido.id)
    expect(impresso.impressoEm).toBe(AGORA.toISOString())
  })

  describe("agendamentos do salão", () => {
    /** Como o Empório (terça a sábado, 9h às 19h, 2 ao mesmo tempo), sem pedidos gerados. */
    function salao() {
      const catalogo = catalogoDeTeste()
      catalogo.loja.horarios = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
        dia,
        aberto: dia >= 2,
        abre: "09:00",
        fecha: "19:00",
      }))
      catalogo.loja.capacidadeAtendimentos = 2
      catalogo.clientes = []
      const [modelo] = catalogo.produtos
      catalogo.produtos = [
        { ...modelo, id: "corte", nome: "Corte", preco: 50, custo: 12, duracaoMin: 60, grupos: [] },
        {
          ...modelo,
          id: "escova",
          nome: "Escova",
          preco: 40,
          custo: 9,
          duracaoMin: 30,
          grupos: [],
        },
      ]
      return criarServidor({ segmento: "salao", carregarCatalogo: async () => catalogo, espera: 0 })
    }

    /** Sábado, 14/11/2026. */
    const sabado = (hora: number, minuto = 0) => new Date(2026, 10, 14, hora, minuto).toISOString()
    const novo = (inicio: string, servicos = ["corte"]) => ({
      cliente: { nome: "Bruna Alves", telefone: "(12) 99111-0000" },
      servicos,
      inicio,
      pagamento: "pix" as const,
    })

    test("o atendimento guarda o custo de cada serviço", async () => {
      const pedido = await salao().agendamentos.criar(novo(sabado(10), ["corte", "escova"]))
      expect(pedido.itens.map((item) => [item.nome, item.custoUnitario])).toEqual([
        ["Corte", 12],
        ["Escova", 9],
      ])
    })

    test("o preço e a duração saem dos serviços, e o atendimento é pago no salão", async () => {
      const pedido = await salao().agendamentos.criar(novo(sabado(10), ["corte", "escova"]))
      expect(pedido).toMatchObject({
        origem: "painel",
        tipo: "atendimento",
        status: "recebido",
        cliente: { nome: "Bruna Alves", telefone: "12991110000" },
        total: 90,
        pagamento: "pix",
        situacaoPagamento: "na-entrega",
        agendamento: { inicio: sabado(10), duracaoMin: 90 },
      })
      expect(pedido.itens.map((item) => [item.nome, item.total])).toEqual([
        ["Corte", 50],
        ["Escova", 40],
      ])
      expect(pedido.token).toMatch(UUID)
    })

    test("recusa dia fechado, horário passado, fora do expediente e horário cheio", async () => {
      const api = salao()
      const domingo = new Date(2026, 10, 15, 10).toISOString()
      await expect(api.agendamentos.criar(novo(domingo))).rejects.toThrow(
        "O salão não abre neste dia.",
      )
      const sextaCedo = new Date(2026, 10, 13, 10).toISOString()
      await expect(api.agendamentos.criar(novo(sextaCedo))).rejects.toThrow(
        "Esse horário já passou.",
      )
      await expect(api.agendamentos.criar(novo(sabado(18, 30)))).rejects.toThrow(
        "Fora do horário de atendimento.",
      )
      await expect(api.agendamentos.criar(novo(sabado(10, 15)))).rejects.toThrow(
        "Fora do horário de atendimento.",
      )
      await expect(api.agendamentos.criar(novo(sabado(10), []))).rejects.toThrow(
        "Escolha pelo menos um serviço.",
      )

      await api.agendamentos.criar(novo(sabado(10)))
      await api.agendamentos.criar(novo(sabado(10, 30), ["escova"]))
      await expect(api.agendamentos.criar(novo(sabado(10)))).rejects.toThrow(
        "Esse horário está cheio.",
      )
      await api.produtos.alternar("escova", "disponivel")
      await expect(api.agendamentos.criar(novo(sabado(15), ["escova"]))).rejects.toThrow(
        "Escova está indisponível.",
      )
    })

    test("recusa forma de pagamento desconhecida", async () => {
      const estranho = { ...novo(sabado(10)), pagamento: "cheque" } as unknown as NovoAgendamento
      await expect(salao().agendamentos.criar(estranho)).rejects.toThrow(
        "Escolha uma forma de pagamento válida.",
      )
    })

    test("os horários livres do dia somem quando enchem", async () => {
      const api = salao()
      const livres = () =>
        api.agendamentos.horarios({ dia: new Date(2026, 10, 14), servicos: ["corte"] })
      expect((await livres()).slice(0, 3)).toEqual([sabado(9), sabado(9, 30), sabado(10)])
      await api.agendamentos.criar(novo(sabado(9)))
      await api.agendamentos.criar(novo(sabado(9)))
      expect((await livres()).slice(0, 2)).toEqual([sabado(10), sabado(10, 30)])
    })

    test("o atendimento simulado respeita a agenda que já existe", async () => {
      const api = salao()
      await api.agendamentos.criar(novo(sabado(9)))
      await api.agendamentos.criar(novo(sabado(9)))
      const simulado = await api.pedidos.simular()
      expect(Date.parse(simulado.agendamento?.inicio ?? "")).toBeGreaterThanOrEqual(
        Date.parse(sabado(10)),
      )
    })

    test("remarcar muda o horário, sem contar o próprio; só antes de começar", async () => {
      const api = salao()
      const primeiro = await api.agendamentos.criar(novo(sabado(10)))
      await api.agendamentos.criar(novo(sabado(10)))
      // O horário está cheio, mas um dos dois é o próprio: continua cabendo.
      expect((await api.agendamentos.remarcar(primeiro.id, sabado(10))).agendamento?.inicio).toBe(
        sabado(10),
      )
      const remarcado = await api.agendamentos.remarcar(primeiro.id, sabado(15))
      expect(remarcado.agendamento).toEqual({ inicio: sabado(15), duracaoMin: 60 })

      await api.agendamentos.remarcar(primeiro.id, sabado(10))
      const outro = await api.agendamentos.criar(novo(sabado(16)))
      await expect(api.agendamentos.remarcar(outro.id, sabado(10))).rejects.toThrow(
        "Esse horário está cheio.",
      )
      await api.pedidos.avancar(outro.id, "recebido")
      await expect(api.agendamentos.remarcar(outro.id, sabado(17))).rejects.toThrow(
        "Só dá para remarcar antes de começar.",
      )
    })
  })

  describe("salão", () => {
    test("salvar a configuração guarda e devolve; a próxima leitura vê a mudança", async () => {
      const api = servidor()
      const atual = await api.salao.config()
      expect(atual.areas).toEqual([{ id: "area-salao", nome: "Salão", ordem: 1 }])

      const salva = await api.salao.salvar({
        ...atual,
        areas: [...atual.areas, { id: "area-varanda", nome: "  Varanda ", ordem: 2 }],
        taxaServico: { ativa: true, percentual: 12 },
      })
      expect(salva.areas.map((area) => area.nome)).toEqual(["Salão", "Varanda"])
      expect((await api.salao.config()).taxaServico).toEqual({ ativa: true, percentual: 12 })
    })

    test("configuração inválida é recusada com a primeira mensagem", async () => {
      const api = servidor()
      const atual = await api.salao.config()
      await expect(
        api.salao.salvar({ ...atual, taxaServico: { ativa: true, percentual: 21 } }),
      ).rejects.toThrow("A taxa de serviço vai de 0% a 20%.")
      expect((await api.salao.config()).taxaServico.percentual).toBe(10)
    })

    test("excluir uma área com mesas é recusado", async () => {
      const api = servidor()
      const atual = await api.salao.config()
      await expect(
        api.salao.salvar({
          ...atual,
          areas: [{ id: "area-varanda", nome: "Varanda", ordem: 1 }],
        }),
      ).rejects.toThrow("Mova as mesas da área Salão antes de excluí-la.")
      expect((await api.salao.config()).areas.map((area) => area.id)).toEqual(["area-salao"])
    })
  })

  describe("mesas", () => {
    test("mesa nova com número único; a lista vem pelo número", async () => {
      const api = servidor()
      const nova = await api.mesas.criar({ numero: 7 })
      expect(nova).toMatchObject({ numero: 7, nome: "Mesa 07", status: "livre" })
      expect((await api.mesas.listar()).map((mesa) => mesa.numero)).toEqual([1, 2, 7])

      await expect(api.mesas.criar({ numero: 7 })).rejects.toThrow("Já existe a mesa 7.")
      await expect(api.mesas.criar({ numero: 0 })).rejects.toThrow("Informe o número da mesa.")
      expect((await api.mesas.criar({ numero: 8, nome: " Varanda " })).nome).toBe("Varanda")
    })

    test("mesa nova entra na primeira área, com 4 lugares, quadrada e na primeira posição livre", async () => {
      const api = servidor()
      const mesa = await api.mesas.criar({ numero: 30 })
      const salao = await api.salao.config()
      expect(mesa).toMatchObject({ areaId: salao.areas[0].id, lugares: 4, forma: "quadrada" })
      // as mesas 1 e 2 do catálogo de teste estão em x 0 e 4: a primeira vaga é x 2
      expect(mesa.posicao).toEqual({ x: 2, y: 0 })
      expect(await api.mesas.criar({ numero: 31, lugares: 6, forma: "redonda" })).toMatchObject({
        lugares: 6,
        forma: "redonda",
      })
    })

    test("lugares fora de 1 a 20, forma inválida e área que não existe são recusados", async () => {
      await expect(servidor().mesas.criar({ numero: 31, lugares: 0 })).rejects.toThrow(
        "Informe de 1 a 20 lugares.",
      )
      await expect(servidor().mesas.criar({ numero: 31, lugares: 21 })).rejects.toThrow(
        "Informe de 1 a 20 lugares.",
      )
      await expect(servidor().mesas.criar({ numero: 31, areaId: "nada" })).rejects.toThrow(
        "Escolha uma área do salão.",
      )
      await expect(servidor().mesas.criar({ numero: 31, areaId: "" })).rejects.toThrow(
        "Escolha uma área do salão.",
      )
      await expect(
        servidor().mesas.criar({ numero: 31, forma: "triangular" as never }),
      ).rejects.toThrow("Escolha a forma da mesa.")
    })

    test("área sem espaço no mapa recusa a mesa nova", async () => {
      const chave = "clickpedido-admin-dados:lanchonete"
      const api = servidor()
      const [modelo] = await api.mesas.listar()
      const guardado = (await get(chave)) as { base: { mesas: Mesa[] } }
      // 96 mesas 2 × 2 enchem a grade 24 × 16
      guardado.base.mesas = Array.from({ length: 96 }, (_, i) => ({
        ...modelo,
        id: `cheia-${i}`,
        numero: 100 + i,
        areaId: "area-salao",
        forma: "quadrada" as const,
        lugares: 4,
        posicao: { x: (i % 12) * 2, y: Math.floor(i / 12) * 2 },
      }))
      await set(chave, guardado)
      await expect(servidor().mesas.criar({ numero: 300 })).rejects.toThrow(
        "Não cabe mais mesa nessa área do mapa.",
      )
    })

    describe("editar", () => {
      const AGUA = [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }]

      /** Duas mesas livres, em x 0 e x 4 da linha 8 do salão (as do catálogo ficam na linha 0). */
      async function duasMesas() {
        const [a, b] = [
          await servidor().mesas.criar({ numero: 20 }),
          await servidor().mesas.criar({ numero: 21 }),
        ]
        await alterarGuardada(a.id, { posicao: { x: 0, y: 8 } })
        await alterarGuardada(b.id, { posicao: { x: 4, y: 8 } })
        const igual = (mesa: Mesa) => ({
          numero: mesa.numero,
          nome: mesa.nome,
          areaId: mesa.areaId,
          lugares: mesa.lugares,
          forma: mesa.forma,
        })
        return { api: servidor(), a, b, igual }
      }

      /** Salão com uma segunda área, a Varanda. */
      async function comVaranda(api: Servidor) {
        const salao = await api.salao.config()
        await api.salao.salvar({
          ...salao,
          areas: [...salao.areas, { id: "area-varanda", nome: "Varanda", ordem: 2 }],
        })
      }

      test("troca nome, área, lugares e forma", async () => {
        const { api, a, igual } = await duasMesas()
        await comVaranda(api)
        const editada = await api.mesas.editar(a.id, {
          ...igual(a),
          nome: " Janela ",
          areaId: "area-varanda",
          lugares: 6,
          forma: "redonda",
        })
        expect(editada).toMatchObject({
          id: a.id,
          numero: 20,
          nome: "Janela",
          areaId: "area-varanda",
          lugares: 6,
          forma: "redonda",
        })
        expect((await api.mesas.listar()).find((mesa) => mesa.id === a.id)).toEqual(editada)
      })

      test("número repetido é recusado", async () => {
        const { api, a, igual } = await duasMesas()
        await expect(api.mesas.editar(a.id, { ...igual(a), numero: 21 })).rejects.toThrow(
          "Já existe a mesa 21.",
        )
      })

      test("mesa ocupada não troca de número, mas muda nome e lugares", async () => {
        const { api, a, igual } = await duasMesas()
        await api.mesas.lancar({ mesaId: a.id, enviarParaCozinha: false, itens: AGUA })
        await expect(api.mesas.editar(a.id, { ...igual(a), numero: 29 })).rejects.toThrow(
          "Feche a conta antes de mudar o número da mesa.",
        )
        const editada = await api.mesas.editar(a.id, {
          ...igual(a),
          nome: "Aniversário",
          lugares: 8,
        })
        expect(editada).toMatchObject({ nome: "Aniversário", lugares: 8, status: "ocupada" })
      })

      test("trocando de área, a mesa vai para a primeira posição livre da área nova", async () => {
        const { api, b, igual } = await duasMesas()
        await comVaranda(api)
        const editada = await api.mesas.editar(b.id, { ...igual(b), areaId: "area-varanda" })
        expect(editada.posicao).toEqual({ x: 0, y: 0 })
      })

      test("virar retangular de 8 lugares sobre uma vizinha leva a mesa para uma posição livre", async () => {
        const { api, a, b, igual } = await duasMesas()
        // A mesa de 4 células de largura, em x 0, cruzaria a vizinha, que passa para x 3.
        await alterarGuardada(b.id, { posicao: { x: 3, y: 8 } })
        const editada = await servidor().mesas.editar(a.id, {
          ...igual(a),
          lugares: 8,
          forma: "retangular",
        })
        const vizinha = (await api.mesas.listar()).find((mesa) => mesa.id === b.id) as Mesa
        expect(mesasSeCruzam(editada, vizinha)).toBe(false)
        // A varredura começa na linha 0, onde as mesas 1 e 2 do catálogo ocupam x 0-1 e 4-5.
        expect(editada.posicao).toEqual({ x: 6, y: 0 })
      })

      test("sem sobreposição, a mesa fica onde estava", async () => {
        const { api, b, igual } = await duasMesas()
        const editada = await api.mesas.editar(b.id, { ...igual(b), lugares: 2, forma: "redonda" })
        expect(editada.posicao).toEqual({ x: 4, y: 8 })
      })

      test("nome vazio volta para o padrão", async () => {
        const { api, a, igual } = await duasMesas()
        const editada = await api.mesas.editar(a.id, { ...igual(a), numero: 7, nome: "   " })
        expect(editada.nome).toBe("Mesa 07")
      })

      test("lugares, forma e área inválidos usam as mesmas mensagens de criar", async () => {
        const { api, a, igual } = await duasMesas()
        await expect(api.mesas.editar(a.id, { ...igual(a), lugares: 21 })).rejects.toThrow(
          "Informe de 1 a 20 lugares.",
        )
        await expect(
          api.mesas.editar(a.id, { ...igual(a), forma: "triangular" as never }),
        ).rejects.toThrow("Escolha a forma da mesa.")
        await expect(api.mesas.editar(a.id, { ...igual(a), areaId: "nada" })).rejects.toThrow(
          "Escolha uma área do salão.",
        )
      })

      test("id inexistente", async () => {
        const { api, a, igual } = await duasMesas()
        await expect(api.mesas.editar("nada", igual(a))).rejects.toThrow("Mesa não encontrada")
      })
    })

    describe("bloquear, desbloquear e marcar limpa", () => {
      const AGUA = [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }]

      test("bloquear guarda o motivo aparado e cortado em 80", async () => {
        const api = servidor()
        const mesa = await api.mesas.criar({ numero: 20 })
        expect((await api.mesas.bloquear(mesa.id, "  Em manutenção  ")).bloqueio).toEqual({
          motivo: "Em manutenção",
        })
        const longo = await api.mesas.bloquear(mesa.id, "x".repeat(100))
        expect(longo.bloqueio?.motivo).toBe("x".repeat(80))
        expect((await api.mesas.listar()).find((item) => item.id === mesa.id)?.bloqueio).toEqual({
          motivo: "x".repeat(80),
        })
      })

      test("sem motivo, o bloqueio fica vazio", async () => {
        const api = servidor()
        const mesa = await api.mesas.criar({ numero: 20 })
        expect((await api.mesas.bloquear(mesa.id)).bloqueio).toEqual({})
        expect((await api.mesas.bloquear(mesa.id, "   ")).bloqueio).toEqual({})
      })

      test("mesa ocupada não bloqueia", async () => {
        const api = servidor()
        const mesa = await api.mesas.criar({ numero: 20 })
        await api.mesas.lancar({ mesaId: mesa.id, enviarParaCozinha: false, itens: AGUA })
        await expect(api.mesas.bloquear(mesa.id, "Quebrada")).rejects.toThrow(
          "Feche a conta antes de bloquear a mesa.",
        )
      })

      test("desbloquear tira o bloqueio e a mesa volta a aceitar lançamento", async () => {
        const api = servidor()
        const mesa = await api.mesas.criar({ numero: 20 })
        await api.mesas.bloquear(mesa.id, "Em manutenção")
        await expect(
          api.mesas.lancar({ mesaId: mesa.id, enviarParaCozinha: false, itens: AGUA }),
        ).rejects.toThrow("A mesa 20 está bloqueada.")
        const livre = await api.mesas.desbloquear(mesa.id)
        expect(livre.bloqueio).toBeUndefined()
        const comanda = await api.mesas.lancar({
          mesaId: mesa.id,
          enviarParaCozinha: false,
          itens: AGUA,
        })
        expect(comanda.mesa?.id).toBe(mesa.id)
      })

      test("marcar limpa tira a limpeza", async () => {
        const mesa = await servidor().mesas.criar({ numero: 20 })
        await alterarGuardada(mesa.id, { limpezaDesde: AGORA.toISOString() })
        const api = servidor()
        const limpa = await api.mesas.marcarLimpa(mesa.id)
        expect(limpa.limpezaDesde).toBeUndefined()
        expect(
          (await api.mesas.listar()).find((item) => item.id === mesa.id)?.limpezaDesde,
        ).toBeUndefined()
      })

      test("id inexistente nas quatro operações", async () => {
        const api = servidor()
        await expect(
          api.mesas.editar("nada", {
            numero: 1,
            areaId: "area-salao",
            lugares: 4,
            forma: "quadrada",
          }),
        ).rejects.toThrow("Mesa não encontrada")
        await expect(api.mesas.bloquear("nada")).rejects.toThrow("Mesa não encontrada")
        await expect(api.mesas.desbloquear("nada")).rejects.toThrow("Mesa não encontrada")
        await expect(api.mesas.marcarLimpa("nada")).rejects.toThrow("Mesa não encontrada")
      })
    })

    describe("limpeza ao fechar a conta", () => {
      const AGUA = [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }]

      /** Mesa nova com uma comanda aberta; a limpeza do salão ligada ou desligada. */
      async function comComanda(limpeza: boolean) {
        const api = servidor()
        await api.salao.salvar({ ...(await api.salao.config()), limpeza })
        const mesa = await api.mesas.criar({ numero: 20 })
        const comanda = await api.mesas.lancar({
          mesaId: mesa.id,
          enviarParaCozinha: false,
          itens: AGUA,
        })
        return { api, mesa, comanda }
      }

      const mesaDe = async (api: Servidor, id: string) =>
        (await api.mesas.listar()).find((item) => item.id === id) as Mesa

      test("com a limpeza ligada, a mesa fica em limpeza desde o pagamento", async () => {
        const { api, mesa, comanda } = await comComanda(true)
        vi.setSystemTime(new Date(2026, 10, 13, 21, 0))
        await api.mesas.fecharConta(comanda.id, "pix")
        expect(await mesaDe(api, mesa.id)).toMatchObject({
          status: "livre",
          limpezaDesde: new Date(2026, 10, 13, 21, 0).toISOString(),
        })
      })

      test("desligar a limpeza no salão tira da limpeza a mesa que esperava ser limpa", async () => {
        const { api, mesa, comanda } = await comComanda(true)
        await api.mesas.fecharConta(comanda.id, "pix")
        await api.salao.salvar({ ...(await api.salao.config()), limpeza: false })
        expect((await mesaDe(api, mesa.id)).limpezaDesde).toBeUndefined()
      })

      test("com a limpeza desligada, a mesa fica livre e sem limpeza", async () => {
        const { api, mesa, comanda } = await comComanda(false)
        await api.mesas.fecharConta(comanda.id, "pix")
        expect((await mesaDe(api, mesa.id)).limpezaDesde).toBeUndefined()
      })

      test("reabrir a base em outro dia encerra a comanda aberta sem pôr a mesa em limpeza", async () => {
        const api = servidor()
        await api.salao.salvar({ ...(await api.salao.config()), limpeza: true })
        // A demonstração do dia novo ocupa as primeiras mesas: a da comanda velha fica no fim.
        for (let numero = 20; numero < 30; numero++) await api.mesas.criar({ numero })
        const ultima = (await api.mesas.listar()).at(-1) as Mesa
        await api.mesas.lancar({ mesaId: ultima.id, enviarParaCozinha: false, itens: AGUA })

        vi.setSystemTime(new Date(2026, 10, 15, 21, 0))
        const depois = await mesaDe(servidor(), ultima.id)
        expect(depois.status).toBe("livre")
        expect(depois.limpezaDesde).toBeUndefined()
      })

      test("liberar uma comanda vazia nunca deixa limpeza", async () => {
        const api = servidor()
        await api.salao.salvar({ ...(await api.salao.config()), limpeza: true })
        const mesa = await api.mesas.criar({ numero: 20 })
        // Comanda aberta e vazia: o garçom lança e remove o item.
        const comanda = await api.mesas.lancar({
          mesaId: mesa.id,
          enviarParaCozinha: false,
          itens: AGUA,
        })
        await api.mesas.removerItem(comanda.id, comanda.itens[0].id)
        await api.mesas.liberar(mesa.id)
        expect(await mesaDe(api, mesa.id)).toMatchObject({ status: "livre" })
        expect((await mesaDe(api, mesa.id)).limpezaDesde).toBeUndefined()
      })
    })

    test("só exclui mesa livre", async () => {
      const api = servidor()
      const livre = await api.mesas.criar({ numero: 9 })
      await api.mesas.excluir(livre.id)
      expect((await api.mesas.listar()).map((mesa) => mesa.numero)).toEqual([1, 2])

      const ocupada = await api.mesas.criar({ numero: 10 })
      await api.mesas.lancar({
        mesaId: ocupada.id,
        enviarParaCozinha: false,
        itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
      })
      await expect(api.mesas.excluir(ocupada.id)).rejects.toThrow(
        "Feche a conta antes de excluir a mesa.",
      )
    })

    /** Altera a mesa direto na base guardada, como se outra aba a tivesse bloqueado ou posto em limpeza. */
    async function alterarGuardada(mesaId: string, mudanca: Partial<Mesa>) {
      const chave = "clickpedido-admin-dados:lanchonete"
      const guardado = (await get(chave)) as { base: { mesas: Mesa[] } }
      guardado.base.mesas = guardado.base.mesas.map((mesa) =>
        mesa.id === mesaId ? { ...mesa, ...mudanca } : mesa,
      )
      await set(chave, guardado)
    }

    test("mesa bloqueada não recebe comanda", async () => {
      const mesa = await servidor().mesas.criar({ numero: 5 })
      await alterarGuardada(mesa.id, { bloqueio: { motivo: "Em manutenção" } })
      const api = servidor()
      await expect(
        api.mesas.lancar({
          mesaId: mesa.id,
          enviarParaCozinha: false,
          itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
        }),
      ).rejects.toThrow("A mesa 5 está bloqueada.")
      expect((await api.mesas.listar()).find((item) => item.id === mesa.id)?.status).toBe("livre")
    })

    test("lançar numa mesa em limpeza ocupa a mesa e tira a limpeza; ao fechar a conta ela fica livre sem limpeza", async () => {
      const mesa = await servidor().mesas.criar({ numero: 5 })
      await alterarGuardada(mesa.id, {
        limpezaDesde: new Date(AGORA.getTime() - 60_000).toISOString(),
      })
      const outra = servidor()
      const comanda = await outra.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: false,
        itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
      })
      const ocupada = (await outra.mesas.listar()).find((item) => item.id === mesa.id)
      expect(ocupada?.status).toBe("ocupada")
      expect(ocupada?.limpezaDesde).toBeUndefined()
      await outra.mesas.fecharConta(comanda.id, "pix")
      const liberada = (await outra.mesas.listar()).find((item) => item.id === mesa.id)
      expect(liberada?.status).toBe("livre")
      expect(liberada?.limpezaDesde).toBeUndefined()
    })

    const BACON = { "grp-x-burger-1": ["opc-x-burger-1-1"] }

    test("o preço vem do cardápio e das escolhas, nunca da tela", async () => {
      const api = servidor()
      const mesa = await api.mesas.criar({ numero: 5 })
      const comanda = await api.mesas.lancar({
        mesaId: mesa.id,
        garcom: "Rafa",
        clienteNome: "Júlia",
        enviarParaCozinha: true,
        itens: [
          { produtoId: "prod-x-burger", escolhas: BACON, quantidade: 2, observacao: "sem cebola" },
        ],
      })
      expect(comanda).toMatchObject({
        origem: "garcom",
        tipo: "mesa",
        status: "recebido",
        cliente: { nome: "Júlia" },
        mesa: { numero: 5, garcom: "Rafa" },
        subtotal: 46,
        total: 46,
      })
      expect(comanda.itens[0]).toMatchObject({
        nome: "X-Burger",
        precoUnitario: 23,
        total: 46,
        opcoes: ["Adicional: Bacon"],
        observacao: "sem cebola",
        rodada: 1,
        vaiParaCozinha: true,
      })
      expect((await api.mesas.listar()).find((item) => item.id === mesa.id)).toMatchObject({
        status: "ocupada",
        pedidoAtivoId: comanda.id,
        clienteNome: "Júlia",
      })
    })

    test("no segmento com preço de balcão, a mesa paga o preço de balcão", async () => {
      const api = criarServidor({
        segmento: "pizzaria",
        carregarCatalogo: async () => catalogoDeTeste(),
        espera: 0,
      })
      const [lanche] = await api.produtos.listar()
      await api.produtos.salvar({ ...lanche, precoBalcao: 18 })
      const mesa = await api.mesas.criar({ numero: 5 })
      const comanda = await api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: true,
        itens: [{ produtoId: lanche.id, escolhas: BACON, quantidade: 1 }],
      })
      expect(comanda.itens[0].precoUnitario).toBe(21)
    })

    test("recusa opção que falta, opção que não existe e produto esgotado", async () => {
      const api = servidor()
      const mesa = await api.mesas.criar({ numero: 5 })
      const lancar = (escolhas: Record<string, string[]>) =>
        api.mesas.lancar({
          mesaId: mesa.id,
          enviarParaCozinha: true,
          itens: [{ produtoId: "prod-x-burger", escolhas, quantidade: 1 }],
        })
      await expect(lancar({})).rejects.toThrow("X-Burger: Escolha 1 opção.")
      await expect(lancar({ "grp-x-burger-1": ["opc-falsa"] })).rejects.toThrow(
        "X-Burger: opção inválida.",
      )
      await api.produtos.alternar("prod-x-burger", "disponivel")
      await expect(lancar(BACON)).rejects.toThrow("X-Burger está esgotado.")
      expect((await api.mesas.listar()).find((item) => item.id === mesa.id)?.status).toBe("livre")
    })

    test("rodada nova: sem cozinha não muda a etapa; com cozinha volta para Novo", async () => {
      const api = servidor()
      const mesa = await api.mesas.criar({ numero: 5 })
      const lanche = { produtoId: "prod-x-burger", escolhas: BACON, quantidade: 1 }
      const agua = { avulso: { nome: "Água", preco: 4 }, quantidade: 2 }

      const soBebida = await api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: false,
        itens: [agua],
      })
      expect(soBebida.status).toBe("pronto")

      await api.mesas.lancar({ mesaId: mesa.id, enviarParaCozinha: true, itens: [lanche] })
      await api.pedidos.avancar(soBebida.id, "recebido")
      await api.pedidos.avancar(soBebida.id, "em-preparo")
      const servido = await api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: false,
        itens: [agua],
      })
      expect(servido.status).toBe("pronto")

      const terceira = await api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: true,
        itens: [lanche],
      })
      expect(terceira.id).toBe(soBebida.id)
      expect(terceira.status).toBe("recebido")
      expect(terceira.itens.map((item) => [item.nome, item.rodada, item.vaiParaCozinha])).toEqual([
        ["Água", 1, false],
        ["X-Burger", 2, true],
        ["Água", 3, false],
        ["X-Burger", 4, true],
      ])
      expect(terceira.total).toBe(62)
    })

    async function comandaComDoisItens() {
      const api = servidor()
      const mesa = await api.mesas.criar({ numero: 5 })
      const comanda = await api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: false,
        itens: [
          { avulso: { nome: "Água", preco: 4 }, quantidade: 1 },
          { avulso: { nome: "Suco", preco: 9.5 }, quantidade: 1 },
        ],
      })
      return { api, mesa, comanda }
    }

    test("mudar a quantidade e remover item refazem o total", async () => {
      const { api, comanda } = await comandaComDoisItens()
      const [agua, suco] = comanda.itens
      const mais = await api.mesas.alterarQuantidade(comanda.id, agua.id, 3)
      expect(mais.itens[0]).toMatchObject({ quantidade: 3, total: 12 })
      expect(mais.total).toBe(21.5)

      const sem = await api.mesas.removerItem(comanda.id, suco.id)
      expect(sem.itens.map((item) => item.nome)).toEqual(["Água"])
      expect(sem.total).toBe(12)

      const [entrega] = await api.pedidos.listar({ status: ["recebido"] })
      await expect(api.mesas.removerItem(entrega.id, entrega.itens[0].id)).rejects.toThrow(
        "Só a comanda aberta de uma mesa pode mudar.",
      )
      await expect(api.mesas.alterarQuantidade(comanda.id, agua.id, 0)).rejects.toThrow(
        "Informe uma quantidade válida.",
      )
    })

    test("quantidade que não é número: no lançamento vale 1, na comanda é recusada", async () => {
      const { api, mesa, comanda } = await comandaComDoisItens()
      const lancada = await api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: false,
        itens: [{ avulso: { nome: "Gelo", preco: 2 }, quantidade: Number.NaN }],
      })
      expect(lancada.itens.at(-1)).toMatchObject({ nome: "Gelo", quantidade: 1, total: 2 })
      expect(lancada.total).toBe(15.5)
      await expect(
        api.mesas.alterarQuantidade(comanda.id, comanda.itens[0].id, Number.NaN),
      ).rejects.toThrow("Informe uma quantidade válida.")
    })

    test("garçom e cliente da comanda têm limite de tamanho", async () => {
      const api = servidor()
      const mesa = await api.mesas.criar({ numero: 5 })
      const comanda = await api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: false,
        garcom: "G".repeat(100),
        clienteNome: "C".repeat(100),
        itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
      })
      expect(comanda.mesa?.garcom).toHaveLength(80)
      expect(comanda.cliente.nome).toHaveLength(80)
    })

    test("fechar a conta com forma de pagamento desconhecida é recusado", async () => {
      const { api, comanda } = await comandaComDoisItens()
      await expect(
        api.mesas.fecharConta(comanda.id, "cheque" as unknown as PagamentoMesa),
      ).rejects.toThrow("Escolha uma forma de pagamento válida.")
    })

    test("mudar ou remover item que não está na comanda é recusado", async () => {
      const { api, comanda } = await comandaComDoisItens()
      await expect(api.mesas.alterarQuantidade(comanda.id, "item-nada", 2)).rejects.toThrow(
        "Item não encontrado na comanda",
      )
      await expect(api.mesas.removerItem(comanda.id, "item-nada")).rejects.toThrow(
        "Item não encontrado na comanda",
      )
    })

    test("item avulso precisa de nome e de preço válido", async () => {
      const { api, mesa } = await comandaComDoisItens()
      const avulso = (nome: string, preco: number) =>
        api.mesas.lancar({
          mesaId: mesa.id,
          enviarParaCozinha: false,
          itens: [{ avulso: { nome, preco }, quantidade: 1 }],
        })
      await expect(avulso("  ", 5)).rejects.toThrow("Informe o nome do item avulso.")
      await expect(avulso("Couvert", 0)).rejects.toThrow("Informe um preço válido.")
      await expect(avulso("Couvert", 10_000)).rejects.toThrow("Informe um preço válido.")
    })

    test("fechar a conta conclui, marca como pago e libera a mesa", async () => {
      const { api, mesa, comanda } = await comandaComDoisItens()
      const fechada = await api.mesas.fecharConta(comanda.id, "pix")
      expect(fechada).toMatchObject({
        status: "concluido",
        pagamento: "pix",
        situacaoPagamento: "pago",
        pagoEm: AGORA.toISOString(),
        total: 13.5,
      })
      expect((await api.mesas.listar()).find((item) => item.id === mesa.id)?.status).toBe("livre")
      await expect(api.mesas.fecharConta(comanda.id, "pix")).rejects.toThrow(
        "Só a comanda aberta de uma mesa pode mudar.",
      )
    })

    test("liberar só sem itens na comanda; a comanda vazia é cancelada", async () => {
      const { api, mesa, comanda } = await comandaComDoisItens()
      await expect(api.mesas.liberar(mesa.id)).rejects.toThrow(
        "Feche a conta antes de liberar a mesa.",
      )
      for (const item of comanda.itens) await api.mesas.removerItem(comanda.id, item.id)
      await expect(api.mesas.fecharConta(comanda.id, "pix")).rejects.toThrow(
        "A comanda está vazia.",
      )

      await api.mesas.liberar(mesa.id)
      expect((await api.pedidos.buscar(comanda.id))?.status).toBe("cancelado")
      expect((await api.mesas.listar()).find((item) => item.id === mesa.id)?.status).toBe("livre")
    })
  })

  test("a configuração da loja vem sem os pedidos", async () => {
    const loja = await servidor().loja()
    expect(loja.nome).toBe("Teste")
    expect(loja).not.toHaveProperty("pedidos")
  })

  test("se a primeira leitura falhar, a próxima tenta de novo", async () => {
    let chamadas = 0
    const api = criarServidor({
      segmento: "lanchonete",
      carregarCatalogo: async () => {
        chamadas += 1
        if (chamadas === 1) throw new Error("Banco indisponível")
        return catalogoDeTeste()
      },
      espera: 0,
    })
    await expect(api.loja()).rejects.toThrow("Banco indisponível")
    expect((await api.loja()).nome).toBe("Teste")
  })

  test("se restaurar falhar, a próxima leitura tenta de novo", async () => {
    let falhar = false
    const api = criarServidor({
      segmento: "lanchonete",
      carregarCatalogo: async () => {
        if (falhar) {
          falhar = false
          throw new Error("Banco indisponível")
        }
        return catalogoDeTeste()
      },
      espera: 0,
    })
    await api.loja()
    falhar = true
    await expect(api.restaurar()).rejects.toThrow("Banco indisponível")
    expect((await api.loja()).nome).toBe("Teste")
  })

  test("restaurar volta aos dados de demonstração", async () => {
    const api = servidor()
    const [novo] = await api.pedidos.listar({ status: ["recebido"] })
    await api.pedidos.cancelar(novo.id, "recebido")

    await api.restaurar()
    expect((await api.pedidos.buscar(novo.id))?.status).toBe("recebido")
  })
})

describe("migração", () => {
  const CHAVE = "clickpedido-admin-dados:lanchonete"

  /** Base como o servidor da versão 3 a guardava (já com custos): sem salão, reservas, espera, chamados e campos novos das mesas. */
  async function baseDaVersao3(): Promise<BaseLojaV3> {
    await servidor().pedidos.listar()
    const { base } = (await get(CHAVE)) as { base: Record<string, unknown> & { mesas: Mesa[] } }
    const { salao, reservas, espera, chamados, ...resto } = base
    return {
      ...resto,
      mesas: base.mesas.map(
        ({ id, numero, nome, status, pedidoAtivoId, clienteNome, ocupadaEm }) => ({
          id,
          numero,
          nome,
          status,
          pedidoAtivoId,
          clienteNome,
          ocupadaEm,
        }),
      ),
    } as unknown as BaseLojaV3
  }

  test("base da versão 3 é migrada: mesmos pedidos, mesa ocupada com a mesma comanda e o mesmo total", async () => {
    const antiga = await baseDaVersao3()
    const ocupadaAntes = antiga.mesas.find((mesa) => mesa.status === "ocupada")
    const comandaAntes = antiga.pedidos.find((pedido) => pedido.id === ocupadaAntes?.pedidoAtivoId)
    expect(comandaAntes).toBeDefined()
    await set(CHAVE, { versao: 3, geradoEm: AGORA.toISOString(), base: antiga })
    const api = servidor()
    const mesas = await api.mesas.listar()
    expect(mesas.every((mesa) => mesa.areaId === "area-salao")).toBe(true)
    const ocupada = mesas.find((mesa) => mesa.status === "ocupada")
    expect(ocupada).toBeDefined()
    expect(ocupada?.pedidoAtivoId).toBe(ocupadaAntes?.pedidoAtivoId)
    const comandaDepois = (await api.base()).pedidos.find(
      (pedido) => pedido.id === ocupada?.pedidoAtivoId,
    )
    expect(comandaDepois?.total).toBe(comandaAntes?.total)
    const guardado = (await get(CHAVE)) as { versao: number; base: { pedidos: unknown[] } }
    expect(guardado.base.pedidos).toHaveLength(antiga.pedidos.length)
    expect(guardado.versao).toBe(4)
  })

  test("base da versão 3 que já tem salão (das mesas, sem custos) é recriada", async () => {
    const atual = await servidor().base()
    const semCusto = {
      ...atual,
      produtos: atual.produtos.map(({ custo, ...produto }) => produto),
      pedidos: [],
    }
    await set(CHAVE, { versao: 3, geradoEm: AGORA.toISOString(), base: semCusto })

    const base = await servidor().base()
    expect(base.pedidos.length).toBeGreaterThan(0)
    expect(base.produtos.some((produto) => produto.custo !== undefined)).toBe(true)
    expect(((await get(CHAVE)) as { versao: number }).versao).toBe(4)
  })

  test("base da versão 3 guardada há 3 dias: migra, completa os dias que faltam e mantém os garçons", async () => {
    const antiga = await baseDaVersao3()
    const encerrados = antiga.pedidos.filter((pedido) => pedido.status === "concluido")
    encerrados[0].tipo = "mesa"
    encerrados[0].mesa = { id: "mesa-1", numero: 1, garcom: "Paula" }
    encerrados[1].tipo = "mesa"
    encerrados[1].mesa = { id: "mesa-2", numero: 2, garcom: "Bia" }
    const garconsAntigos = [
      ...new Set(antiga.pedidos.map((pedido) => pedido.mesa?.garcom?.trim()).filter(Boolean)),
    ]
    expect(garconsAntigos.length).toBeGreaterThan(0)
    const tresDiasAntes = new Date(2026, 10, 10, 20, 30)
    await set(CHAVE, { versao: 3, geradoEm: tresDiasAntes.toISOString(), base: antiga })

    const api = servidor()
    const pedidos = await api.pedidos.listar()
    const guardado = (await get(CHAVE)) as { versao: number }
    expect(guardado.versao).toBe(4)
    // dias 11, 12 e 13 de novembro, na hora local
    for (const dia of [11, 12, 13])
      expect(pedidos.some((pedido) => new Date(pedido.criadoEm).getDate() === dia)).toBe(true)

    const { nomes } = {
      nomes: (await api.salao.config()).garcons.map((garcom) => garcom.nome).sort(),
    }
    expect(nomes).toEqual((garconsAntigos as string[]).toSorted())

    const base = await api.base()
    const ocupadas = (await api.mesas.listar()).filter((mesa) => mesa.status === "ocupada")
    expect(ocupadas.length).toBeGreaterThan(0)
    for (const mesa of ocupadas) {
      const comanda = base.pedidos.find((pedido) => pedido.id === mesa.pedidoAtivoId)
      expect(comanda?.mesa?.pessoas).toBeGreaterThanOrEqual(1)
      expect(comanda?.mesa?.pessoas).toBeLessThanOrEqual(4)
    }
  })

  test("depois de migrar uma base com 'Bia', 'bia ' e 'Bía', o salão ainda salva", async () => {
    const antiga = await baseDaVersao3()
    const [primeiro, segundo, terceiro] = antiga.pedidos
    antiga.pedidos = [
      { ...primeiro, mesa: { id: "mesa-1", numero: 1, garcom: "Bia" } },
      { ...segundo, mesa: { id: "mesa-1", numero: 1, garcom: "bia " } },
      { ...terceiro, mesa: { id: "mesa-1", numero: 1, garcom: "Bía" } },
      ...antiga.pedidos.slice(3),
    ]
    await set(CHAVE, { versao: 3, geradoEm: AGORA.toISOString(), base: antiga })
    const api = servidor()
    const config = await api.salao.config()
    expect(config.garcons).toEqual([{ id: "garcom-bia", nome: "Bia", ativo: true }])
    await expect(api.salao.salvar(config)).resolves.toEqual(config)
  })
})
