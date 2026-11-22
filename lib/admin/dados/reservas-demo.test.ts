import { describe, expect, test } from "vitest"
import { reservasDemo } from "./reservas-demo"
import { salaoDemo } from "./salao-demo"

const { mesas } = salaoDemo("pizzaria")
const hora = (h: number, m: number) => new Date(2026, 10, 13, h, m).toISOString()

describe("reservasDemo", () => {
  test("2 reservas de hoje: a da Marina na mesa 13 daqui a pouco, e a do Roberto sem mesa", () => {
    const { reservas } = reservasDemo(mesas, new Date(2026, 10, 13, 20, 30))
    expect(reservas).toEqual([
      {
        id: "reserva-20261113-1",
        nome: "Marina Costa",
        telefone: "12991234567",
        inicio: hora(20, 50),
        pessoas: 2,
        mesaId: "mesa-13",
        status: "marcada",
      },
      {
        id: "reserva-20261113-2",
        nome: "Roberto Andrade",
        telefone: "12997654321",
        inicio: hora(22, 30),
        pessoas: 6,
        status: "marcada",
      },
    ])
  })

  test("o horário arredonda para baixo: de 5 em 5 e de 15 em 15 minutos", () => {
    const { reservas } = reservasDemo(mesas, new Date(2026, 10, 13, 19, 44))
    expect(reservas.map((reserva) => reserva.inicio)).toEqual([hora(20, 0), hora(21, 30)])
  })

  test("3 pessoas na espera, chegadas há 25, 12 e 5 minutos; o Carlos foi chamado", () => {
    const { espera } = reservasDemo(mesas, new Date(2026, 10, 13, 20, 30))
    expect(espera).toEqual([
      {
        id: "espera-20261113-1",
        nome: "Carlos Mendes",
        pessoas: 2,
        telefone: "12998761234",
        chegouEm: hora(20, 5),
        chamadaEm: hora(20, 28),
        status: "esperando",
      },
      {
        id: "espera-20261113-2",
        nome: "Juliana Rocha",
        pessoas: 4,
        chegouEm: hora(20, 18),
        status: "esperando",
      },
      {
        id: "espera-20261113-3",
        nome: "Pedro Alves",
        pessoas: 5,
        telefone: "12996543210",
        chegouEm: hora(20, 25),
        status: "esperando",
      },
    ])
  })

  test("com a mesa 13 ocupada, bloqueada ou junta a outra, a reserva fica sem mesa", () => {
    for (const mudanca of [
      { status: "ocupada" as const },
      { bloqueio: {} },
      { juntadaCom: "mesa-12" },
    ]) {
      const comTreze = mesas.map((mesa) => (mesa.id === "mesa-13" ? { ...mesa, ...mudanca } : mesa))
      const [marina] = reservasDemo(comTreze, new Date(2026, 10, 13, 20, 30)).reservas
      expect(marina).not.toHaveProperty("mesaId")
    }
  })

  test("a reserva que cairia depois da meia-noite não entra", () => {
    const { reservas } = reservasDemo(mesas, new Date(2026, 10, 13, 23, 0))
    expect(reservas.map((reserva) => reserva.nome)).toEqual(["Marina Costa"])
  })
})
