import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido, StatusPedido, TipoPedido } from "../dados/tipos"
import {
  colunasDaCozinha,
  cozinhaJaPreparou,
  depoisDeTirar,
  type FiltroCozinha,
  itensDaCozinha,
  minutosNaCozinha,
  rodadasNaCozinha,
  rodadasNovas,
  rotuloDaMesa,
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

  test("com a rodada 2 recém-chegada, a rodada 1 já foi preparada e a 2 ainda não", () => {
    const pizza = item("Pizza", 1, true)
    const esfiha = item("Esfiha", 2, true)
    const agua = item("Água", 1, false)
    const comanda = pedido(1, "recebido", 5, "mesa", [pizza, agua, esfiha])
    expect(cozinhaJaPreparou(comanda, pizza)).toBe(true)
    expect(cozinhaJaPreparou(comanda, esfiha)).toBe(false)
    expect(cozinhaJaPreparou(comanda, agua)).toBe(false)
  })

  test("o item transferido de outra mesa vale como chegou: preparado ou não, qualquer que seja o status", () => {
    const preparada = { ...item("Pizza", 3, true), transferido: { daMesa: 4, preparado: true } }
    const coca = { ...item("Coca", 3, false), transferido: { daMesa: 4, preparado: false } }
    for (const status of ["recebido", "em-preparo", "pronto"] as const) {
      const comanda = pedido(1, status, 5, "mesa", [item("Esfiha", 1, true), preparada, coca])
      expect(cozinhaJaPreparou(comanda, preparada)).toBe(true)
      expect(cozinhaJaPreparou(comanda, coca)).toBe(false)
    }
  })
})

describe("rotuloDaMesa", () => {
  test("a mesa sozinha, e a principal com as juntadas pelo número", () => {
    expect(rotuloDaMesa({ mesa: { id: "mesa-3", numero: 3 } })).toBe("Mesa 3")
    expect(
      rotuloDaMesa({
        mesa: { id: "mesa-15", numero: 15, juntadas: [{ id: "mesa-16", numero: 16 }] },
      }),
    ).toBe("Mesa 15 + 16")
    expect(
      rotuloDaMesa({
        mesa: {
          id: "mesa-3",
          numero: 3,
          juntadas: [
            { id: "mesa-4", numero: 4 },
            { id: "mesa-5", numero: 5 },
          ],
        },
      }),
    ).toBe("Mesa 3 + 4 + 5")
  })
})

describe("depoisDeTirar", () => {
  const pizza = item("Pizza", 1, true)
  const esfiha = item("Esfiha", 2, true)
  const agua = item("Água", 3, false)

  test("tirou a rodada que estava na cozinha: a comanda volta a pronta", () => {
    const antes = pedido(1, "recebido", 5, "mesa", [pizza, esfiha])
    const depois = depoisDeTirar(antes, { ...antes, itens: [pizza] })
    expect(depois.status).toBe("pronto")
    expect(cozinhaJaPreparou(depois, pizza)).toBe(true)
    const emPreparo = pedido(1, "em-preparo", 5, "mesa", [pizza, esfiha, agua])
    expect(depoisDeTirar(emPreparo, { ...emPreparo, itens: [agua] }).status).toBe("pronto")
  })

  test("a rodada da cozinha continua com algum item, ou saiu uma anterior: nada muda", () => {
    const outra = { ...esfiha, id: "Esfiha 2" }
    const antes = pedido(1, "recebido", 5, "mesa", [pizza, esfiha, outra])
    const depois = { ...antes, itens: [pizza, outra] }
    expect(depoisDeTirar(antes, depois)).toEqual(depois)
    const tirouAnterior = { ...antes, itens: [esfiha, outra] }
    expect(depoisDeTirar(antes, tirouAnterior)).toEqual(tirouAnterior)
  })

  test("sem nada pronto para servir, o servir sai; com a rodada anterior ainda na mesa, fica", () => {
    const servirDesde = minutosAtras(3)
    const pronta = { ...pedido(1, "pronto", 5, "mesa", [pizza, agua]), servirDesde }
    expect(depoisDeTirar(pronta, { ...pronta, itens: [agua] })).not.toHaveProperty("servirDesde")
    const comRodada2 = { ...pedido(1, "recebido", 5, "mesa", [pizza, esfiha]), servirDesde }
    expect(depoisDeTirar(comRodada2, { ...comRodada2, itens: [esfiha] })).not.toHaveProperty(
      "servirDesde",
    )
    expect(depoisDeTirar(comRodada2, { ...comRodada2, itens: [pizza] }).servirDesde).toBe(
      servirDesde,
    )
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

  test("o item transferido de outra mesa não é rodada desta cozinha, nem muda a atual", () => {
    const transferida = { ...item("Calzone", 5, true), transferido: { daMesa: 4, preparado: true } }
    const comanda = pedido(4, "recebido", 10, "mesa", [
      item("Pizza", 1, true),
      item("Batata", 2, true),
      transferida,
    ])
    const { atuais, anteriores } = itensDaCozinha(comanda)
    expect(nomes(atuais)).toEqual(["Batata"])
    expect(nomes(anteriores)).toEqual(["Pizza"])
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

  test("a comanda conta os 15 min de pronta desde que a cozinha terminou, não desde a última mudança", () => {
    const comanda = {
      ...pedido(20, "pronto", 1, "mesa", [item("Pizza", 1, true)]),
      eventos: [{ tipo: "pronta" as const, em: minutosAtras(20), texto: "A cozinha terminou" }],
    }
    const prontos = (pedidos: Pedido[]) =>
      colunasDaCozinha(pedidos, "todos", AGORA)[2].pedidos.map((p) => p.id)
    expect(prontos([comanda])).toEqual([])
    expect(prontos([{ ...comanda, eventos: [] }])).toEqual([20])
  })

  test("filtros: mesas, entrega (sem retirada) e retirada", () => {
    const ids = (filtro: FiltroCozinha) =>
      colunasDaCozinha(QUADRO, filtro, AGORA).flatMap((coluna) => coluna.pedidos.map((p) => p.id))
    expect(ids("mesas")).toEqual([12, 13])
    expect(ids("entrega")).toEqual([10, 14])
    expect(ids("retirada")).toEqual([11])
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
