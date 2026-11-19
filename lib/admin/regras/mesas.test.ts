import { describe, expect, test } from "vitest"
import type { Mesa, Pedido } from "../dados/tipos"
import { estadoDaMesa } from "./mesas"

const mesa = (status: Mesa["status"]) => ({ status }) as Mesa
const comanda = (status: Pedido["status"]) => ({ status }) as Pedido

describe("estadoDaMesa", () => {
  const agora = new Date("2026-11-19T19:40:00-03:00")

  test("mesa sem gente está livre e fica apagada", () => {
    expect(estadoDaMesa(mesa("livre"), undefined)).toEqual({
      estado: "livre",
      rotulo: "Livre",
      tom: "fim",
    })
  })

  test("com rodada nova ou em preparo, a mesa está esperando a cozinha", () => {
    expect(estadoDaMesa(mesa("ocupada"), comanda("recebido"))).toEqual({
      estado: "na-cozinha",
      rotulo: "Na cozinha",
      tom: "preparo",
    })
    expect(estadoDaMesa(mesa("ocupada"), comanda("em-preparo")).rotulo).toBe("Na cozinha")
  })

  test("ocupada com tudo servido, ou sem comanda ainda, é só ocupada", () => {
    expect(estadoDaMesa(mesa("ocupada"), comanda("pronto"))).toEqual({
      estado: "ocupada",
      rotulo: "Ocupada",
      tom: "caminho",
    })
    expect(estadoDaMesa(mesa("ocupada"), undefined).rotulo).toBe("Ocupada")
  })

  test("bloqueada vence tudo, até comanda aberta", () => {
    expect(estadoDaMesa({ status: "ocupada", bloqueio: {} }, { status: "recebido" })).toEqual({
      estado: "bloqueada",
      rotulo: "Bloqueada",
      tom: "cancelado",
    })
  })

  test("juntada mostra a principal", () => {
    expect(
      estadoDaMesa({ status: "ocupada", juntadaCom: "mesa-4" }, undefined, {
        principal: { numero: 4 },
      }),
    ).toEqual({ estado: "juntada", rotulo: "Com a mesa 4", tom: "caminho" })
  })

  test("juntada sem a principal conhecida diz só que está com outra mesa", () => {
    expect(estadoDaMesa({ status: "ocupada", juntadaCom: "mesa-4" }, undefined).rotulo).toBe(
      "Com outra mesa",
    )
  })

  test("pediu a conta vence servir e cozinha", () => {
    expect(
      estadoDaMesa(
        { status: "ocupada" },
        { status: "recebido", contaPedidaEm: "x", servirDesde: "y" },
      ),
    ).toMatchObject({ estado: "conta-pedida", rotulo: "Pediu a conta", tom: "novo" })
  })

  test("rodada pronta para servir", () => {
    expect(
      estadoDaMesa({ status: "ocupada" }, { status: "pronto", servirDesde: "y" }),
    ).toMatchObject({ estado: "servir", rotulo: "Servir", tom: "pronto" })
  })

  test("livre em limpeza", () => {
    expect(estadoDaMesa({ status: "livre", limpezaDesde: "x" }, undefined)).toMatchObject({
      estado: "limpeza",
      rotulo: "Limpeza",
      tom: "espera",
    })
  })

  test("reservada só a partir da antecedência", () => {
    const reserva = { inicio: "2026-11-19T20:00:00-03:00" }
    expect(
      estadoDaMesa({ status: "livre" }, undefined, { reserva, agora, antecedenciaMin: 30 }),
    ).toMatchObject({ estado: "reservada", rotulo: "Reservada 20:00", tom: "espera" })
    expect(
      estadoDaMesa({ status: "livre" }, undefined, { reserva, agora, antecedenciaMin: 15 }).estado,
    ).toBe("livre")
  })

  test("sem a antecedência informada, vale 30 minutos", () => {
    const dentro = { inicio: "2026-11-19T20:10:00-03:00" }
    expect(estadoDaMesa({ status: "livre" }, undefined, { reserva: dentro, agora }).estado).toBe(
      "reservada",
    )
    const longe = { inicio: "2026-11-19T20:11:00-03:00" }
    expect(estadoDaMesa({ status: "livre" }, undefined, { reserva: longe, agora }).estado).toBe(
      "livre",
    )
  })

  test("reserva sem o horário de agora não muda a mesa", () => {
    const reserva = { inicio: "2026-11-19T20:00:00-03:00" }
    expect(estadoDaMesa({ status: "livre" }, undefined, { reserva }).estado).toBe("livre")
  })

  test("limpeza vence reserva: a mesa precisa ser limpa antes", () => {
    const reserva = { inicio: "2026-11-19T20:00:00-03:00" }
    expect(
      estadoDaMesa({ status: "livre", limpezaDesde: "x" }, undefined, { reserva, agora }).estado,
    ).toBe("limpeza")
  })

  test("juntada vence conta pedida; servir vence cozinha", () => {
    expect(
      estadoDaMesa(
        { status: "ocupada", juntadaCom: "m" },
        { status: "recebido", contaPedidaEm: "x" },
        { principal: { numero: 2 } },
      ).estado,
    ).toBe("juntada")
    expect(
      estadoDaMesa({ status: "ocupada" }, { status: "em-preparo", servirDesde: "y" }).estado,
    ).toBe("servir")
  })
})

describe("estadoDaMesa com comanda residual em mesa livre", () => {
  test("mesa livre continua livre, mesmo com comanda que pediu a conta, a servir ou na cozinha", () => {
    const livre = { status: "livre" } as const
    expect(estadoDaMesa(livre, { status: "recebido", contaPedidaEm: "x" }).estado).toBe("livre")
    expect(estadoDaMesa(livre, { status: "pronto", servirDesde: "y" }).estado).toBe("livre")
    expect(estadoDaMesa(livre, { status: "recebido" }).estado).toBe("livre")
  })
})
