import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido, StatusPedido, TipoPedido } from "../dados/tipos"
import {
  agendadoParaHoje,
  atrasadosNaCozinha,
  avisarSobreRodada,
  chavesDaCozinha,
  chavesDeQuemServe,
  colunasDaCozinha,
  conferirAgendado,
  cozinhaJaPreparou,
  type FiltroCozinha,
  itensDaCozinha,
  maisTardeNaCozinha,
  mensagensPendentes,
  minutosNaCozinha,
  novidadesNaCozinha,
  prometidoAoCliente,
  prontosParaServir,
  servirRodada,
  statusPelasRodadas,
  TEXTO_DA_MENSAGEM,
  ticketsDaCozinha,
  urgenciaNaCozinha,
  verMensagem,
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
  const comecou = { iniciadoEm: minutosAtras(10) }

  test("a rodada do item já começou, ficou pronta ou foi servida", () => {
    const pizza = { ...item("Pizza", 1, true), ...comecou }
    const batata = item("Batata", 2, true)
    // A rodada 2 nova põe a comanda em Novo, mas a pizza já está no fogo.
    const comanda = pedido(1, "recebido", 5, "mesa", [pizza, batata])
    expect(cozinhaJaPreparou(comanda, pizza)).toBe(true)
    const servida = { ...pizza, feitoEm: minutosAtras(5), servidoEm: minutosAtras(2) }
    expect(cozinhaJaPreparou(pedido(1, "pronto", 5, "mesa", [servida]), servida)).toBe(true)
  })

  test("rodada que ainda não começou, ou item que não passa pela cozinha", () => {
    const pizza = { ...item("Pizza", 1, true), ...comecou, feitoEm: minutosAtras(5) }
    const batata = item("Batata", 2, true)
    const agua = item("Água", 1, false)
    expect(cozinhaJaPreparou(pedido(1, "recebido", 5, "mesa", [pizza, batata]), batata)).toBe(false)
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

const minutosDepois = (minutos: number) =>
  new Date(AGORA.getTime() + minutos * 60_000).toISOString()

/** Retirada criada há 10 minutos, agendada para daqui a tantos minutos. */
const agendada = (id: number, daquiA: number, extra: Partial<ItemPedido> = {}) =>
  pedido(id, extra.iniciadoEm ? "em-preparo" : "recebido", 10, "retirada", [
    { ...item("Pizza"), agendadoPara: minutosDepois(daquiA), ...extra },
  ])

/** A loja leva 20 minutos para preparar (o mínimo da retirada). */
const COM_PREPARO = { atencaoMin: 15, atrasoMin: 25, prontoFicaMin: 15, preparoMin: 20 }

describe("agendado", () => {
  const AGENDADOS = [agendada(30, 60), agendada(31, 15)]

  test("espera em Mais tarde até a hora de começar: o agendado menos o preparo", () => {
    expect(
      maisTardeNaCozinha(AGENDADOS, "todos", AGORA, COM_PREPARO).map((ticket) => [
        ticket.id,
        ticket.agendadoPara,
      ]),
    ).toEqual([["30:1", minutosDepois(60)]])
    const [aFazer] = colunasDaCozinha(AGENDADOS, "todos", AGORA, COM_PREPARO)
    expect(aFazer.tickets.map((ticket) => ticket.id)).toEqual(["31:1"])
  })

  test("a urgência conta da hora de começar, não da criação", () => {
    const [, deAgora] = ticketsDaCozinha(AGENDADOS)
    expect(minutosNaCozinha(deAgora, AGORA, COM_PREPARO)).toBe(5)
    expect(urgenciaNaCozinha(deAgora, AGORA, COM_PREPARO)).toBe("normal")
  })

  test("só toca o alerta quando entra em A fazer", () => {
    expect(chavesDaCozinha(AGENDADOS, AGORA, COM_PREPARO)).toEqual(new Set(["31:1"]))
    const depois = new Date(AGORA.getTime() + 41 * 60_000)
    expect(novidadesNaCozinha(new Set(["31:1"]), AGENDADOS, depois, COM_PREPARO)).toEqual(["30:1"])
  })

  test("cancelado antes da hora vai para o quadro, para o ciente", () => {
    const aviso = { id: "av-30", tipo: "cancelado" as const, em: minutosAtras(0) }
    const cancelado = { ...agendada(33, 60), status: "cancelado" as const, avisosCozinha: [aviso] }
    expect(maisTardeNaCozinha([cancelado], "todos", AGORA, COM_PREPARO)).toEqual([])
    const [aFazer] = colunasDaCozinha([cancelado], "todos", AGORA, COM_PREPARO)
    expect(aFazer.tickets.map((ticket) => ticket.id)).toEqual(["33:1"])
  })

  test("iniciado antes da hora, sai de Mais tarde e vai para Preparando", () => {
    const adiantado = agendada(32, 60, { iniciadoEm: minutosAtras(1) })
    expect(maisTardeNaCozinha([adiantado], "todos", AGORA, COM_PREPARO)).toEqual([])
    const [, preparando] = colunasDaCozinha([adiantado], "todos", AGORA, COM_PREPARO)
    expect(preparando.tickets.map((ticket) => ticket.id)).toEqual(["32:1"])
  })
})

describe("agendadoParaHoje", () => {
  test("a hora digitada vira o horário de hoje; vazio é sem agendar", () => {
    expect(agendadoParaHoje("22:00", AGORA)).toBe(new Date(2026, 10, 13, 22, 0).toISOString())
    expect(agendadoParaHoje("", AGORA)).toBeUndefined()
    expect(agendadoParaHoje("__:__", AGORA)).toBeUndefined()
  })

  test("hora pela metade ou que não existe pede o formato", () => {
    expect(() => agendadoParaHoje("22:_", AGORA)).toThrow("Use o formato 20:00.")
    expect(() => agendadoParaHoje("25:00", AGORA)).toThrow("Use o formato 20:00.")
  })
})

describe("conferirAgendado", () => {
  test("aceita um horário mais tarde, ainda hoje", () => {
    expect(conferirAgendado(minutosDepois(60), AGORA)).toBe(minutosDepois(60))
  })

  test("recusa horário que já passou e de outro dia", () => {
    const mensagem = "Escolha um horário mais tarde, ainda hoje."
    expect(() => conferirAgendado(minutosAtras(1), AGORA)).toThrow(mensagem)
    expect(() => conferirAgendado(minutosDepois(24 * 60), AGORA)).toThrow(mensagem)
    expect(() => conferirAgendado("amanhã", AGORA)).toThrow(mensagem)
  })
})

describe("prometidoAoCliente", () => {
  const PRAZOS = { entrega: { min: 35, max: 50 }, retirada: { min: 20, max: 30 } }
  const unico = (p: Pedido) => ticketsDaCozinha([p])[0]

  test("a criação mais o tempo máximo, com o que falta ou já passou", () => {
    expect(prometidoAoCliente(unico(pedido(40, "recebido", 20)), PRAZOS, AGORA)).toEqual({
      ate: minutosDepois(30),
      minutos: 30,
    })
    expect(
      prometidoAoCliente(unico(pedido(41, "recebido", 33, "retirada")), PRAZOS, AGORA),
    ).toEqual({ ate: minutosAtras(3), minutos: -3 })
  })

  test("o agendado promete o próprio horário; a mesa e a loja sem prazos não prometem", () => {
    expect(prometidoAoCliente(unico(agendada(42, 60)), PRAZOS, AGORA)).toEqual({
      ate: minutosDepois(60),
      minutos: 60,
    })
    expect(prometidoAoCliente(unico(QUADRO[3]), PRAZOS, AGORA)).toBeNull()
    expect(prometidoAoCliente(unico(pedido(43, "recebido", 5)), undefined, AGORA)).toBeNull()
  })
})

describe("colunasDaCozinha", () => {
  test("cada rodada na coluna da sua etapa, do que chegou primeiro ao último", () => {
    expect(resumo(colunasDaCozinha(QUADRO, "todos", AGORA))).toEqual([
      ["A fazer", ["11:1", "12:2", "10:1"]],
      ["Preparando", ["12:1", "13:1"]],
      ["Prontos", ["14:1"]],
    ])
  })

  test("o pronto fica na tela o tempo que a loja escolheu", () => {
    const tempos = { atencaoMin: 15, atrasoMin: 25, prontoFicaMin: 45 }
    expect(resumo(colunasDaCozinha(QUADRO, "todos", AGORA, tempos))[2]).toEqual([
      "Prontos",
      // Pela chegada: o 15 chegou há 60 minutos; o 14, há 30.
      ["15:1", "14:1"],
    ])
    const curto = { ...tempos, prontoFicaMin: 10 }
    expect(resumo(colunasDaCozinha(QUADRO, "todos", AGORA, curto))[2]).toEqual(["Prontos", []])
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

describe("atrasadosNaCozinha", () => {
  test("as rodadas que passaram do atraso e ainda não ficaram prontas", () => {
    expect(atrasadosNaCozinha(QUADRO, AGORA)).toEqual(new Set(["12:1"]))
    const tempos = { atencaoMin: 5, atrasoMin: 10, prontoFicaMin: 15 }
    expect(atrasadosNaCozinha(QUADRO, AGORA, tempos)).toEqual(new Set(["12:1", "13:1"]))
  })
})

describe("urgenciaNaCozinha", () => {
  const unico = (p: Pedido) => ticketsDaCozinha([p])[0]

  test("âmbar a partir de 15 minutos e vermelho a partir de 25, contando da rodada", () => {
    expect(urgenciaNaCozinha(unico(pedido(1, "recebido", 14)), AGORA)).toBe("normal")
    expect(urgenciaNaCozinha(unico(pedido(1, "recebido", 15)), AGORA)).toBe("atencao")
    expect(urgenciaNaCozinha(unico(pedido(1, "em-preparo", 25)), AGORA)).toBe("atrasado")
  })

  test("com os tempos da loja: atenção aos 5 e atraso aos 10 minutos", () => {
    const tempos = { atencaoMin: 5, atrasoMin: 10, prontoFicaMin: 15 }
    expect(urgenciaNaCozinha(unico(pedido(1, "recebido", 4)), AGORA, tempos)).toBe("normal")
    expect(urgenciaNaCozinha(unico(pedido(1, "recebido", 5)), AGORA, tempos)).toBe("atencao")
    expect(urgenciaNaCozinha(unico(pedido(1, "recebido", 10)), AGORA, tempos)).toBe("atrasado")
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

describe("servirRodada", () => {
  const agora = AGORA.toISOString()
  const comanda = pedido(50, "recebido", 40, "mesa", [
    { ...item("Pizza", 1, true, 30), ...feitoHa(3) },
    item("Cerveja", 1, false, 30),
    item("Batata", 2, true, 5),
  ])

  test("rodada pronta servida sai da cozinha; a comanda segue no status das outras", () => {
    const servida = servirRodada(comanda, 1, agora)
    expect(servida.itens.map((doPedido) => doPedido.servidoEm)).toEqual([
      agora,
      undefined,
      undefined,
    ])
    expect(ticketsDaCozinha([servida]).map((ticket) => ticket.id)).toEqual(["50:2"])
    expect(servida.status).toBe("recebido")
  })

  test("só a rodada pronta pode ser servida", () => {
    expect(() => servirRodada(comanda, 2, agora)).toThrow("Esta rodada ainda não está pronta.")
    expect(() => servirRodada(comanda, 7, agora)).toThrow("Esta rodada não está na cozinha.")
  })
})

describe("prontosParaServir", () => {
  test("rodadas prontas das mesas, da que ficou pronta primeiro; entrega e servido ficam fora", () => {
    const mesa5 = pedido(60, "recebido", 40, "mesa", [
      { ...item("Pizza", 1, true, 30), ...feitoHa(2) },
      item("Batata", 2, true, 5),
    ])
    const mesa7 = pedido(61, "pronto", 20, "mesa", [
      { ...item("Esfiha", 1, true, 20), ...feitoHa(6) },
    ])
    const servida = pedido(62, "pronto", 20, "mesa", [
      { ...item("Pizza", 1, true, 20), ...feitoHa(9), servidoEm: minutosAtras(4) },
    ])
    const entrega = pedido(63, "pronto", 20, "entrega", [{ ...item("Pizza"), ...feitoHa(1) }])
    expect(prontosParaServir([mesa5, mesa7, servida, entrega]).map((t) => t.id)).toEqual([
      "61:1",
      "60:1",
    ])
  })
})

describe("mensagens da cozinha", () => {
  const agora = AGORA.toISOString()
  const comanda = pedido(70, "recebido", 40, "mesa", [
    { ...item("Pizza", 1, true, 30), ...iniciadoHa(10) },
    { ...item("Batata", 2, true, 30), ...feitoHa(10), servidoEm: minutosAtras(5) },
  ])

  test("a cozinha avisa sobre uma rodada; a mensagem fica pendente até alguém dar Ok", () => {
    const avisado = avisarSobreRodada(comanda, 1, "atraso", "msg-1", agora)
    expect(mensagensPendentes(avisado)).toEqual([
      { id: "msg-1", rodada: 1, tipo: "atraso", em: agora },
    ])
    expect(TEXTO_DA_MENSAGEM.atraso).toBe("Vai atrasar ~10 min")

    const visto = verMensagem(avisado, "msg-1", agora)
    expect(mensagensPendentes(visto)).toEqual([])
    expect(visto.mensagensCozinha?.[0].vistaEm).toBe(agora)
  })

  test("a mesma mensagem pendente não se repete na rodada", () => {
    const uma = avisarSobreRodada(comanda, 1, "duvida", "msg-1", agora)
    const duas = avisarSobreRodada(uma, 1, "duvida", "msg-2", agora)
    expect(mensagensPendentes(duas).map((mensagem) => mensagem.id)).toEqual(["msg-1"])
  })

  test("só se avisa sobre rodada que está na cozinha, e Ok de mensagem que existe", () => {
    expect(() => avisarSobreRodada(comanda, 2, "atraso", "msg-1", agora)).toThrow(
      "Esta rodada não está na cozinha.",
    )
    expect(() => verMensagem(comanda, "msg-9", agora)).toThrow("Mensagem não encontrada.")
  })
})

describe("chavesDeQuemServe", () => {
  const mensagem = (id: string) => ({ id, rodada: 1, tipo: "atraso" as const, em: minutosAtras(1) })
  const mesa = {
    ...pedido(80, "pronto", 20, "mesa", [{ ...item("Pizza", 1, true, 20), ...feitoHa(1) }]),
    mensagensCozinha: [mensagem("msg-a"), { ...mensagem("msg-b"), vistaEm: minutosAtras(0) }],
  }
  const entrega = {
    ...pedido(81, "pronto", 20, "entrega", [{ ...item("Pizza"), ...feitoHa(1) }]),
    mensagensCozinha: [mensagem("msg-c")],
  }
  const preparando = pedido(82, "em-preparo", 10, "retirada", [
    { ...item("Pizza"), ...iniciadoHa(3) },
  ])

  test("o salão olha as rodadas prontas das mesas e as mensagens pendentes delas", () => {
    expect([...chavesDeQuemServe([mesa, entrega, preparando], "salao")]).toEqual([
      "pronto:80:1",
      "msg:msg-a",
    ])
  })

  test("o caixa olha a entrega e a retirada prontas e as mensagens delas", () => {
    expect([...chavesDeQuemServe([mesa, entrega, preparando], "caixa")]).toEqual([
      "pronto:81",
      "msg:msg-c",
    ])
  })
})
