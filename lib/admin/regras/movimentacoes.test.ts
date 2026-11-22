import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido, StatusPedido } from "../dados/tipos"
import { itensDaCozinha } from "./cozinha"
import {
  juntarComandas,
  numerosEmTexto,
  porQueNaoJunta,
  porQueNaoTransfere,
  separarQuantidade,
} from "./movimentacoes"

const AGORA = new Date(2026, 10, 13, 20, 30)
const minutosAtras = (minutos: number) => new Date(AGORA.getTime() - minutos * 60_000).toISOString()

function item(
  nome: string,
  { quantidade = 1, preco = 10, rodada = 1, cozinha = true } = {},
): ItemPedido {
  return {
    id: nome,
    produtoId: nome,
    nome,
    quantidade,
    precoUnitario: preco,
    opcoes: [],
    total: quantidade * preco,
    rodada,
    vaiParaCozinha: cozinha,
  }
}

function comanda(
  id: number,
  numero: number,
  status: StatusPedido,
  itens: ItemPedido[],
  mudancas: Partial<Pedido> = {},
): Pedido {
  const criadoEm = minutosAtras(60)
  return {
    id,
    numero: id,
    token: `t${id}`,
    origem: "garcom",
    tipo: "mesa",
    status,
    cliente: { nome: `Mesa ${numero}`, telefone: "1230000000" },
    mesa: { id: `mesa-${numero}`, numero, pessoas: 2 },
    itens,
    subtotal: 0,
    desconto: 0,
    taxaEntrega: 0,
    total: 0,
    pagamento: "dinheiro",
    situacaoPagamento: "na-entrega",
    criadoEm,
    atualizadoEm: criadoEm,
    historico: [{ status, em: criadoEm }],
    enviarParaCozinha: true,
    ...mudancas,
  }
}

describe("numerosEmTexto", () => {
  test("uma, duas e três mesas", () => {
    expect(numerosEmTexto([4])).toBe("4")
    expect(numerosEmTexto([4, 5])).toBe("4 e 5")
    expect(numerosEmTexto([4, 5, 6])).toBe("4, 5 e 6")
  })
})

describe("separarQuantidade", () => {
  const coca = item("Coca", { quantidade: 3, preco: 6, cozinha: false })

  test("1 de 3 Cocas: a linha fica com 2 e a parte que vai ganha o id novo", () => {
    expect(separarQuantidade(coca, 1, "Coca-t1")).toEqual({
      fica: { ...coca, quantidade: 2, total: 12 },
      vai: { ...coca, id: "Coca-t1", quantidade: 1, total: 6 },
    })
  })

  test("3 de 3: não fica nada e vai a própria linha", () => {
    expect(separarQuantidade(coca, 3, "Coca-t1")).toEqual({ fica: null, vai: coca })
  })
})

describe("porQueNaoTransfere", () => {
  const pizza = item("Calabresa", { rodada: 1 })
  const esfiha = item("Esfiha", { rodada: 2 })
  const coca = item("Coca", { rodada: 2, cozinha: false })

  test("a rodada que a cozinha ainda tem (recebida ou em preparo) não sai", () => {
    for (const status of ["recebido", "em-preparo"] as const) {
      expect(porQueNaoTransfere(comanda(1, 3, status, [pizza, esfiha, coca]), esfiha)).toBe(
        "A cozinha ainda está com Esfiha. Transfira quando ficar pronta.",
      )
    }
  })

  test("a rodada anterior, a da comanda pronta e o item sem cozinha saem", () => {
    const naCozinha = comanda(1, 3, "recebido", [pizza, esfiha, coca])
    expect(porQueNaoTransfere(naCozinha, pizza)).toBeNull()
    expect(porQueNaoTransfere(naCozinha, coca)).toBeNull()
    expect(porQueNaoTransfere(comanda(1, 3, "pronto", [pizza, esfiha]), esfiha)).toBeNull()
  })

  test("o item pago por item fica na conta que o pagou", () => {
    const paga = comanda(1, 3, "pronto", [pizza, coca], {
      pagamentos: [{ id: "p1", forma: "pix", valor: 10, em: AGORA.toISOString(), itens: ["Coca"] }],
    })
    expect(porQueNaoTransfere(paga, coca)).toBe("Esse item já foi pago.")
  })
})

describe("porQueNaoJunta", () => {
  const pronta = comanda(1, 3, "pronto", [item("Pizza")])

  test("a secundária que já é principal de outras, ou com desconto na conta, não junta", () => {
    const comJuntas = comanda(2, 5, "pronto", [item("Coca")], {
      mesa: { id: "mesa-5", numero: 5, juntadas: [{ id: "mesa-6", numero: 6 }] },
    })
    expect(porQueNaoJunta(pronta, comJuntas)).toBe("Separe as mesas da mesa 5 antes de juntar.")
    const comDesconto = comanda(2, 5, "pronto", [item("Coca")], {
      descontoConta: { modo: "reais", valor: 2, motivo: "Cliente fiel" },
    })
    expect(porQueNaoJunta(pronta, comDesconto)).toBe("Tire o desconto da mesa 5 antes de juntar.")
  })

  test("as duas com rodada na cozinha esperam uma ficar pronta; uma só, junta", () => {
    const aqui = comanda(1, 3, "em-preparo", [item("Pizza")])
    const la = comanda(2, 5, "recebido", [item("Esfiha")])
    expect(porQueNaoJunta(aqui, la)).toBe(
      "A cozinha está com rodadas das mesas 3 e 5. Junte depois que uma ficar pronta.",
    )
    expect(porQueNaoJunta(pronta, la)).toBeNull()
    expect(porQueNaoJunta(aqui, comanda(2, 5, "pronto", [item("Coca")]))).toBeNull()
  })
})

describe("juntarComandas", () => {
  const pix = { id: "p1", forma: "pix" as const, valor: 5, em: minutosAtras(10) }

  test("itens e pagamentos vêm para a principal, as pessoas somam e taxa e couvert são os dela", () => {
    const principal = comanda(1, 3, "pronto", [item("Pizza", { preco: 40 })], {
      mesa: { id: "mesa-3", numero: 3, garcom: "Rafa", pessoas: 2 },
      taxaServico: { percentual: 10 },
      couvert: { porPessoa: 8 },
    })
    const secundaria = comanda(2, 5, "pronto", [item("Coca", { preco: 20, cozinha: false })], {
      mesa: { id: "mesa-5", numero: 5, garcom: "Bia", pessoas: 3 },
      taxaServico: { percentual: 12, removida: { motivo: "Pediu" } },
      pagamentos: [pix],
    })

    const junta = juntarComandas(principal, secundaria)

    expect(junta.itens.map((atual) => atual.nome)).toEqual(["Pizza", "Coca"])
    expect(junta.pagamentos).toEqual([pix])
    expect(junta.mesa).toEqual({
      id: "mesa-3",
      numero: 3,
      garcom: "Rafa",
      pessoas: 5,
      juntadas: [{ id: "mesa-5", numero: 5 }],
    })
    expect(junta.taxaServico).toEqual({ percentual: 10 })
    expect(junta.couvert).toEqual({ porPessoa: 8 })
    // R$ 60,00 de itens + R$ 6,00 de taxa + R$ 8,00 × 5 pessoas de couvert.
    expect(junta).toMatchObject({ subtotal: 60, total: 106 })
  })

  const rodadas = (pedido: Pedido) => pedido.itens.map((atual) => [atual.nome, atual.rodada])

  test("a secundária na cozinha entra depois: a cozinha continua vendo só a rodada dela", () => {
    const principal = comanda(1, 3, "pronto", [
      item("Pizza", { rodada: 1 }),
      item("Batata", { rodada: 2 }),
    ])
    const secundaria = comanda(2, 5, "recebido", [
      item("Coca", { rodada: 1, cozinha: false }),
      item("Esfiha", { rodada: 2 }),
    ])

    const junta = juntarComandas(principal, secundaria)

    expect(rodadas(junta)).toEqual([
      ["Pizza", 1],
      ["Batata", 2],
      ["Coca", 3],
      ["Esfiha", 4],
    ])
    expect(junta.status).toBe("recebido")
    expect(itensDaCozinha(junta).atuais.map((atual) => atual.nome)).toEqual(["Esfiha"])
  })

  test("a principal na cozinha fica por último: as rodadas dela vêm depois das da secundária", () => {
    const principal = comanda(1, 3, "em-preparo", [item("Pizza", { rodada: 1 })])
    const secundaria = comanda(2, 5, "pronto", [
      item("Esfiha", { rodada: 1 }),
      item("Batata", { rodada: 2 }),
    ])

    const junta = juntarComandas(principal, secundaria)

    expect(rodadas(junta)).toEqual([
      ["Pizza", 3],
      ["Esfiha", 1],
      ["Batata", 2],
    ])
    expect(junta.status).toBe("em-preparo")
    expect(itensDaCozinha(junta).atuais.map((atual) => atual.nome)).toEqual(["Pizza"])
  })

  test("cada item guarda se ia para a cozinha, mesmo sem o campo (comanda antiga)", () => {
    const { vaiParaCozinha: _, ...semCampo } = item("Coca")
    const principal = comanda(1, 3, "pronto", [item("Pizza")])
    const secundaria = comanda(2, 5, "pronto", [semCampo], { enviarParaCozinha: false })

    const junta = juntarComandas(principal, secundaria)

    expect(junta.itens.map((atual) => atual.vaiParaCozinha)).toEqual([true, false])
    expect(junta.enviarParaCozinha).toBe(true)
  })

  test("servir e pediu a conta ficam com a hora mais antiga das duas", () => {
    const principal = comanda(1, 3, "pronto", [item("Pizza")], {
      servirDesde: minutosAtras(4),
    })
    const secundaria = comanda(2, 5, "pronto", [item("Esfiha")], {
      servirDesde: minutosAtras(9),
      contaPedidaEm: minutosAtras(2),
    })

    const junta = juntarComandas(principal, secundaria)

    expect(junta.servirDesde).toBe(minutosAtras(9))
    expect(junta.contaPedidaEm).toBe(minutosAtras(2))
  })

  test("o histórico da secundária entra na ordem da hora, com o número da mesa na frente", () => {
    const principal = comanda(1, 3, "pronto", [item("Pizza")], {
      eventos: [
        { tipo: "aberta", em: minutosAtras(50), por: "Rafa", texto: "Mesa aberta para 2 pessoas" },
        { tipo: "rodada", em: minutosAtras(20), texto: "Rodada 1 para a cozinha: 1× Pizza" },
      ],
    })
    const secundaria = comanda(2, 5, "pronto", [item("Esfiha")], {
      eventos: [
        { tipo: "aberta", em: minutosAtras(30), por: "Bia", texto: "Mesa aberta para 3 pessoas" },
      ],
    })

    expect(juntarComandas(principal, secundaria).eventos?.map((evento) => evento.texto)).toEqual([
      "Mesa aberta para 2 pessoas",
      "Mesa 5: Mesa aberta para 3 pessoas",
      "Rodada 1 para a cozinha: 1× Pizza",
    ])
  })
})
