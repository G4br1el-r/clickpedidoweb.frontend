import "fake-indexeddb/auto"
import { clear, get, set } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor } from "./servidor"
import type { CatalogoLoja, ControleEstoque, Produto } from "./tipos"

/** Sexta, 13/11/2026, 20:30 em São Paulo. */
const AGORA = new Date(2026, 10, 13, 20, 30)
const CHAVE = "clickpedido-admin-dados:lanchonete"

const controle = (quantidade: number): ControleEstoque => ({
  controlar: true,
  quantidade,
  minimo: 2,
  esgotarAoZerar: true,
})

/**
 * Lanchonete de teste com garçons (Rafa e Bia ativos, Lucas inativo) e estoque: Refri lata
 * (5 un) e Bacon (10 un), ligado à opção "Bacon" do X-Burger.
 */
function catalogo(mudar?: (catalogo: CatalogoLoja) => void) {
  const base = catalogoDeTeste()
  base.salao.garcons = [
    { id: "garcom-rafa", nome: "Rafa", ativo: true },
    { id: "garcom-bia", nome: "Bia", ativo: true },
    { id: "garcom-lucas", nome: "Lucas", ativo: false },
  ]
  const [lanche] = base.produtos
  const refri: Produto = {
    ...lanche,
    id: "refri",
    nome: "Refri lata",
    preco: 6,
    grupos: [],
    custo: 3,
    estoque: controle(5),
  }
  const bacon: Produto = { ...refri, id: "bacon", nome: "Bacon", preco: 3, estoque: controle(10) }
  lanche.grupos[0].itens[0].produtoId = "bacon"
  base.produtos.push(refri, bacon)
  mudar?.(base)
  return base
}

function servidor(mudar?: (catalogo: CatalogoLoja) => void) {
  return criarServidor({
    segmento: "lanchonete",
    carregarCatalogo: async () => catalogo(mudar),
    espera: 0,
  })
}

/** Mesa nova, livre: as mesas 1 e 2 do catálogo podem ter comanda gerada pela demonstração. */
const mesaLivre = async (api: ReturnType<typeof servidor>, numero = 30) =>
  (await api.mesas.criar({ numero })).id

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA)
  await clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("abrir mesa", () => {
  test("abre a mesa 1 para 3 pessoas com Rafa: comanda vazia, mesa ocupada e o evento de abertura", async () => {
    const api = servidor()
    const mesaId = await mesaLivre(api)
    const comanda = await api.mesas.abrir(mesaId, {
      pessoas: 3,
      garcom: "Rafa",
      clienteNome: " Ana ",
    })

    expect(comanda).toMatchObject({
      tipo: "mesa",
      itens: [],
      total: 0,
      cliente: { nome: "Ana" },
      mesa: { id: mesaId, numero: 30, garcom: "Rafa", pessoas: 3 },
      eventos: [
        {
          tipo: "aberta",
          em: AGORA.toISOString(),
          por: "Rafa",
          texto: "Mesa aberta para 3 pessoas",
        },
      ],
    })
    const mesa = (await api.mesas.listar()).find((item) => item.id === mesaId)
    expect(mesa).toMatchObject({ status: "ocupada", pedidoAtivoId: comanda.id })
  })

  test.each([0, 100, 2.5, Number.NaN])("%s pessoas: recusa", async (pessoas) => {
    const api = servidor()
    const mesaId = await mesaLivre(api)
    await expect(api.mesas.abrir(mesaId, { pessoas, garcom: "Rafa" })).rejects.toThrow(
      "Informe de 1 a 99 pessoas.",
    )
  })

  test("o garçom é obrigatório e tem que ser um dos ativos do salão", async () => {
    const api = servidor()
    const mesaId = await mesaLivre(api)
    await expect(api.mesas.abrir(mesaId, { pessoas: 2 })).rejects.toThrow("Escolha o garçom.")
    for (const garcom of ["Lucas", "Zé", "  "]) {
      await expect(api.mesas.abrir(mesaId, { pessoas: 2, garcom })).rejects.toThrow(
        garcom.trim() ? "Esse garçom não está na lista do salão." : "Escolha o garçom.",
      )
    }
  })

  test("sem nenhum garçom ativo no salão, abre sem garçom", async () => {
    const api = servidor((catalogo) => {
      catalogo.salao.garcons = [{ id: "garcom-lucas", nome: "Lucas", ativo: false }]
    })
    const mesaId = await mesaLivre(api)
    const comanda = await api.mesas.abrir(mesaId, { pessoas: 2 })
    expect(comanda.mesa).toEqual({ id: mesaId, numero: 30, pessoas: 2 })
    expect(comanda.eventos?.[0]).not.toHaveProperty("por")
  })

  test("mesa bloqueada, já aberta ou inexistente recusa", async () => {
    const api = servidor()
    const bloqueada = await mesaLivre(api, 31)
    await api.mesas.bloquear(bloqueada, "Pé quebrado")
    await expect(api.mesas.abrir(bloqueada, { pessoas: 2, garcom: "Rafa" })).rejects.toThrow(
      "A mesa 31 está bloqueada.",
    )
    const mesaId = await mesaLivre(api)
    await api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Rafa" })
    await expect(api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Bia" })).rejects.toThrow(
      "A mesa 30 já está aberta.",
    )
    await expect(api.mesas.abrir("mesa-99", { pessoas: 2, garcom: "Rafa" })).rejects.toThrow(
      "Mesa não encontrada",
    )
  })

  test("5 pessoas numa mesa de 4 lugares abre; a mesa em limpeza abre e sai da limpeza", async () => {
    const api = servidor((catalogo) => {
      catalogo.salao.limpeza = true
    })
    const mesaId = await mesaLivre(api)
    const anterior = await api.mesas.lancar({
      mesaId,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    await api.mesas.fecharConta(anterior.id, "pix")
    expect(
      (await api.mesas.listar()).find((item) => item.id === mesaId)?.limpezaDesde,
    ).toBeDefined()

    const comanda = await api.mesas.abrir(mesaId, { pessoas: 5, garcom: "Bia" })
    expect(comanda.mesa?.pessoas).toBe(5)
    const mesa = (await api.mesas.listar()).find((item) => item.id === mesaId)
    expect(mesa?.status).toBe("ocupada")
    expect(mesa).not.toHaveProperty("limpezaDesde")
  })

  test("mesa reservada às 20:45 (agora 20:30, antecedência 30) só abre com confirmarReserva", async () => {
    const mesaId = await mesaLivre(servidor())
    // A Fase 7 ainda não tem a operação de reservar: a reserva entra direto na base guardada.
    const guardado = await get(CHAVE)
    guardado.base.reservas = [
      {
        id: "reserva-1",
        nome: "Carla",
        inicio: new Date(2026, 10, 13, 20, 45).toISOString(),
        pessoas: 2,
        mesaId,
        status: "marcada",
      },
    ]
    await set(CHAVE, guardado)
    const api = servidor()

    await expect(api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Rafa" })).rejects.toThrow(
      "A mesa 30 está reservada às 20:45. Confirme para abrir.",
    )
    const comanda = await api.mesas.abrir(mesaId, {
      pessoas: 2,
      garcom: "Rafa",
      confirmarReserva: true,
    })
    expect(comanda.mesa?.id).toBe(mesaId)
  })
})

describe("lançar na comanda", () => {
  test("cada rodada entra no histórico, com o destino, os itens e quem lançou", async () => {
    const api = servidor()
    const mesaId = await mesaLivre(api)
    await api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Rafa" })
    await api.mesas.lancar({
      mesaId,
      enviarParaCozinha: true,
      por: "Bia",
      itens: [{ produtoId: "refri", escolhas: {}, quantidade: 2 }],
    })
    const comanda = await api.mesas.lancar({
      mesaId,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    expect(comanda.eventos?.slice(1)).toEqual([
      {
        tipo: "rodada",
        em: AGORA.toISOString(),
        por: "Bia",
        texto: "Rodada 1 para a cozinha: 2× Refri lata",
      },
      { tipo: "rodada", em: AGORA.toISOString(), texto: "Rodada 2 lançada na mesa: 1× Água" },
    ])
  })

  test("lançar depois de pedir a conta limpa o pedido de conta", async () => {
    const api = servidor()
    const mesaId = await mesaLivre(api)
    const aberta = await api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Rafa" })
    await api.mesas.lancar({
      mesaId,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    expect((await api.mesas.pedirConta(aberta.id)).contaPedidaEm).toBe(AGORA.toISOString())

    const comanda = await api.mesas.lancar({
      mesaId,
      enviarParaCozinha: true,
      itens: [{ produtoId: "refri", escolhas: {}, quantidade: 1 }],
    })
    expect(comanda).not.toHaveProperty("contaPedidaEm")
  })
})

const saldo = async (api: ReturnType<typeof servidor>, id: string) =>
  (await api.produtos.listar()).find((produto) => produto.id === id)?.estoque?.quantidade

/** Mesa 30 aberta com 2 Refri lata. Com `preparado`, foi para a cozinha e já está em preparo. */
async function comRefri(api: ReturnType<typeof servidor>, preparado: boolean) {
  const mesaId = await mesaLivre(api)
  await api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Rafa" })
  const comanda = await api.mesas.lancar({
    mesaId,
    enviarParaCozinha: preparado,
    itens: [{ produtoId: "refri", escolhas: {}, quantidade: 2 }],
  })
  if (preparado) await api.pedidos.avancar(comanda.id, "recebido")
  return { mesaId, comanda, item: comanda.itens[0] }
}

describe("tirar e diminuir", () => {
  test("o item que a cozinha não preparou sai sem motivo e devolve o estoque", async () => {
    const api = servidor()
    const { comanda, item } = await comRefri(api, false)
    expect(await saldo(api, "refri")).toBe(3)

    const depois = await api.mesas.removerItem(comanda.id, item.id, { por: "Bia" })
    expect(depois.itens).toEqual([])
    expect(await saldo(api, "refri")).toBe(5)
    expect(depois.eventos?.at(-1)).toEqual({
      tipo: "item-removido",
      em: AGORA.toISOString(),
      por: "Bia",
      texto: "Tirou 2× Refri lata",
    })
  })

  test("o item preparado só sai com motivo; o estoque não volta: a venda é desfeita e o mesmo tanto vira perda", async () => {
    const api = servidor()
    const { comanda, item } = await comRefri(api, true)
    await expect(api.mesas.removerItem(comanda.id, item.id)).rejects.toThrow(
      "Diga o motivo para tirar o que a cozinha já preparou.",
    )
    await expect(api.mesas.removerItem(comanda.id, item.id, { motivo: "  " })).rejects.toThrow(
      "Diga o motivo para tirar o que a cozinha já preparou.",
    )

    const depois = await api.mesas.removerItem(comanda.id, item.id, { motivo: " Caiu no chão " })
    expect(depois.itens).toEqual([])
    expect(await saldo(api, "refri")).toBe(3)
    const [perda, devolucao] = await api.estoque.movimentos("refri")
    expect([devolucao, perda]).toMatchObject([
      { tipo: "devolucao", quantidade: 2, saldo: 5, pedidoId: comanda.id },
      { tipo: "perda", quantidade: -2, saldo: 3, pedidoId: comanda.id, motivo: "Caiu no chão" },
    ])
    expect(depois.eventos?.at(-1)).toEqual({
      tipo: "item-removido",
      em: AGORA.toISOString(),
      texto: "Tirou 2× Refri lata",
      motivo: "Caiu no chão",
    })
  })

  test("diminuir o preparado pede motivo e perde a diferença; aumentar o preparado recusa", async () => {
    const api = servidor()
    const { comanda, item } = await comRefri(api, true)
    await expect(api.mesas.alterarQuantidade(comanda.id, item.id, 1)).rejects.toThrow(
      "Diga o motivo para tirar o que a cozinha já preparou.",
    )
    await expect(api.mesas.alterarQuantidade(comanda.id, item.id, 3)).rejects.toThrow(
      "A cozinha já preparou Refri lata. Lance de novo para pedir mais.",
    )

    const depois = await api.mesas.alterarQuantidade(comanda.id, item.id, 1, {
      motivo: "Derramou",
      por: "Rafa",
    })
    expect(depois.itens[0]).toMatchObject({ quantidade: 1, total: 6 })
    expect(await saldo(api, "refri")).toBe(3)
    const [perda] = await api.estoque.movimentos("refri")
    expect(perda).toMatchObject({ tipo: "perda", quantidade: -1, saldo: 3, motivo: "Derramou" })
    expect(depois.eventos?.at(-1)).toEqual({
      tipo: "item-removido",
      em: AGORA.toISOString(),
      por: "Rafa",
      texto: "Tirou 1× Refri lata",
      motivo: "Derramou",
    })
  })

  test("diminuir o que não foi preparado devolve e não pede motivo", async () => {
    const api = servidor()
    const { comanda, item } = await comRefri(api, false)
    const depois = await api.mesas.alterarQuantidade(comanda.id, item.id, 1)
    expect(await saldo(api, "refri")).toBe(4)
    expect(depois.eventos?.at(-1)).toMatchObject({
      tipo: "item-removido",
      texto: "Tirou 1× Refri lata",
    })
  })
})

describe("editar item", () => {
  /** X-Burger com Adicional: Bacon (+R$ 3, ligado ao estoque do Bacon) ou Ovo (+R$ 2). */
  const comOvo = (catalogo: CatalogoLoja) => {
    catalogo.produtos[0].grupos[0].itens.push({
      id: "opc-ovo",
      nome: "Ovo",
      precoAdicional: 2,
      ordem: 2,
      ativo: true,
    })
  }

  async function comXBurger(api: ReturnType<typeof servidor>, enviarParaCozinha: boolean) {
    const mesaId = await mesaLivre(api)
    await api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Rafa" })
    const comanda = await api.mesas.lancar({
      mesaId,
      enviarParaCozinha,
      itens: [
        {
          produtoId: "prod-x-burger",
          escolhas: { "grp-x-burger-1": ["opc-x-burger-1-1"] },
          quantidade: 1,
        },
      ],
    })
    return { comanda, item: comanda.itens[0] }
  }

  test("troca a observação e as opções, refaz o preço e o estoque, e grava o evento", async () => {
    const api = servidor(comOvo)
    const { comanda, item } = await comXBurger(api, true)
    expect(item).toMatchObject({ total: 23, escolhas: { "grp-x-burger-1": ["opc-x-burger-1-1"] } })
    expect(await saldo(api, "bacon")).toBe(9)

    const depois = await api.mesas.editarItem(comanda.id, item.id, {
      observacao: " Sem cebola ",
      escolhas: { "grp-x-burger-1": ["opc-ovo"] },
      por: "Bia",
    })
    expect(depois.itens[0]).toMatchObject({
      id: item.id,
      precoUnitario: 22,
      total: 22,
      opcoes: ["Adicional: Ovo"],
      observacao: "Sem cebola",
      escolhas: { "grp-x-burger-1": ["opc-ovo"] },
    })
    expect(depois.total).toBe(22)
    expect(await saldo(api, "bacon")).toBe(10)
    expect(depois.eventos?.at(-1)).toEqual({
      tipo: "item-editado",
      em: AGORA.toISOString(),
      por: "Bia",
      texto: "X-Burger: Adicional: Ovo · Sem cebola",
    })
  })

  test("o item que a cozinha já preparou não muda", async () => {
    const api = servidor(comOvo)
    const { comanda, item } = await comXBurger(api, true)
    await api.pedidos.avancar(comanda.id, "recebido")
    await expect(
      api.mesas.editarItem(comanda.id, item.id, { observacao: "Sem cebola" }),
    ).rejects.toThrow("A cozinha já preparou X-Burger. Tire com motivo e lance de novo.")
  })

  test("sem escolhas novas, só a observação muda; observação vazia sai", async () => {
    const api = servidor(comOvo)
    const { comanda, item } = await comXBurger(api, false)
    const comObservacao = await api.mesas.editarItem(comanda.id, item.id, {
      observacao: "Bem passado",
    })
    expect(comObservacao.itens[0]).toMatchObject({ observacao: "Bem passado", total: 23 })
    const sem = await api.mesas.editarItem(comanda.id, item.id, { observacao: "  " })
    expect(sem.itens[0]).not.toHaveProperty("observacao")
    expect(sem.itens[0].opcoes).toEqual(["Adicional: Bacon"])
  })
})

describe("cancelar comanda", () => {
  test("exige motivo; o não preparado volta, o preparado vira perda e a mesa fica livre sem limpeza", async () => {
    const api = servidor((catalogo) => {
      catalogo.salao.limpeza = true
    })
    const { mesaId, comanda } = await comRefri(api, true)
    // Rodada 2, só lançada: 1 Refri que não passou pela cozinha.
    await api.mesas.lancar({
      mesaId,
      enviarParaCozinha: false,
      itens: [{ produtoId: "refri", escolhas: {}, quantidade: 1 }],
    })
    expect(await saldo(api, "refri")).toBe(2)
    await expect(api.mesas.cancelarComanda(comanda.id, { motivo: " " })).rejects.toThrow(
      "Diga o motivo do cancelamento.",
    )

    const cancelada = await api.mesas.cancelarComanda(comanda.id, {
      motivo: " Cliente foi embora ",
      por: "Rafa",
    })
    expect(cancelada).toMatchObject({
      status: "cancelado",
      situacaoPagamento: "cancelado",
      motivoCancelamento: "outro",
      detalheCancelamento: "Cliente foi embora",
    })
    expect(cancelada.eventos?.at(-1)).toEqual({
      tipo: "cancelada",
      em: AGORA.toISOString(),
      por: "Rafa",
      texto: "Comanda cancelada",
      motivo: "Cliente foi embora",
    })
    // Voltou só o Refri da rodada 2; os 2 preparados saíram como perda.
    expect(await saldo(api, "refri")).toBe(3)
    const [perda] = await api.estoque.movimentos("refri")
    expect(perda).toMatchObject({ tipo: "perda", quantidade: -2, motivo: "Cliente foi embora" })
    const mesa = (await api.mesas.listar()).find((item) => item.id === mesaId)
    expect(mesa?.status).toBe("livre")
    expect(mesa).not.toHaveProperty("limpezaDesde")
  })

  test("a comanda vazia não se cancela: libera-se a mesa", async () => {
    const api = servidor()
    const mesaId = await mesaLivre(api)
    const comanda = await api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Rafa" })
    await expect(api.mesas.cancelarComanda(comanda.id, { motivo: "Engano" })).rejects.toThrow(
      "A comanda está vazia. Libere a mesa.",
    )
  })
})

describe("servir e pedir a conta", () => {
  test("a cozinha marca pronta a comanda da mesa: servirDesde vira a hora, e o evento diz a rodada", async () => {
    const api = servidor()
    const { comanda } = await comRefri(api, true)
    const pronta = await api.pedidos.avancar(comanda.id, "em-preparo")
    expect(pronta.servirDesde).toBe(AGORA.toISOString())
    expect(pronta.eventos?.at(-1)).toEqual({
      tipo: "pronta",
      em: AGORA.toISOString(),
      texto: "A cozinha terminou a rodada 1",
    })
  })

  test("pronta de novo, com servirDesde já preenchido, fica o mais antigo", async () => {
    const api = servidor()
    const { mesaId, comanda } = await comRefri(api, true)
    await api.pedidos.avancar(comanda.id, "em-preparo")
    vi.setSystemTime(new Date(2026, 10, 13, 20, 40))
    await api.mesas.lancar({
      mesaId,
      enviarParaCozinha: true,
      itens: [{ produtoId: "refri", escolhas: {}, quantidade: 1 }],
    })
    await api.pedidos.avancar(comanda.id, "recebido")
    const pronta = await api.pedidos.avancar(comanda.id, "em-preparo")
    expect(pronta.servirDesde).toBe(AGORA.toISOString())
    expect(pronta.eventos?.at(-1)?.texto).toBe("A cozinha terminou a rodada 2")
  })

  test("o pedido de entrega pronto não ganha servirDesde", async () => {
    const api = servidor()
    const emPreparo = await api.pedidos.listar({ status: ["em-preparo"] })
    const alvo = emPreparo.find((pedido) => pedido.tipo !== "mesa")
    if (!alvo) throw new Error("A demonstração devia ter um pedido em preparo fora da mesa")
    const pronto = await api.pedidos.avancar(alvo.id, "em-preparo")
    expect(pronto).not.toHaveProperty("servirDesde")
    expect(pronto).not.toHaveProperty("eventos")
  })

  test("marcar servido limpa servirDesde e grava o evento; sem nada a servir, recusa", async () => {
    const api = servidor()
    const { comanda } = await comRefri(api, true)
    await expect(api.mesas.marcarServido(comanda.id)).rejects.toThrow("Não há nada para servir.")
    await api.pedidos.avancar(comanda.id, "em-preparo")

    const servida = await api.mesas.marcarServido(comanda.id, "Bia")
    expect(servida).not.toHaveProperty("servirDesde")
    expect(servida.eventos?.at(-1)).toEqual({
      tipo: "servida",
      em: AGORA.toISOString(),
      por: "Bia",
      texto: "Rodada servida",
    })
  })

  test("pedir a conta grava a hora e o evento; pedir de novo mantém a primeira", async () => {
    const api = servidor()
    const { comanda } = await comRefri(api, false)
    const pedida = await api.mesas.pedirConta(comanda.id, "Rafa")
    expect(pedida.contaPedidaEm).toBe(AGORA.toISOString())
    expect(pedida.eventos?.at(-1)).toEqual({
      tipo: "conta-pedida",
      em: AGORA.toISOString(),
      por: "Rafa",
      texto: "Pediu a conta",
    })
    vi.setSystemTime(new Date(2026, 10, 13, 20, 45))
    const deNovo = await api.mesas.pedirConta(comanda.id)
    expect(deNovo.contaPedidaEm).toBe(AGORA.toISOString())
    expect(deNovo.eventos?.filter((evento) => evento.tipo === "conta-pedida")).toHaveLength(1)
  })

  test("servir e pedir a conta recusam a comanda que não está aberta", async () => {
    const api = servidor()
    const { comanda } = await comRefri(api, false)
    await api.mesas.fecharConta(comanda.id, "pix")
    const recusa = "Só a comanda aberta de uma mesa pode mudar."
    await expect(api.mesas.pedirConta(comanda.id)).rejects.toThrow(recusa)
    await expect(api.mesas.marcarServido(comanda.id)).rejects.toThrow(recusa)
  })
})
