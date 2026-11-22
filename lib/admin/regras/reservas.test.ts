import { describe, expect, test } from "vitest"
import type { Reserva } from "../dados/tipos"
import {
  chamadaPeloWhatsApp,
  conferirEspera,
  conferirReserva,
  type MesaParaSugerir,
  porQueNaoSenta,
  reservaDaMesa,
  reservaEmConflito,
  statusDaReserva,
  sugerirMesa,
  sugestoesDaEspera,
} from "./reservas"

const CONFIG = { antecedenciaMin: 30, toleranciaMin: 15 }
/** Sexta, 13/11/2026, no horário de São Paulo. */
const as = (hora: string) => new Date(`2026-11-13T${hora}:00-03:00`)

const reserva = (mudanca: Partial<Reserva> = {}): Reserva => ({
  id: "r1",
  nome: "Marina Costa",
  inicio: as("20:50").toISOString(),
  pessoas: 2,
  mesaId: "mesa-13",
  status: "marcada",
  ...mudanca,
})

describe("reservaDaMesa", () => {
  test("vale da antecedência até a tolerância", () => {
    const mesa = { id: "mesa-13" }
    expect(reservaDaMesa(mesa, [reserva()], as("20:30"), CONFIG)?.id).toBe("r1")
    expect(reservaDaMesa(mesa, [reserva()], as("21:05"), CONFIG)?.id).toBe("r1")
    expect(reservaDaMesa(mesa, [reserva()], as("20:19"), CONFIG)).toBeUndefined()
    expect(reservaDaMesa(mesa, [reserva()], as("21:06"), CONFIG)).toBeUndefined()
  })

  test("às 20:20 em ponto, a antecedência de 30 min já vale", () => {
    expect(reservaDaMesa({ id: "mesa-13" }, [reserva()], as("20:20"), CONFIG)?.id).toBe("r1")
  })
})

describe("reservaDaMesa: quem conta", () => {
  test("a de outra mesa, a cancelada e a que sentou não seguram a mesa", () => {
    const mesa = { id: "mesa-13" }
    const outras = [
      reserva({ mesaId: "mesa-12" }),
      reserva({ status: "cancelada" }),
      reserva({ status: "sentou" }),
    ]
    expect(reservaDaMesa(mesa, outras, as("20:30"), CONFIG)).toBeUndefined()
  })

  test("com duas na janela, vale a mais cedo", () => {
    const duas = [
      reserva({ id: "tarde", inicio: as("20:55").toISOString() }),
      reserva({ id: "cedo", inicio: as("20:45").toISOString() }),
    ]
    expect(reservaDaMesa({ id: "mesa-13" }, duas, as("20:30"), CONFIG)?.id).toBe("cedo")
  })
})

describe("statusDaReserva", () => {
  test("a marcada vira não compareceu depois da tolerância", () => {
    const dasDez = reserva({ inicio: as("20:10").toISOString() })
    expect(statusDaReserva(dasDez, as("20:25"), CONFIG)).toBe("marcada")
    expect(statusDaReserva(dasDez, as("20:26"), CONFIG)).toBe("nao-compareceu")
  })

  test("as gravadas voltam como estão", () => {
    const antiga = { inicio: as("18:00").toISOString() }
    expect(statusDaReserva(reserva({ ...antiga, status: "sentou" }), as("20:30"), CONFIG)).toBe(
      "sentou",
    )
    expect(statusDaReserva(reserva({ ...antiga, status: "cancelada" }), as("20:30"), CONFIG)).toBe(
      "cancelada",
    )
  })
})

describe("reservaEmConflito", () => {
  const agora = as("20:30")
  test("outra reserva ativa na mesma mesa a menos de 2 h conflita", () => {
    const outra = reserva({ id: "outra", inicio: as("22:00").toISOString() })
    expect(reservaEmConflito("mesa-13", as("20:50"), [outra], agora, CONFIG)?.id).toBe("outra")
    const longe = reserva({ id: "longe", inicio: as("22:50").toISOString() })
    expect(reservaEmConflito("mesa-13", as("20:50"), [longe], agora, CONFIG)).toBeUndefined()
  })

  test("a da mesa vizinha, a ignorada e a vencida não conflitam", () => {
    const reservas = [
      reserva({ id: "vizinha", mesaId: "mesa-12" }),
      reserva({ id: "ela-mesma" }),
      reserva({ id: "vencida", inicio: as("20:10").toISOString() }),
    ]
    expect(
      reservaEmConflito("mesa-13", as("20:50"), reservas, agora, CONFIG, "ela-mesma"),
    ).toBeUndefined()
  })
})

const mesa = (numero: number, lugares: number, mudanca: Partial<MesaParaSugerir> = {}) => ({
  id: `mesa-${numero}`,
  numero,
  lugares,
  status: "livre" as const,
  ...mudanca,
})

describe("sugerirMesa", () => {
  const agora = as("20:30")
  const quando = { agora, config: CONFIG }

  test("a menor mesa que cabe, desempatada pelo número", () => {
    const mesas = [mesa(9, 8), mesa(7, 4), mesa(2, 2), mesa(5, 4)]
    expect(sugerirMesa(3, mesas, [], quando)?.numero).toBe(5)
  })

  test("agora, pula a bloqueada, a juntada, a ocupada e a em limpeza", () => {
    const mesas = [
      mesa(1, 4, { bloqueio: {} }),
      mesa(2, 4, { juntadaCom: "mesa-9" }),
      mesa(3, 4, { status: "ocupada" }),
      mesa(4, 4, { limpezaDesde: as("20:20").toISOString() }),
      mesa(5, 4),
    ]
    expect(sugerirMesa(2, mesas, [], quando)?.numero).toBe(5)
  })

  test("para mais tarde, a ocupada e a em limpeza agora entram", () => {
    const mesas = [mesa(3, 4, { status: "ocupada" }), mesa(4, 4, { limpezaDesde: "x" })]
    expect(sugerirMesa(2, mesas, [], { ...quando, inicio: as("22:30") })?.numero).toBe(3)
  })

  test("para mais tarde, a em limpeza agora é a menor e fica com a reserva", () => {
    const mesas = [mesa(5, 4), mesa(4, 4, { limpezaDesde: as("20:20").toISOString() })]
    expect(sugerirMesa(2, mesas, [], { ...quando, inicio: as("22:30") })?.numero).toBe(4)
  })

  test("a reserva da hora deixa a mesa de fora; a de outra hora, não", () => {
    const mesas = [mesa(3, 4), mesa(4, 4)]
    const daTres = [reserva({ mesaId: "mesa-3", inicio: as("20:50").toISOString() })]
    expect(sugerirMesa(2, mesas, daTres, quando)?.numero).toBe(4)
    expect(sugerirMesa(2, mesas, daTres, { ...quando, inicio: as("23:00") })?.numero).toBe(3)
    // Editando a própria reserva, a mesa dela continua valendo.
    expect(
      sugerirMesa(2, mesas, daTres, { ...quando, inicio: as("21:00"), ignorar: "r1" })?.numero,
    ).toBe(3)
  })

  test("sem mesa que caiba, nada", () => {
    expect(sugerirMesa(10, [mesa(1, 8)], [], quando)).toBeUndefined()
  })
})

describe("porQueNaoSenta", () => {
  const mesas = [
    mesa(13, 2),
    mesa(14, 2, { limpezaDesde: as("20:20").toISOString() }),
    mesa(20, 4, { bloqueio: {} }),
    mesa(30, 4, { status: "ocupada" }),
    mesa(31, 4, { status: "ocupada", juntadaCom: "mesa-30" }),
  ]

  test("a livre e a em limpeza recebem quem senta", () => {
    expect(porQueNaoSenta("mesa-13", mesas)).toBeUndefined()
    expect(porQueNaoSenta("mesa-14", mesas)).toBeUndefined()
  })

  test("a bloqueada, a juntada, a ocupada e a que não existe mais dizem o porquê", () => {
    expect(porQueNaoSenta("mesa-20", mesas)).toBe("A mesa 20 está bloqueada.")
    expect(porQueNaoSenta("mesa-31", mesas)).toBe("A mesa 31 está junto com a mesa 30.")
    expect(porQueNaoSenta("mesa-30", mesas)).toBe("A mesa 30 está ocupada.")
    expect(porQueNaoSenta("mesa-99", mesas)).toBe("A mesa da reserva foi excluída.")
  })
})

describe("sugestoesDaEspera", () => {
  test("cada um, na ordem da chegada, fica com a menor que cabe entre as que sobraram", () => {
    const entrada = (id: string, pessoas: number, chegouEm: string) => ({
      id,
      nome: id,
      pessoas,
      chegouEm: as(chegouEm).toISOString(),
      status: "esperando" as const,
    })
    const espera = [
      entrada("pedro", 5, "20:25"),
      entrada("carlos", 2, "20:05"),
      entrada("juliana", 4, "20:18"),
      entrada("ana", 12, "20:26"),
    ]
    const mesas = [mesa(11, 2), mesa(8, 4), mesa(10, 8), mesa(12, 2)]
    const sugestoes = sugestoesDaEspera(espera, mesas, [], { agora: as("20:30"), config: CONFIG })
    expect(Object.fromEntries([...sugestoes].map(([id, m]) => [id, m.numero]))).toEqual({
      carlos: 11,
      juliana: 8,
      pedro: 10,
    })
  })

  test("duas pessoas disputando a mesma mesa: fica com quem chegou antes", () => {
    const entrada = (id: string, chegouEm: string) => ({
      id,
      nome: id,
      pessoas: 2,
      chegouEm: as(chegouEm).toISOString(),
      status: "esperando" as const,
    })
    const espera = [entrada("depois", "20:20"), entrada("antes", "20:10")]
    const sugestoes = sugestoesDaEspera(espera, [mesa(11, 2)], [], {
      agora: as("20:30"),
      config: CONFIG,
    })
    expect(Object.fromEntries([...sugestoes].map(([id, m]) => [id, m.numero]))).toEqual({
      antes: 11,
    })
  })
})

test("chamadaPeloWhatsApp abre a conversa com a mensagem pronta", () => {
  expect(chamadaPeloWhatsApp("(12) 99123-4567", "Pizzaria Bella")).toBe(
    "https://wa.me/5512991234567?text=Ol%C3%A1!%20Sua%20mesa%20na%20Pizzaria%20Bella%20est%C3%A1%20pronta.%20Pode%20vir%2C%20estamos%20te%20esperando.",
  )
})

describe("conferirReserva", () => {
  const agora = as("20:30")
  const certo = {
    nome: " Marina Costa ",
    telefone: "(12) 99123-4567",
    horario: "20:50",
    pessoas: "2",
  }

  test("o certo devolve a reserva de hoje, com o telefone só com dígitos", () => {
    expect(conferirReserva(certo, agora)).toEqual({
      erros: {},
      reserva: {
        nome: "Marina Costa",
        telefone: "12991234567",
        inicio: "2026-11-13T23:50:00.000Z",
        pessoas: 2,
      },
    })
  })

  test("cada campo errado diz o que falta", () => {
    expect(
      conferirReserva({ nome: " ", telefone: "123456789", horario: "", pessoas: "0" }, agora).erros,
    ).toEqual({
      nome: "Informe o nome.",
      telefone: "Informe o telefone com DDD.",
      horario: "Informe o horário.",
      pessoas: "Informe de 1 a 99 pessoas.",
    })
  })

  test("horário que já passou recusa; o minuto de agora vale", () => {
    expect(conferirReserva({ ...certo, horario: "20:29" }, agora).erros).toEqual({
      horario: "Esse horário já passou.",
    })
    expect(conferirReserva({ ...certo, horario: "20:30" }, as("20:30")).erros).toEqual({})
  })

  test("no meio do minuto, o minuto de agora ainda vale", () => {
    const meioMinuto = new Date("2026-11-13T20:30:45-03:00")
    expect(conferirReserva({ ...certo, horario: "20:30" }, meioMinuto).erros).toEqual({})
  })

  test("hora fora de 00 a 23 ou minuto fora de 00 a 59 não é horário", () => {
    for (const horario of ["23:99", "24:00", "25:10", "21:60"]) {
      expect(conferirReserva({ ...certo, horario }, agora).erros).toEqual({
        horario: "Informe o horário.",
      })
    }
  })

  test("sem telefone, a reserva vai sem ele", () => {
    expect(conferirReserva({ ...certo, telefone: "" }, agora).reserva).not.toHaveProperty(
      "telefone",
    )
  })
})

describe("conferirEspera", () => {
  test("o certo devolve os dados limpos", () => {
    expect(conferirEspera({ nome: " Juliana ", telefone: "", pessoas: "4" })).toEqual({
      erros: {},
      entrada: { nome: "Juliana", pessoas: 4 },
    })
  })

  test("cada campo errado diz o que falta", () => {
    expect(conferirEspera({ nome: "", telefone: "12345", pessoas: "100" }).erros).toEqual({
      nome: "Informe o nome.",
      telefone: "Informe o telefone com DDD.",
      pessoas: "Informe de 1 a 99 pessoas.",
    })
  })
})
