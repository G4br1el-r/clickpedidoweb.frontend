import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido, StatusPedido, TipoPedido } from "../dados/tipos"
import {
  colunasDaCozinha,
  cozinhaJaPreparou,
  type FiltroCozinha,
  itensDaCozinha,
  minutosNaCozinha,
  rodadasNaCozinha,
  rodadasNovas,
  urgenciaNaCozinha,
} from "./cozinha"
import { AGORA_DE_TESTE as AGORA, PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const base = PEDIDOS_DE_TESTE[2]

const minutosAtras = (minutos: number) => new Date(AGORA.getTime() - minutos * 60_000).toISOString()

function item(nome: string, rodada?: number, vaiParaCozinha?: boolean, lancadoHa?: number) {
  return {
    id: nome,
    produtoId: nome,
    nome,
    quantidade: 1,
    precoUnitario: 10,
    opcoes: [],
    total: 10,
    ...(rodada === undefined ? {} : { rodada }),
    ...(vaiParaCozinha === undefined ? {} : { vaiParaCozinha }),
    ...(lancadoHa === undefined ? {} : { lancadoEm: minutosAtras(lancadoHa) }),
  } satisfies ItemPedido
}

function pedido(
  id: number,
  status: StatusPedido,
  minutos: number,
  tipo: TipoPedido = "entrega",
  itens: ItemPedido[] = [item("Pizza")],
): Pedido {
  const criadoEm = minutosAtras(minutos)
  return { ...base, id, numero: id, status, tipo, itens, criadoEm, atualizadoEm: criadoEm }
}

const nomes = (itens: ItemPedido[]) => itens.map((item) => item.nome)

describe("cozinhaJaPreparou", () => {
  test("item que foi para a cozinha, com a comanda em preparo ou pronta", () => {
    const pizza = item("Pizza", 1, true)
    expect(cozinhaJaPreparou(pedido(1, "em-preparo", 5, "mesa", [pizza]), pizza)).toBe(true)
    expect(cozinhaJaPreparou(pedido(1, "pronto", 5, "mesa", [pizza]), pizza)).toBe(true)
  })

  test("ainda não começou, ou o item não passa pela cozinha", () => {
    const pizza = item("Pizza", 1, true)
    const agua = item("Água", 1, false)
    expect(cozinhaJaPreparou(pedido(1, "recebido", 5, "mesa", [pizza]), pizza)).toBe(false)
    expect(cozinhaJaPreparou(pedido(1, "pronto", 5, "mesa", [agua]), agua)).toBe(false)
  })
})

describe("itensDaCozinha", () => {
  test("pedido do site: tudo vai para a cozinha numa rodada só", () => {
    const { atuais, anteriores } = itensDaCozinha(
      pedido(1, "recebido", 5, "entrega", [item("Pizza"), item("Esfiha")]),
    )
    expect(nomes(atuais)).toEqual(["Pizza", "Esfiha"])
    expect(anteriores).toEqual([])
  })

  test("comanda: só a última rodada enviada; as anteriores ficam como já servidas", () => {
    const comanda = pedido(2, "recebido", 60, "mesa", [
      item("Pizza", 1, true),
      item("Cerveja", 1, false),
      item("Batata", 2, true),
      item("Refrigerante", 3, false),
    ])
    const { atuais, anteriores } = itensDaCozinha(comanda)
    expect(nomes(atuais)).toEqual(["Batata"])
    expect(nomes(anteriores)).toEqual(["Pizza"])
  })

  test("comanda só com bebidas não tem nada para a cozinha", () => {
    const comanda = pedido(3, "pronto", 10, "mesa", [item("Cerveja", 1, false)])
    expect(itensDaCozinha(comanda)).toEqual({ atuais: [], anteriores: [] })
  })
})

const QUADRO = [
  pedido(10, "recebido", 3),
  pedido(11, "recebido", 9, "retirada"),
  // Comanda antiga com rodada nova: conta da hora em que a rodada foi lançada.
  pedido(12, "recebido", 90, "mesa", [item("Pizza", 1, true), item("Batata", 2, true, 6)]),
  pedido(13, "em-preparo", 20, "mesa"),
  pedido(14, "pronto", 12),
  // Pronto há mais de 15 minutos: já saiu da mão da cozinha.
  pedido(15, "pronto", 40, "mesa"),
  pedido(16, "saiu-para-entrega", 30),
  pedido(17, "concluido", 60),
  pedido(18, "aguardando-pagamento", 1),
  pedido(19, "em-preparo", 30, "atendimento"),
  pedido(20, "recebido", 4, "mesa", [item("Cerveja", 1, false)]),
]

const resumo = (colunas: ReturnType<typeof colunasDaCozinha>) =>
  colunas.map((coluna) => [coluna.titulo, coluna.pedidos.map((item) => item.id)])

describe("colunasDaCozinha", () => {
  test("a fazer, preparando e prontos, do que chegou primeiro ao último", () => {
    expect(resumo(colunasDaCozinha(QUADRO, "todos", AGORA))).toEqual([
      ["A fazer", [11, 12, 10]],
      ["Preparando", [13]],
      ["Prontos", [14]],
    ])
  })

  test("pedido que ainda espera o aceite da loja não chega na cozinha", () => {
    const esperando: Pedido = { ...QUADRO[0], id: 99, esperaAceite: true }
    const ids = colunasDaCozinha([...QUADRO, esperando], "todos", AGORA)[0].pedidos.map((p) => p.id)
    expect(ids).toEqual([11, 12, 10])
  })

  test("filtros: mesas, entrega (sem retirada) e retirada", () => {
    const ids = (filtro: FiltroCozinha) =>
      colunasDaCozinha(QUADRO, filtro, AGORA).flatMap((coluna) => coluna.pedidos.map((p) => p.id))
    expect(ids("mesas")).toEqual([12, 13])
    expect(ids("entrega")).toEqual([10, 14])
    expect(ids("retirada")).toEqual([11])
  })
})

describe("rodadasNovas: aceite", () => {
  test("a cozinha só toca quando a loja aceita o pedido", () => {
    const esperando: Pedido = { ...QUADRO[0], id: 99, esperaAceite: true }
    const conhecidas = rodadasNaCozinha(QUADRO)
    expect(rodadasNovas(conhecidas, [...QUADRO, esperando])).toEqual([])

    const aceito: Pedido = { ...esperando, esperaAceite: false }
    expect(
      rodadasNovas(rodadasNaCozinha([...QUADRO, esperando]), [...QUADRO, aceito]),
    ).toHaveLength(1)
  })
})

describe("rodadasNovas", () => {
  test("pedido novo e rodada nova de uma comanda que já estava na tela tocam o alerta", () => {
    const antes = rodadasNaCozinha([
      QUADRO[0],
      pedido(12, "pronto", 90, "mesa", [item("Pizza", 1, true)]),
    ])
    // A comanda 20 só tem bebida: não chega nada na cozinha, nada toca.
    const depois = [QUADRO[0], QUADRO[1], QUADRO[2], QUADRO[3], QUADRO[10]]
    expect(rodadasNovas(antes, depois)).toEqual(["11:1", "12:2"])
  })
})

describe("urgenciaNaCozinha", () => {
  test("âmbar a partir de 15 minutos e vermelho a partir de 25, contando da rodada", () => {
    expect(urgenciaNaCozinha(pedido(1, "recebido", 14), AGORA)).toBe("normal")
    expect(urgenciaNaCozinha(pedido(1, "recebido", 15), AGORA)).toBe("atencao")
    expect(urgenciaNaCozinha(pedido(1, "em-preparo", 25), AGORA)).toBe("atrasado")
    expect(urgenciaNaCozinha(QUADRO[2], AGORA)).toBe("normal")
  })

  test("tempo em minutos desde a chegada à cozinha", () => {
    expect(minutosNaCozinha(QUADRO[2], AGORA)).toBe(6)
    expect(minutosNaCozinha(pedido(1, "recebido", 9), AGORA)).toBe(9)
  })
})
