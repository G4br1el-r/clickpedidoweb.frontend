import "fake-indexeddb/auto"
import { clear } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { carregarCatalogo } from "./catalogos"
import {
  criarServidor,
  type NovoAgendamento,
  type PagamentoMesa,
  type Servidor,
  type VendaPdv,
} from "./servidor"
import type { Pedido, StatusPedido } from "./tipos"

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

  test("cada ação no pedido entra na linha do tempo, com a hora, e fica guardada", async () => {
    const api = servidor()
    const [novo] = await api.pedidos.listar({ status: ["recebido"] })

    await api.pedidos.avancar(novo.id, "recebido")
    vi.setSystemTime(new Date(2026, 10, 13, 20, 34))
    await api.pedidos.marcarImpresso(novo.id)

    expect((await servidor().pedidos.buscar(novo.id))?.historico).toEqual([
      { tipo: "etapa", status: "em-preparo", em: "2026-11-13T23:30:00.000Z" },
      { tipo: "impresso", em: "2026-11-13T23:34:00.000Z" },
    ])
  })

  test("duas abas: avançar ou cancelar a partir de uma etapa que já passou é recusado", async () => {
    const api = servidor()
    const [novo] = await api.pedidos.listar({ status: ["recebido"] })
    await api.pedidos.avancar(novo.id, "recebido")

    const mensagem = "Este pedido já mudou de etapa. Atualize a tela."
    await expect(api.pedidos.avancar(novo.id, "recebido")).rejects.toThrow(mensagem)
    await expect(
      api.pedidos.cancelar(novo.id, "recebido", { motivo: "cliente-pediu" }),
    ).rejects.toThrow(mensagem)
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

    const cancelado = await api.pedidos.cancelar(novo.id, "recebido", { motivo: "cliente-pediu" })
    expect(cancelado.status).toBe("cancelado")
    // Já estava pago: a loja deve devolver o dinheiro ao cliente.
    expect(cancelado.situacaoPagamento).toBe("estorno-pendente")
    expect(cancelado.cancelamento).toEqual({
      tipo: "cancelamento",
      motivo: "cliente-pediu",
      em: AGORA.toISOString(),
    })

    const [concluido] = await api.pedidos.listar({ status: ["concluido"] })
    await expect(
      api.pedidos.cancelar(concluido.id, "concluido", { motivo: "cliente-pediu" }),
    ).rejects.toThrow("Pedido concluído não pode ser cancelado")
  })

  test("cancelar sem pagamento não deixa nada a devolver", async () => {
    const api = servidor()
    const pedidos = await api.pedidos.listar({ status: ["recebido", "em-preparo"] })
    const aPagar = pedidos.find((pedido) => pedido.situacaoPagamento === "na-entrega")
    if (!aPagar) throw new Error("A demonstração devia ter um pedido a pagar na entrega")

    const cancelado = await api.pedidos.cancelar(aPagar.id, aPagar.status, { motivo: "fraude" })
    expect(cancelado.situacaoPagamento).toBe("cancelado")
  })

  test("motivo 'outro' precisa do texto", async () => {
    const api = servidor()
    const [novo] = await api.pedidos.listar({ status: ["recebido"] })

    await expect(
      api.pedidos.cancelar(novo.id, "recebido", { motivo: "outro", detalhe: "  " }),
    ).rejects.toThrow("Escreva o motivo.")
    const cancelado = await api.pedidos.cancelar(novo.id, "recebido", {
      motivo: "outro",
      detalhe: "  Acabou o gás  ",
    })
    expect(cancelado.cancelamento).toMatchObject({ motivo: "outro", detalhe: "Acabou o gás" })
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

  test("ao reabrir em outro dia, completa os dias; o que ficou aberto espera a loja resolver", async () => {
    const doDia13 = await servidor().pedidos.listar({ status: EM_ANDAMENTO })
    expect(doDia13.length).toBeGreaterThan(0)

    vi.setSystemTime(new Date(2026, 10, 15, 21, 0))
    const pedidos = await servidor().pedidos.listar()

    expect(pedidos.some((pedido) => new Date(pedido.criadoEm).getDate() === 15)).toBe(true)
    // Nada é concluído (nem dado como pago) sem a loja dizer: vai para o aviso da fila.
    for (const antes of doDia13) {
      expect(pedidos.find((pedido) => pedido.id === antes.id)).toMatchObject({
        status: antes.status,
        situacaoPagamento: antes.situacaoPagamento,
      })
    }
    // Pix que não foi pago no dia não vira pedido: é cancelado.
    const pixDo13 = pedidos.filter(
      (pedido) =>
        new Date(pedido.criadoEm).getDate() === 13 && pedido.status === "aguardando-pagamento",
    )
    expect(pixDo13).toEqual([])
    const ids = pedidos.map((pedido) => pedido.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test("pedidos esquecidos de outro dia: concluir ou cancelar todos de uma vez", async () => {
    const abertos = await servidor().pedidos.listar({ status: EM_ANDAMENTO })
    vi.setSystemTime(new Date(2026, 10, 15, 21, 0))
    const api = servidor()
    const [primeiro, segundo, ...resto] = abertos

    const concluidos = await api.pedidos.concluirEmLote([primeiro.id, segundo.id])
    expect(concluidos.map((pedido) => pedido.status)).toEqual(["concluido", "concluido"])

    const cancelados = await api.pedidos.cancelarEmLote(
      resto.map((pedido) => pedido.id),
      { motivo: "outro", detalhe: "Esquecido no sistema" },
    )
    expect(new Set(cancelados.map((pedido) => pedido.status))).toEqual(new Set(["cancelado"]))
    expect(cancelados[0].cancelamento).toMatchObject({ detalhe: "Esquecido no sistema" })
    expect(await api.pedidos.listar({ status: EM_ANDAMENTO })).not.toContainEqual(
      expect.objectContaining({ id: primeiro.id }),
    )
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

  test("o histórico do cliente de cada pedido: quem pede pela primeira vez e quem volta", async () => {
    const api = servidor()
    const todos = await api.pedidos.listar()
    const porTelefone = Map.groupBy(
      todos.filter((pedido) => pedido.status !== "cancelado"),
      (pedido) => pedido.cliente.telefone,
    )
    const unico = [...porTelefone.values()].find((lista) => lista.length === 1)?.[0]
    const fiel = [...porTelefone.values()].sort((a, b) => b.length - a.length)[0]
    if (!unico || !fiel) throw new Error("A demonstração devia ter cliente novo e freguês")
    // Listar vem do mais novo para o mais antigo: o primeiro do freguês é o último pedido dele.
    const ultimoDoFiel = fiel[0]

    const historico = await api.pedidos.historicoDosClientes([unico.id, ultimoDoFiel.id])
    expect(historico[unico.id]).toEqual({ anteriores: 0, nosUltimos30: 0 })
    expect(historico[ultimoDoFiel.id].anteriores).toBe(fiel.length - 1)
  })

  test("avançar em lote: cada um vai para a própria próxima etapa; o que não pode é pulado", async () => {
    const api = servidor()
    const abertos = await api.pedidos.listar({ status: ["recebido", "em-preparo"] })
    const novo = abertos.find((pedido) => pedido.status === "recebido" && !pedido.esperaAceite)
    const emPreparo = abertos.find((pedido) => pedido.status === "em-preparo")
    if (!novo || !emPreparo) throw new Error("A demonstração devia ter novo e em preparo")
    await api.salvarLoja({ ...(await api.loja()), aceiteManual: true })
    const esperando = await api.pedidos.simular()

    const resultado = await api.pedidos.avancarEmLote([
      { id: novo.id, de: "recebido" },
      { id: emPreparo.id, de: "em-preparo" },
      { id: esperando.id, de: "recebido" },
      // A tela via uma etapa que já mudou: pula.
      { id: novo.id, de: "pronto" },
    ])
    expect(resultado.avancados.map((pedido) => [pedido.id, pedido.status])).toEqual([
      [novo.id, "em-preparo"],
      [emPreparo.id, "pronto"],
    ])
    expect(resultado.pulados).toBe(2)
  })

  test("um pedido simulado chega como novo, com o número seguinte", async () => {
    const api = servidor()
    const [ultimo] = await api.pedidos.listar()

    const novo = await api.pedidos.simular()
    expect(novo.id).toBe(ultimo.id + 1)
    expect(novo.status).toBe("recebido")
    expect((await api.pedidos.listar())[0].id).toBe(novo.id)
  })

  describe("voltar uma etapa", () => {
    test("desfaz o avanço e entra na linha do tempo; só a partir da etapa que a tela viu", async () => {
      const api = servidor()
      const [novo] = (await api.pedidos.listar({ status: ["recebido"] })).filter(
        (pedido) => !pedido.esperaAceite,
      )
      await api.pedidos.avancar(novo.id, "recebido")

      const voltou = await api.pedidos.voltar(novo.id, "em-preparo")
      expect(voltou.status).toBe("recebido")
      expect(voltou.historico?.at(-1)).toEqual({
        tipo: "etapa",
        status: "recebido",
        em: AGORA.toISOString(),
      })
      await expect(api.pedidos.voltar(novo.id, "em-preparo")).rejects.toThrow(
        "Este pedido já mudou de etapa. Atualize a tela.",
      )
      await expect(api.pedidos.voltar(novo.id, "recebido")).rejects.toThrow(
        "Este pedido não tem etapa anterior.",
      )
    })

    test("voltar de concluído desfaz a cobrança feita na entrega", async () => {
      const api = servidor()
      const naRua = (await api.pedidos.listar({ status: ["saiu-para-entrega"] })).find(
        (pedido) => pedido.situacaoPagamento === "na-entrega",
      )
      if (!naRua) throw new Error("A demonstração devia ter uma entrega na rua a cobrar")
      expect((await api.pedidos.avancar(naRua.id, "saiu-para-entrega")).situacaoPagamento).toBe(
        "pago",
      )

      const reaberto = await api.pedidos.voltar(naRua.id, "concluido")
      expect(reaberto.status).toBe("saiu-para-entrega")
      expect(reaberto.situacaoPagamento).toBe("na-entrega")
      expect(reaberto.pagoEm).toBeUndefined()
    })

    test("reabrir um concluído o devolve para Prontos, desfazendo a cobrança da entrega", async () => {
      const api = servidor()
      const naRua = (await api.pedidos.listar({ status: ["saiu-para-entrega"] })).find(
        (pedido) => pedido.situacaoPagamento === "na-entrega",
      )
      if (!naRua) throw new Error("A demonstração devia ter uma entrega na rua a cobrar")
      await api.pedidos.avancar(naRua.id, "saiu-para-entrega")

      const reaberto = await api.pedidos.reabrir(naRua.id)
      expect(reaberto.status).toBe("pronto")
      expect(reaberto.situacaoPagamento).toBe("na-entrega")
      await expect(api.pedidos.reabrir(naRua.id)).rejects.toThrow("Só reabre pedido concluído.")
    })

    test("a conta fechada da mesa não reabre pela fila", async () => {
      const api = servidor()
      const mesa = await api.mesas.criar({ numero: 9 })
      const comanda = await api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: false,
        itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
      })
      await api.mesas.fecharConta(comanda.id, "pix")
      await expect(api.pedidos.reabrir(comanda.id)).rejects.toThrow(
        "A conta da mesa reabre em Mesas.",
      )
    })
  })

  describe("prazo prometido", () => {
    test("o acréscimo da hora fica guardado; só +10, +15, +30 ou nenhum", async () => {
      const api = servidor()
      expect((await api.definirAcrescimo(15)).acrescimoPrazoMin).toBe(15)
      expect((await servidor().loja()).acrescimoPrazoMin).toBe(15)
      expect((await api.definirAcrescimo(0)).acrescimoPrazoMin).toBe(0)
      await expect(api.definirAcrescimo(7)).rejects.toThrow("Escolha +10, +15 ou +30 min.")
    })

    test("o pedido que chega grava o prazo do canal com o acréscimo", async () => {
      const api = servidor()
      const antes = await api.pedidos.simular()
      await api.definirAcrescimo(15)
      const depois = await api.pedidos.simular()
      // Lanchonete de teste: entrega em 40 min, retirada em 20.
      const esperado = { entrega: 40, retirada: 20 } as Record<string, number>
      expect(antes.prazoMin).toBe(esperado[antes.tipo])
      expect(depois.prazoMin).toBe(esperado[depois.tipo] + 15)
    })
  })

  describe("pausa de pedidos", () => {
    test("pausa por 15, 30 ou 60 min, da loja toda ou só da entrega; retomar tira", async () => {
      const api = servidor()
      const loja = await api.pausar(15, "loja")
      expect(loja.pausa).toEqual({ ate: new Date(2026, 10, 13, 20, 45).toISOString(), so: "loja" })
      expect((await servidor().loja()).pausa?.so).toBe("loja")
      expect((await api.pausar(60, "entrega")).pausa?.so).toBe("entrega")
      expect((await api.retomar()).pausa).toBeUndefined()
      await expect(api.pausar(20, "loja")).rejects.toThrow("Pause por 15, 30 ou 60 min.")
    })

    test("com a loja pausada, nenhum pedido chega; passou a hora, volta sozinha", async () => {
      const api = servidor()
      await api.pausar(15, "loja")
      await expect(api.pedidos.simular()).rejects.toThrow("A loja está pausada até 20:45.")
      vi.setSystemTime(new Date(2026, 10, 13, 20, 46))
      expect((await api.pedidos.simular()).status).toBeDefined()
    })

    test("com só a entrega pausada, não chega pedido de entrega", async () => {
      const api = servidor()
      await api.pausar(30, "entrega")
      const chegaram: string[] = []
      for (let vez = 0; vez < 12; vez += 1) {
        try {
          chegaram.push((await api.pedidos.simular()).tipo)
        } catch (erro) {
          expect((erro as Error).message).toBe("A entrega está pausada até 21:00.")
        }
      }
      expect(chegaram).not.toContain("entrega")
    })
  })

  describe("aceite manual", () => {
    test("com o aceite manual ligado, o pedido do site chega esperando aceite", async () => {
      const api = servidor()
      await api.salvarLoja({ ...(await api.loja()), aceiteManual: true })

      const novo = await api.pedidos.simular()
      expect(novo.esperaAceite).toBe(true)
    })

    test("com o aceite manual desligado, chega já aceito", async () => {
      const api = servidor()
      await api.salvarLoja({ ...(await api.loja()), aceiteManual: false })

      const novo = await api.pedidos.simular()
      expect(novo.esperaAceite).toBeFalsy()
    })

    test("enquanto espera aceite não avança; aceitar libera e entra na linha do tempo", async () => {
      const api = servidor()
      await api.salvarLoja({ ...(await api.loja()), aceiteManual: true })
      const novo = await api.pedidos.simular()

      await expect(api.pedidos.avancar(novo.id, "recebido")).rejects.toThrow(
        "Aceite o pedido antes de começar.",
      )
      const aceito = await api.pedidos.aceitar(novo.id)
      expect(aceito.esperaAceite).toBe(false)
      expect(aceito.status).toBe("recebido")
      expect(aceito.historico).toEqual([{ tipo: "aceito", em: AGORA.toISOString() }])
      expect((await api.pedidos.avancar(novo.id, "recebido")).status).toBe("em-preparo")
      await expect(api.pedidos.aceitar(novo.id)).rejects.toThrow("Este pedido não espera aceite.")
    })

    test("recusar cancela com o motivo, como recusa, e só vale para quem espera aceite", async () => {
      const api = servidor()
      await api.salvarLoja({ ...(await api.loja()), aceiteManual: true })
      const novo = await api.pedidos.simular()

      const recusado = await api.pedidos.recusar(novo.id, { motivo: "fora-da-area" })
      expect(recusado.status).toBe("cancelado")
      expect(recusado.esperaAceite).toBe(false)
      expect(recusado.cancelamento).toEqual({
        tipo: "recusa",
        motivo: "fora-da-area",
        em: AGORA.toISOString(),
      })
      await expect(api.pedidos.recusar(novo.id, { motivo: "fora-da-area" })).rejects.toThrow(
        "Este pedido não espera aceite.",
      )
    })
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
      await api.pedidos.cancelar(cancelado.id, cancelado.status, { motivo: "cliente-pediu" })
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
        { ...modelo, id: "corte", nome: "Corte", preco: 50, duracaoMin: 60, grupos: [] },
        { ...modelo, id: "escova", nome: "Escova", preco: 40, duracaoMin: 30, grupos: [] },
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
    await api.pedidos.cancelar(novo.id, "recebido", { motivo: "cliente-pediu" })

    await api.restaurar()
    expect((await api.pedidos.buscar(novo.id))?.status).toBe("recebido")
  })
})
