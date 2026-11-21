import { format } from "date-fns"
import { describe, expect, test } from "vitest"
import type { HorarioFuncionamento, Pedido, StatusPedido } from "../dados/tipos"
import {
  faixasDoDia,
  horariosLivres,
  listaDaAgenda,
  resumoDaAgenda,
  textoDosLembretes,
} from "./agenda"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

/** Empório: terça a sábado, das 9h às 19h; domingo e segunda fechado. */
const HORARIOS: HorarioFuncionamento[] = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
  dia,
  aberto: dia >= 2,
  abre: "09:00",
  fecha: "19:00",
}))

/** Sexta, 13/11/2026, 14:10. */
const AGORA = new Date(2026, 10, 13, 14, 10)
const SEXTA = new Date(2026, 10, 13)
const SABADO = new Date(2026, 10, 14)

const base = PEDIDOS_DE_TESTE[2]
function marcado(
  id: number,
  inicio: Date,
  duracaoMin: number,
  status: StatusPedido = "recebido",
): Pedido {
  return {
    ...base,
    id,
    numero: id,
    tipo: "atendimento",
    status,
    agendamento: { inicio: inicio.toISOString(), duracaoMin },
  }
}

const horas = (lista: Date[]) => lista.map((data) => format(data, "HH:mm"))

describe("horariosLivres", () => {
  test("de 30 em 30 min, terminando até o fechamento", () => {
    const livres = horariosLivres({
      dia: SABADO,
      duracaoMin: 90,
      agendamentos: [],
      horarios: HORARIOS,
      capacidade: 2,
      agora: AGORA,
    })
    expect(horas(livres).slice(0, 3)).toEqual(["09:00", "09:30", "10:00"])
    expect(horas(livres).at(-1)).toBe("17:30")
    expect(livres).toHaveLength(18)
  })

  test("hoje, só o que ainda não passou", () => {
    const livres = horariosLivres({
      dia: SEXTA,
      duracaoMin: 60,
      agendamentos: [],
      horarios: HORARIOS,
      capacidade: 2,
      agora: AGORA,
    })
    expect(horas(livres)).toEqual([
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
      "17:00",
      "17:30",
      "18:00",
    ])
  })

  test("dia fechado não tem horário", () => {
    const domingo = new Date(2026, 10, 15)
    expect(
      horariosLivres({
        dia: domingo,
        duracaoMin: 60,
        agendamentos: [],
        horarios: HORARIOS,
        capacidade: 2,
        agora: AGORA,
      }),
    ).toEqual([])
  })

  test("horário cheio some; cancelado não ocupa; o próprio agendamento não conta", () => {
    const as = (hora: number, minuto = 0) => new Date(2026, 10, 14, hora, minuto)
    const agendamentos = [
      marcado(1, as(10), 60),
      marcado(2, as(10, 30), 60),
      marcado(3, as(10), 120, "cancelado"),
    ]
    const livres = (ignorarId?: number) =>
      horas(
        horariosLivres({
          dia: SABADO,
          duracaoMin: 60,
          agendamentos,
          horarios: HORARIOS,
          capacidade: 2,
          agora: AGORA,
          ...(ignorarId ? { ignorarId } : {}),
        }),
      ).filter((hora) => hora < "12:00")
    // Das 10h30 às 11h há dois ao mesmo tempo: nada que passe por esse trecho cabe.
    expect(livres()).toEqual(["09:00", "09:30", "11:00", "11:30"])
    expect(livres(2)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"])
  })
})

const no = (dia: number, hora: number, minuto = 0) => new Date(2026, 10, dia, hora, minuto)

describe("faixasDoDia", () => {
  test("quem se cruza fica lado a lado; quem está sozinho ocupa a largura toda", () => {
    const faixas = faixasDoDia([
      marcado(1, no(14, 9), 60),
      marcado(2, no(14, 9, 30), 60),
      marcado(3, no(14, 10), 60),
      marcado(4, no(14, 14), 60),
    ])
    expect(Object.fromEntries(faixas)).toEqual({
      1: { faixa: 0, faixas: 2 },
      2: { faixa: 1, faixas: 2 },
      // Começa quando o 1 termina: volta para a primeira faixa.
      3: { faixa: 0, faixas: 2 },
      4: { faixa: 0, faixas: 1 },
    })
  })
})

describe("resumoDaAgenda", () => {
  test("hoje, amanhã e os próximos 7 dias, pelo dia do atendimento e sem cancelados", () => {
    const comTotal = (pedido: Pedido, total: number) => ({ ...pedido, total })
    const agenda = [
      comTotal(marcado(1, no(13, 9), 60, "concluido"), 100),
      comTotal(marcado(2, no(13, 16), 60), 50),
      comTotal(marcado(3, no(13, 17), 60, "cancelado"), 999),
      comTotal(marcado(4, no(14, 10), 90), 80),
      comTotal(marcado(5, no(19, 10), 60), 40),
      comTotal(marcado(6, no(20, 10), 60), 999),
      // Pedido feito hoje para daqui a uma semana: conta pelo dia do atendimento.
      { ...comTotal(marcado(7, no(25, 10), 60), 999), criadoEm: no(13, 8).toISOString() },
    ]
    expect(resumoDaAgenda(agenda, AGORA)).toEqual({
      hoje: { quantidade: 2, total: 150 },
      amanha: { quantidade: 1, total: 80 },
      semana: { quantidade: 4, total: 270 },
    })
  })
})

describe("listaDaAgenda", () => {
  const agenda = [
    { ...marcado(1, no(14, 15), 60), cliente: { nome: "Bruna Alves", telefone: "12991110000" } },
    { ...marcado(2, no(13, 16), 60, "em-preparo"), cliente: { nome: "Carla", telefone: "12" } },
    { ...marcado(3, no(20, 10), 60), cliente: { nome: "Bruna Lima", telefone: "12" } },
    // Pedido do site sem agendamento não entra na agenda.
    { ...base, id: 4, numero: 4 },
  ]

  test("pela hora do atendimento, dentro do período", () => {
    const ids = listaDaAgenda(agenda, { de: no(13, 0), ate: no(14, 0) }).map((item) => item.id)
    expect(ids).toEqual([2, 1])
  })

  test("busca por cliente, telefone ou serviço e filtra por status", () => {
    const busca = (filtro: Parameters<typeof listaDaAgenda>[1]) =>
      listaDaAgenda(agenda, filtro).map((item) => item.id)
    expect(busca({ busca: "bruna" })).toEqual([1, 3])
    expect(busca({ busca: "9111" })).toEqual([1])
    expect(busca({ status: ["em-preparo"] })).toEqual([2])
  })
})

describe("textoDosLembretes", () => {
  const marcado = (inicio: Date, criadoEm: Date): Pedido => ({
    ...PEDIDOS_DE_TESTE[2],
    tipo: "atendimento",
    status: "recebido",
    criadoEm: criadoEm.toISOString(),
    agendamento: { inicio: inicio.toISOString(), duracaoMin: 60 },
  })

  test("véspera às 18h e 1 h antes: o que já passou foi enviado; o que falta diz a hora", () => {
    const amanha = marcado(new Date(2026, 10, 14, 10, 0), new Date(2026, 10, 10, 9, 0))
    expect(textoDosLembretes(amanha, new Date(2026, 10, 13, 20, 30))).toBe(
      "Lembretes: véspera enviado · 1 h antes às 09:00",
    )
    expect(textoDosLembretes(amanha, new Date(2026, 10, 14, 9, 30))).toBe(
      "Lembretes: véspera enviado · 1 h antes enviado",
    )
  })

  test("marcado depois da hora do lembrete, aquele não sai; sem nenhum, não diz nada", () => {
    const deHoje = marcado(new Date(2026, 10, 13, 21, 0), new Date(2026, 10, 13, 19, 0))
    expect(textoDosLembretes(deHoje, new Date(2026, 10, 13, 19, 30))).toBe(
      "Lembretes: 1 h antes às 20:00",
    )
    const emCimaDaHora = marcado(new Date(2026, 10, 13, 20, 0), new Date(2026, 10, 13, 19, 30))
    expect(textoDosLembretes(emCimaDaHora, new Date(2026, 10, 13, 19, 40))).toBeNull()
  })
})
