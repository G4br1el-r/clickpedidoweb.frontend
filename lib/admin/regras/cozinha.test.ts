import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido, StatusPedido, TipoPedido } from "../dados/tipos"
import {
  chavesDaCozinha,
  colunasDaCozinha,
  cozinhaJaPreparou,
  type FiltroCozinha,
  itensDaCozinha,
  minutosNaCozinha,
  novidadesNaCozinha,
  statusPelasRodadas,
  ticketsDaCozinha,
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

const iniciadoHa = (minutos: number) => ({ iniciadoEm: minutosAtras(minutos) })
const feitoHa = (minutos: number) => ({
  iniciadoEm: minutosAtras(minutos + 8),
  feitoEm: minutosAtras(minutos),
})

const QUADRO = [
  pedido(10, "recebido", 3),
  pedido(11, "recebido", 9, "retirada"),
  // Comanda com a rodada 1 no fogo e a rodada 2 nova: dois tickets, em colunas diferentes.
  pedido(12, "recebido", 90, "mesa", [
    { ...item("Pizza", 1, true, 30), ...iniciadoHa(20) },
    item("Batata", 2, true, 6),
  ]),
  pedido(13, "em-preparo", 20, "mesa", [{ ...item("Pizza", 1, true, 20), ...iniciadoHa(10) }]),
  pedido(14, "pronto", 30, "entrega", [{ ...item("Pizza"), ...feitoHa(12) }]),
  // Pronto há mais de 15 minutos: já saiu da mão da cozinha.
  pedido(15, "pronto", 60, "mesa", [{ ...item("Pizza", 1, true, 60), ...feitoHa(40) }]),
  pedido(16, "saiu-para-entrega", 30),
  pedido(17, "concluido", 60),
  pedido(18, "aguardando-pagamento", 1),
  pedido(19, "em-preparo", 30, "atendimento"),
  pedido(20, "recebido", 4, "mesa", [item("Cerveja", 1, false)]),
]

const resumo = (colunas: ReturnType<typeof colunasDaCozinha>) =>
  colunas.map((coluna) => [coluna.titulo, coluna.tickets.map((ticket) => ticket.id)])

describe("colunasDaCozinha", () => {
  test("cada rodada na coluna da sua etapa, do que chegou primeiro ao último", () => {
    expect(resumo(colunasDaCozinha(QUADRO, "todos", AGORA))).toEqual([
      ["A fazer", ["11:1", "12:2", "10:1"]],
      ["Preparando", ["12:1", "13:1"]],
      ["Prontos", ["14:1"]],
    ])
  })

  test("filtros: mesas, entrega (sem retirada) e retirada", () => {
    const ids = (filtro: FiltroCozinha) =>
      colunasDaCozinha(QUADRO, filtro, AGORA).flatMap((coluna) => coluna.tickets.map((t) => t.id))
    expect(ids("mesas")).toEqual(["12:2", "12:1", "13:1"])
    expect(ids("entrega")).toEqual(["10:1", "14:1"])
    expect(ids("retirada")).toEqual(["11:1"])
  })

  test("pedido com prioridade passa na frente na coluna", () => {
    const comPrioridade = QUADRO.map((p) => (p.id === 10 ? { ...p, prioridade: true } : p))
    const [aFazer] = resumo(colunasDaCozinha(comPrioridade, "todos", AGORA))
    expect(aFazer).toEqual(["A fazer", ["10:1", "11:1", "12:2"]])
  })

  test("cancelado fica no quadro, com o aviso, até a cozinha dar ciente", () => {
    const aviso = { id: "av-1", tipo: "cancelado" as const, em: minutosAtras(1) }
    const cancelado = {
      ...pedido(40, "cancelado", 10, "entrega", [{ ...item("Pizza"), ...iniciadoHa(5) }]),
      avisosCozinha: [aviso],
    }
    const ciente = {
      ...cancelado,
      id: 41,
      avisosCozinha: [{ ...aviso, cienteEm: minutosAtras(0) }],
    }
    const semAviso = { ...cancelado, id: 42, avisosCozinha: undefined }

    const colunas = colunasDaCozinha([cancelado, ciente, semAviso], "todos", AGORA)
    expect(resumo(colunas)).toEqual([
      ["A fazer", []],
      ["Preparando", ["40:1"]],
      ["Prontos", []],
    ])
    expect(colunas[1].tickets[0].avisos).toEqual([aviso])
  })

  test("alterado fica no ticket da rodada; rodada esvaziada continua até o ciente", () => {
    const tirou = (rodada: number, etapa: "recebido" | "em-preparo") => ({
      id: `av-${rodada}`,
      tipo: "alterado" as const,
      em: minutosAtras(1),
      rodada,
      etapa,
      itens: [{ nome: "Batata", quantidade: 1 }],
    })
    const comanda = {
      ...pedido(43, "recebido", 40, "mesa", [
        { ...item("Pizza", 1, true, 30), ...iniciadoHa(20) },
        item("Esfiha", 2, true, 6),
      ]),
      avisosCozinha: [tirou(2, "recebido"), tirou(3, "em-preparo")],
    }
    const colunas = colunasDaCozinha([comanda], "todos", AGORA)
    expect(resumo(colunas)).toEqual([
      ["A fazer", ["43:2"]],
      ["Preparando", ["43:1", "43:3"]],
      ["Prontos", []],
    ])
    const [primeira, esvaziada] = colunas[1].tickets
    expect(primeira.avisos).toEqual([])
    expect(esvaziada.itens).toEqual([])
    expect(esvaziada.avisos.map((aviso) => aviso.id)).toEqual(["av-3"])
    // A rodada vazia não segura o status do pedido.
    expect(statusPelasRodadas(comanda)).toBe("recebido")
  })
})

describe("novidadesNaCozinha", () => {
  test("pedido novo e rodada nova de uma comanda que já estava na tela tocam o alerta", () => {
    const antes = chavesDaCozinha([
      QUADRO[0],
      pedido(12, "pronto", 90, "mesa", [{ ...item("Pizza", 1, true), ...feitoHa(2) }]),
    ])
    // A comanda 20 só tem bebida: não chega nada na cozinha, nada toca.
    const depois = [QUADRO[0], QUADRO[1], QUADRO[2], QUADRO[3], QUADRO[10]]
    expect(novidadesNaCozinha(antes, depois)).toEqual(["11:1", "12:2"])
  })

  test("cancelamento ou alteração que chega também toca, uma vez", () => {
    const antes = chavesDaCozinha([QUADRO[0]])
    const aviso = { id: "av-9", tipo: "cancelado" as const, em: minutosAtras(0) }
    const cancelado = { ...QUADRO[0], status: "cancelado" as const, avisosCozinha: [aviso] }
    expect(novidadesNaCozinha(antes, [cancelado])).toEqual(["aviso:av-9"])
    expect(novidadesNaCozinha(chavesDaCozinha([cancelado]), [cancelado])).toEqual([])
  })
})

describe("urgenciaNaCozinha", () => {
  const unico = (p: Pedido) => ticketsDaCozinha([p])[0]

  test("âmbar a partir de 15 minutos e vermelho a partir de 25, contando da rodada", () => {
    expect(urgenciaNaCozinha(unico(pedido(1, "recebido", 14)), AGORA)).toBe("normal")
    expect(urgenciaNaCozinha(unico(pedido(1, "recebido", 15)), AGORA)).toBe("atencao")
    expect(urgenciaNaCozinha(unico(pedido(1, "em-preparo", 25)), AGORA)).toBe("atrasado")
  })

  test("cada rodada conta da própria chegada", () => {
    const [primeira, segunda] = ticketsDaCozinha([QUADRO[2]])
    expect(minutosNaCozinha(primeira, AGORA)).toBe(30)
    expect(urgenciaNaCozinha(primeira, AGORA)).toBe("atrasado")
    expect(minutosNaCozinha(segunda, AGORA)).toBe(6)
    expect(urgenciaNaCozinha(segunda, AGORA)).toBe("normal")
  })
})

describe("ticketsDaCozinha", () => {
  const iniciado = { iniciadoEm: minutosAtras(8) }
  const resumir = (tickets: ReturnType<typeof ticketsDaCozinha>) =>
    tickets.map((ticket) => [ticket.id, ticket.status, nomes(ticket.itens)])

  test("cada rodada da comanda é um ticket, com o estado tirado dos itens", () => {
    const comanda = pedido(30, "recebido", 40, "mesa", [
      { ...item("Pizza", 1, true, 30), ...iniciado },
      item("Cerveja", 1, false, 30),
      item("Batata", 2, true, 5),
      item("Esfiha", 2, true, 5),
    ])
    expect(resumir(ticketsDaCozinha([comanda]))).toEqual([
      ["30:1", "em-preparo", ["Pizza"]],
      ["30:2", "recebido", ["Batata", "Esfiha"]],
    ])
  })

  test("pronto quando todos os itens da rodada foram riscados", () => {
    const feito = { ...iniciado, feitoEm: minutosAtras(2) }
    const tudo = pedido(31, "pronto", 20, "entrega", [
      { ...item("Pizza"), ...feito },
      { ...item("Esfiha"), ...feito },
    ])
    const metade = pedido(32, "em-preparo", 20, "entrega", [
      { ...item("Pizza"), ...feito },
      { ...item("Esfiha"), ...iniciado },
    ])
    expect(resumir(ticketsDaCozinha([tudo, metade]))).toEqual([
      ["31:1", "pronto", ["Pizza", "Esfiha"]],
      ["32:1", "em-preparo", ["Pizza", "Esfiha"]],
    ])
  })

  test("a chegada é o lançamento da rodada, ou a criação do pedido", () => {
    const comanda = pedido(33, "recebido", 40, "mesa", [
      item("Pizza", 1, true, 30),
      item("Batata", 2, true, 5),
    ])
    const chegadas = ticketsDaCozinha([comanda, pedido(34, "recebido", 9)]).map(
      (ticket) => ticket.chegouEm,
    )
    expect(chegadas).toEqual([minutosAtras(30), minutosAtras(5), minutosAtras(9)])
  })

  test("fica de fora o salão, a comanda sem cozinha e o que não está na cozinha", () => {
    const fora = [
      pedido(35, "em-preparo", 10, "atendimento"),
      pedido(36, "pronto", 10, "mesa", [item("Cerveja", 1, false)]),
      pedido(37, "saiu-para-entrega", 10),
      pedido(38, "concluido", 10),
      pedido(39, "cancelado", 10),
      pedido(40, "aguardando-pagamento", 10),
    ]
    expect(ticketsDaCozinha([...fora, pedido(41, "recebido", 2)]).map((t) => t.id)).toEqual([
      "41:1",
    ])
  })
})
