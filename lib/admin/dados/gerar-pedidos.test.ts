import { describe, expect, test } from "vitest"
import { statusPelasRodadas } from "../regras/cozinha"
import { catalogoDeTeste as catalogo } from "./catalogo-de-teste"
import { gerarPedidoAgora, gerarPedidos } from "./gerar-pedidos"
import type { Pedido } from "./tipos"

/** Sexta, 13/11/2026, 20:30 em São Paulo (o fuso dos testes). */
const AGORA = new Date(2026, 10, 13, 20, 30)
const dia = (pedido: Pedido) => new Date(pedido.criadoEm).getDate()
const EM_ANDAMENTO = ["recebido", "em-preparo", "pronto", "saiu-para-entrega"]

describe("gerarPedidoAgora", () => {
  const ultimo = { id: 500, numero: 500, criadoEm: new Date(2026, 10, 13, 20, 0).toISOString() }

  test("um pedido novo agora, com o número seguinte", () => {
    const novo = gerarPedidoAgora({
      catalogo: catalogo(),
      segmento: "pizzaria",
      agora: AGORA,
      ultimo,
      semente: 1,
    })
    expect(novo.id).toBe(501)
    expect(novo.numero).toBe(501)
    expect(novo.status).toBe("recebido")
    expect(novo.criadoEm).toBe(AGORA.toISOString())
    expect(novo.itens.length).toBeGreaterThan(0)
  })

  test("a mesma semente gera o mesmo pedido; outra semente, outro", () => {
    const opcoes = { catalogo: catalogo(), segmento: "pizzaria" as const, agora: AGORA, ultimo }
    expect(gerarPedidoAgora({ ...opcoes, semente: 7 })).toEqual(
      gerarPedidoAgora({ ...opcoes, semente: 7 }),
    )
    expect(gerarPedidoAgora({ ...opcoes, semente: 7 }).token).not.toBe(
      gerarPedidoAgora({ ...opcoes, semente: 8 }).token,
    )
  })

  test("na lanchonete o número continua no mês e recomeça no mês seguinte", () => {
    const opcoes = {
      catalogo: catalogo(),
      segmento: "lanchonete" as const,
      agora: AGORA,
      semente: 1,
    }
    const noMes = gerarPedidoAgora({ ...opcoes, ultimo: { ...ultimo, numero: 37 } })
    expect(noMes.numero).toBe(38)
    const mesPassado = { ...ultimo, numero: 37, criadoEm: new Date(2026, 9, 31, 22).toISOString() }
    expect(gerarPedidoAgora({ ...opcoes, ultimo: mesPassado }).numero).toBe(1)
  })

  test("no salão, é um agendamento para mais tarde", () => {
    const novo = gerarPedidoAgora({
      catalogo: catalogo(),
      segmento: "salao",
      agora: AGORA,
      ultimo,
      semente: 3,
    })
    expect(novo.tipo).toBe("atendimento")
    expect(Date.parse(novo.agendamento?.inicio ?? "")).toBeGreaterThan(AGORA.getTime())
  })
})

describe("gerarPedidos", () => {
  test("o mesmo período gera os mesmos pedidos", () => {
    const opcoes = {
      catalogo: catalogo(),
      segmento: "lanchonete" as const,
      de: new Date(2026, 10, 10),
      agora: AGORA,
    }
    expect(gerarPedidos(opcoes)).toEqual(gerarPedidos(opcoes))
    expect(gerarPedidos(opcoes).length).toBeGreaterThan(20)
  })

  test("o token tem 128 bits do sorteador, sem o segmento nem o número", () => {
    const opcoes = {
      catalogo: catalogo(),
      segmento: "lanchonete" as const,
      de: new Date(2026, 10, 10),
      agora: AGORA,
    }
    const pedidos = gerarPedidos(opcoes)
    for (const pedido of pedidos) {
      expect(pedido.token).toMatch(/^[0-9a-f]{32}$/)
      expect(pedido.token).not.toContain("lanchonete")
    }
    expect(new Set(pedidos.map((pedido) => pedido.token)).size).toBe(pedidos.length)
    const agora = gerarPedidoAgora({
      catalogo: catalogo(),
      segmento: "pizzaria",
      agora: AGORA,
      semente: 1,
    })
    expect(agora.token).toMatch(/^[0-9a-f]{32}$/)
  })

  test("o item soma o adicional obrigatório e a entrega cobra a taxa do bairro", () => {
    const pedidos = gerarPedidos({
      catalogo: catalogo(),
      segmento: "lanchonete",
      de: new Date(2026, 10, 9),
      agora: AGORA,
    })

    for (const item of pedidos.flatMap((pedido) => pedido.itens)) {
      expect(item.precoUnitario).toBe(23)
      expect(item.opcoes).toEqual(["Adicional: Bacon"])
    }
    const entregas = pedidos.filter((pedido) => pedido.tipo === "entrega")
    expect(entregas.length).toBeGreaterThan(0)
    for (const pedido of entregas) {
      expect(pedido.taxaEntrega).toBe(5)
      expect(pedido.endereco?.bairro).toBe("Centro")
    }
    for (const pedido of pedidos.filter((pedido) => pedido.tipo !== "entrega")) {
      expect(pedido.taxaEntrega).toBe(0)
    }
  })

  test("um pedido de 2 lanches entregue custa R$ 51", () => {
    const pedidos = gerarPedidos({
      catalogo: catalogo(),
      segmento: "lanchonete",
      de: new Date(2026, 10, 1),
      agora: AGORA,
    })
    const exemplo = pedidos.find(
      (pedido) =>
        pedido.tipo === "entrega" && pedido.itens.length === 1 && pedido.itens[0].quantidade === 2,
    )
    expect(exemplo).toBeDefined()
    expect(exemplo?.subtotal).toBe(46)
    expect(exemplo?.total).toBe(51)
  })

  test("só gera pedidos no horário da loja e até agora", () => {
    const pedidos = gerarPedidos({
      catalogo: catalogo(),
      segmento: "lanchonete",
      de: new Date(2026, 10, 9),
      agora: AGORA,
    })

    for (const pedido of pedidos) {
      const criado = new Date(pedido.criadoEm)
      expect(criado.getTime()).toBeLessThanOrEqual(AGORA.getTime())
      expect(criado.getHours()).toBeGreaterThanOrEqual(18)
      expect(criado.getHours()).toBeLessThan(23)
    }
  })

  test("hoje tem pedidos em andamento; os dias anteriores estão encerrados", () => {
    const pedidos = gerarPedidos({
      catalogo: catalogo(),
      segmento: "lanchonete",
      de: new Date(2026, 10, 9),
      agora: AGORA,
    })

    const deHoje = pedidos.filter((pedido) => dia(pedido) === 13)
    expect(deHoje.some((pedido) => EM_ANDAMENTO.includes(pedido.status))).toBe(true)
    for (const pedido of pedidos.filter((pedido) => dia(pedido) < 13)) {
      expect(["concluido", "cancelado"]).toContain(pedido.status)
    }
  })

  test("a demonstração abre com pedidos em todas as etapas, inclusive mesa aberta", () => {
    const pedidos = gerarPedidos({
      catalogo: catalogo(),
      segmento: "lanchonete",
      de: new Date(2026, 10, 13),
      agora: AGORA,
    })
    const etapas = new Set(pedidos.map((pedido) => `${pedido.tipo}:${pedido.status}`))
    for (const etapa of [
      "entrega:aguardando-pagamento",
      "retirada:recebido",
      "entrega:em-preparo",
      "retirada:pronto",
      "entrega:saiu-para-entrega",
      "mesa:pronto",
    ]) {
      expect(etapas).toContain(etapa)
    }
  })

  test("cada pedido traz a hora de cada etapa, e a cozinha bate com o status", () => {
    const pedidos = gerarPedidos({
      catalogo: catalogo(),
      segmento: "lanchonete",
      de: new Date(2026, 10, 12),
      agora: AGORA,
    })
    const ORDEM = ["recebido", "em-preparo", "pronto", "saiu-para-entrega", "concluido"]
    const NA_COZINHA = ["recebido", "em-preparo", "pronto"]

    for (const pedido of pedidos) {
      const etapas = pedido.etapas ?? {}
      expect(etapas[pedido.status]).toBeDefined()
      const horas = ORDEM.flatMap((status) => {
        const hora = etapas[status as keyof typeof etapas]
        return hora ? [Date.parse(hora)] : []
      })
      expect(horas).toEqual(horas.toSorted((a, b) => a - b))
      expect(Math.max(...horas)).toBeLessThanOrEqual(AGORA.getTime())

      if (NA_COZINHA.includes(pedido.status)) {
        expect(statusPelasRodadas(pedido)).toBe(pedido.status)
      }
      // O que passou pela cozinha guarda quando começou e quando ficou pronto.
      if (etapas.pronto) {
        for (const item of pedido.itens) {
          expect(item.iniciadoEm).toBe(etapas["em-preparo"])
          expect(item.feitoEm).toBe(etapas.pronto)
        }
      }
    }
    expect(pedidos.filter((pedido) => pedido.etapas?.pronto).length).toBeGreaterThan(10)
  })

  test("na lanchonete o número do pedido recomeça no mês; nas outras é o id", () => {
    const agora = new Date(2026, 10, 2, 20, 30)
    const lanchonete = gerarPedidos({
      catalogo: catalogo(),
      segmento: "lanchonete",
      de: new Date(2026, 9, 29),
      agora,
    })
    const primeiroDeNovembro = lanchonete.find(
      (pedido) => new Date(pedido.criadoEm).getMonth() === 10,
    )
    expect(primeiroDeNovembro?.numero).toBe(1)
    expect(primeiroDeNovembro?.id).toBeGreaterThan(1)

    const pizzaria = gerarPedidos({
      catalogo: catalogo(),
      segmento: "pizzaria",
      de: new Date(2026, 9, 29),
      agora,
    })
    for (const pedido of pizzaria) expect(pedido.numero).toBe(pedido.id)
  })

  test("continua a numeração a partir do último pedido", () => {
    const pedidos = gerarPedidos({
      catalogo: catalogo(),
      segmento: "pizzaria",
      de: new Date(2026, 10, 13),
      agora: AGORA,
      ultimo: { id: 500, numero: 500 },
    })
    expect(pedidos[0].id).toBe(501)
  })

  test("no salão, os pedidos são agendamentos com hora marcada, alguns ainda por vir", () => {
    const pedidos = gerarPedidos({
      catalogo: catalogo(),
      segmento: "salao",
      de: new Date(2026, 10, 9),
      agora: AGORA,
    })

    expect(pedidos.length).toBeGreaterThan(0)
    for (const pedido of pedidos) {
      expect(pedido.tipo).toBe("atendimento")
      expect(pedido.endereco).toBeUndefined()
      expect(pedido.agendamento).toBeDefined()
    }
    const futuros = pedidos.filter(
      (pedido) => new Date(pedido.agendamento?.inicio ?? 0).getTime() > AGORA.getTime(),
    )
    expect(futuros.length).toBeGreaterThan(0)
    for (const pedido of futuros) expect(pedido.status).toBe("recebido")
  })
})

describe("agenda do salão gerada", () => {
  /** Como o Empório: terça a sábado, 9h às 19h, dois atendimentos ao mesmo tempo. */
  function salaoDeTeste() {
    const base = catalogo()
    base.loja.horarios = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
      dia,
      aberto: dia >= 2,
      abre: "09:00",
      fecha: "19:00",
    }))
    base.loja.capacidadeAtendimentos = 2
    base.produtos[0].duracaoMin = 90
    base.produtos[0].grupos = []
    base.produtos.push({ ...base.produtos[0], id: "prod-escova", nome: "Escova", duracaoMin: 30 })
    return base
  }

  const minutosDoDia = (data: Date) => data.getHours() * 60 + data.getMinutes()

  test("só em dia aberto, dentro do horário, com a duração somada e sem passar da capacidade", () => {
    const pedidos = gerarPedidos({
      catalogo: salaoDeTeste(),
      segmento: "salao",
      de: new Date(2026, 9, 1),
      agora: AGORA,
    })
    const validos = pedidos.filter((pedido) => pedido.status !== "cancelado")
    expect(validos.length).toBeGreaterThan(50)

    for (const pedido of validos) {
      const inicio = new Date(pedido.agendamento?.inicio ?? "")
      const duracao = pedido.agendamento?.duracaoMin ?? 0
      expect([0, 1]).not.toContain(inicio.getDay())
      expect(minutosDoDia(inicio)).toBeGreaterThanOrEqual(9 * 60)
      expect(minutosDoDia(inicio) + duracao).toBeLessThanOrEqual(19 * 60)
      const esperada = pedido.itens.reduce(
        (soma, item) => soma + (item.produtoId === "prod-escova" ? 30 : 90) * item.quantidade,
        0,
      )
      expect(duracao).toBe(esperada)
    }

    // Em cada início, quantos estão acontecendo: nunca mais que 2.
    const intervalo = (pedido: Pedido) => {
      const inicio = Date.parse(pedido.agendamento?.inicio ?? "")
      return [inicio, inicio + (pedido.agendamento?.duracaoMin ?? 0) * 60_000]
    }
    for (const pedido of validos) {
      const [momento] = intervalo(pedido)
      const juntos = validos.filter((outro) => {
        const [de, ate] = intervalo(outro)
        return de <= momento && ate > momento
      })
      expect(juntos.length).toBeLessThanOrEqual(2)
    }
  })

  test("a simulação marca o próximo horário livre do expediente", () => {
    const novo = gerarPedidoAgora({
      catalogo: salaoDeTeste(),
      segmento: "salao",
      agora: AGORA,
      agendamentos: [],
      semente: 3,
    })
    const inicio = new Date(novo.agendamento?.inicio ?? "")
    // Sexta às 20h30 o salão já fechou: o próximo é sábado, a partir das 9h.
    expect(inicio.getDay()).toBe(6)
    expect(minutosDoDia(inicio)).toBeGreaterThanOrEqual(9 * 60)
    expect(minutosDoDia(inicio) + (novo.agendamento?.duracaoMin ?? 0)).toBeLessThanOrEqual(19 * 60)
  })
})

describe("açougue gerado", () => {
  /** A lanchonete de teste vendendo por quilo e aceitando "pagar após a pesagem". */
  function acougueDeTeste() {
    const base = catalogo()
    base.produtos[0] = { ...base.produtos[0], unidade: "kg", preco: 60, grupos: [] }
    base.loja.pagamentos["pagar-apos-pesagem"] = true
    return base
  }
  const pedidos = gerarPedidos({
    catalogo: acougueDeTeste(),
    segmento: "acougue",
    de: new Date(2026, 9, 1),
    agora: AGORA,
  })

  test("item por quilo guarda o peso e o preço do quilo", () => {
    const porQuilo = pedidos.flatMap((pedido) => pedido.itens).filter((item) => item.pesoGramas)
    expect(porQuilo.length).toBeGreaterThan(0)
    for (const item of porQuilo) expect(item.precoKg).toBe(60)
  })

  test("retirada tem data de retirada, do dia do pedido a dois dias depois", () => {
    const retiradas = pedidos.filter((pedido) => pedido.tipo === "retirada")
    expect(retiradas.length).toBeGreaterThan(0)
    for (const pedido of retiradas) {
      const criado = new Date(pedido.criadoEm)
      const [ano, mes, dia] = (pedido.dataRetirada ?? "").split("-").map(Number)
      const dias = Math.round(
        (new Date(ano, mes - 1, dia).getTime() -
          new Date(criado.getFullYear(), criado.getMonth(), criado.getDate()).getTime()) /
          86_400_000,
      )
      expect([0, 1, 2]).toContain(dias)
    }
    expect(
      pedidos.filter((pedido) => pedido.tipo === "entrega").every((p) => !p.dataRetirada),
    ).toBe(true)
  })

  test("pagar após a pesagem: aberto fica pendente; concluído foi pesado e pago", () => {
    const aposPesagem = pedidos.filter((pedido) => pedido.pagamento === "pagar-apos-pesagem")
    expect(aposPesagem.length).toBeGreaterThan(0)
    for (const pedido of aposPesagem) {
      expect(pedido.itens.some((item) => item.pesoGramas)).toBe(true)
      if (pedido.status === "concluido") {
        expect(pedido.situacaoPagamento).toBe("pago")
        expect(pedido.pesagem).toBeDefined()
      } else if (pedido.status !== "cancelado") {
        expect(pedido.situacaoPagamento).toBe("pendente")
        expect(pedido.pesagem).toBeUndefined()
      }
    }
  })
})

describe("combos no pedido gerado", () => {
  test("a opção ligada a um produto vai junto no item, para sair do estoque", () => {
    const base = catalogo()
    base.produtos[0].grupos[0].itens[0].produtoId = "prod-bacon"
    const novo = gerarPedidoAgora({
      catalogo: base,
      segmento: "lanchonete",
      agora: AGORA,
      ultimo: { id: 1, numero: 1 },
      semente: 5,
    })
    // O grupo do Bacon é obrigatório: todo X-Burger leva a opção ligada.
    for (const item of novo.itens) expect(item.produtosDasOpcoes).toEqual(["prod-bacon"])
  })
})
