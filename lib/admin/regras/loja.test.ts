import { describe, expect, test } from "vitest"
import { catalogoDeTeste } from "../dados/catalogo-de-teste"
import type { Bairro, HorarioFuncionamento, StatusPedido } from "../dados/tipos"
import {
  copiarParaTodos,
  entregasDoDia,
  lojaAbertaAgora,
  taxaDeEntrega,
  textoDoHorario,
  textoDoPrazo,
} from "./loja"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

/** 0 = domingo. */
function horarios(abertos: Record<number, [string, string]>): HorarioFuncionamento[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
    dia,
    aberto: dia in abertos,
    abre: abertos[dia]?.[0] ?? "18:00",
    fecha: abertos[dia]?.[1] ?? "23:00",
  }))
}

const loja = (mudanca: Partial<ReturnType<typeof catalogoDeTeste>["loja"]>) => ({
  ...catalogoDeTeste().loja,
  ...mudanca,
})

describe("lojaAbertaAgora", () => {
  // Sexta, 13/11/2026.
  const as = (dia: number, hora: number, minuto = 0) => new Date(2026, 10, dia, hora, minuto)

  test("no controle manual, vale a chave", () => {
    expect(lojaAbertaAgora(loja({ controleAutomatico: false, aberta: true }), as(13, 4))).toBe(true)
    expect(lojaAbertaAgora(loja({ controleAutomatico: false, aberta: false }), as(13, 20))).toBe(
      false,
    )
  })

  test("pelo horário: dentro, antes, no fechamento e em dia fechado", () => {
    const pelaHora = loja({
      controleAutomatico: true,
      aberta: false,
      horarios: horarios({ 5: ["18:00", "23:00"] }),
    })
    expect(lojaAbertaAgora(pelaHora, as(13, 18))).toBe(true)
    expect(lojaAbertaAgora(pelaHora, as(13, 17, 59))).toBe(false)
    expect(lojaAbertaAgora(pelaHora, as(13, 23))).toBe(false)
    expect(lojaAbertaAgora(pelaHora, as(14, 20))).toBe(false)
  })

  test("expediente que passa da meia-noite continua aberto na madrugada seguinte", () => {
    const madrugada = loja({
      controleAutomatico: true,
      horarios: horarios({ 5: ["18:00", "02:00"] }),
    })
    expect(lojaAbertaAgora(madrugada, as(13, 23, 30))).toBe(true)
    // Sábado de madrugada ainda é o expediente de sexta.
    expect(lojaAbertaAgora(madrugada, as(14, 1, 30))).toBe(true)
    expect(lojaAbertaAgora(madrugada, as(14, 2))).toBe(false)
    // Sexta de madrugada seria o expediente de quinta, que não abre.
    expect(lojaAbertaAgora(madrugada, as(13, 1))).toBe(false)
  })
})

describe("textoDoHorario", () => {
  test("agrupa dias seguidos com o mesmo horário", () => {
    expect(
      textoDoHorario(
        horarios({
          2: ["09:00", "19:00"],
          3: ["09:00", "19:00"],
          4: ["09:00", "19:00"],
          5: ["09:00", "19:00"],
          6: ["09:00", "19:00"],
        }),
      ),
    ).toBe("Terça a sábado, das 9h às 19h")
  })

  test("dois dias com e, horários diferentes separados e meia hora", () => {
    expect(
      textoDoHorario(
        horarios({
          5: ["18:00", "23:30"],
          6: ["18:00", "23:30"],
          0: ["11:00", "15:00"],
        }),
      ),
    ).toBe("Sexta e sábado, das 18h às 23h30; domingo, das 11h às 15h")
  })

  test("todos os dias e nenhum dia", () => {
    expect(
      textoDoHorario(
        horarios(Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((dia) => [dia, ["18:00", "23:00"]]))),
      ),
    ).toBe("Todos os dias, das 18h às 23h")
    expect(textoDoHorario(horarios({}))).toBe("Fechado")
  })
})

describe("copiarParaTodos", () => {
  test("os outros dias ficam iguais ao escolhido", () => {
    const copiados = copiarParaTodos(horarios({ 2: ["09:00", "19:00"] }), 2)
    expect(
      copiados.every((dia) => dia.aberto && dia.abre === "09:00" && dia.fecha === "19:00"),
    ).toBe(true)
    expect(copiados.map((dia) => dia.dia)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})

describe("entregasDoDia", () => {
  test("conta as entregas de cada motoboy no dia, as concluídas e as que estão na rua", () => {
    const base = PEDIDOS_DE_TESTE[2]
    const entrega = (id: number, motoboyId: string, status: StatusPedido, dia = 13) => ({
      ...base,
      id,
      tipo: "entrega" as const,
      status,
      motoboyId,
      criadoEm: new Date(2026, 10, dia, 19).toISOString(),
    })
    const pedidos = [
      entrega(1, "m1", "concluido"),
      entrega(2, "m1", "saiu-para-entrega"),
      entrega(3, "m1", "cancelado"),
      entrega(4, "m2", "concluido"),
      entrega(5, "m1", "concluido", 12),
    ]
    expect(Object.fromEntries(entregasDoDia(pedidos, new Date(2026, 10, 13, 20)))).toEqual({
      m1: 2,
      m2: 1,
    })
  })
})

describe("taxaDeEntrega", () => {
  const bairros: Bairro[] = [
    { id: "b1", cidade: "Cachoeira Paulista", nome: "Centro", taxa: 5, ativo: true },
    { id: "b2", cidade: "Cachoeira Paulista", nome: "Vila Carmem", taxa: 8, ativo: false },
  ]
  test("a do bairro ativo; senão, a padrão da loja", () => {
    expect(taxaDeEntrega(bairros, "b1", 10)).toBe(5)
    expect(taxaDeEntrega(bairros, "b2", 10)).toBe(10)
    expect(taxaDeEntrega(bairros, undefined, 10)).toBe(10)
  })
})

describe("textoDoPrazo", () => {
  test("de mínimo a máximo, ou um número só quando são iguais", () => {
    expect(textoDoPrazo({ min: 35, max: 50 })).toBe("35–50 min")
    expect(textoDoPrazo({ min: 15, max: 15 })).toBe("15 min")
  })
})
