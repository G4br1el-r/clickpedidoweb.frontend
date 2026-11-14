import { describe, expect, test } from "vitest"
import type { HorarioFuncionamento } from "./admin/dados/tipos"
import { diasParaAgendar, duracaoDaSacola, horariosParaAgendar, textoDoHorario } from "./agendar"

// Empório das Deusas: terça a sábado, das 9h às 19h.
const SALAO: HorarioFuncionamento[] = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
  dia,
  aberto: dia >= 2,
  abre: "09:00",
  fecha: "19:00",
}))

describe("agendar no salão", () => {
  test("a duração soma todos os serviços da sacola; sem duração, conta 60 min", () => {
    expect(
      duracaoDaSacola([
        { duracaoMin: 60, quantidade: 1 },
        { duracaoMin: 45, quantidade: 2 },
        { quantidade: 1 },
      ]),
    ).toBe(210)
  })

  test("os próximos dias em que o salão abre, a partir de hoje", () => {
    // Sexta, 13/11/2026, 20h30: hoje já fechou.
    const agora = new Date(2026, 10, 13, 20, 30)
    const dias = diasParaAgendar(SALAO, agora, 4).map((dia) => dia.toDateString())
    expect(dias).toEqual([
      new Date(2026, 10, 14).toDateString(),
      new Date(2026, 10, 17).toDateString(),
      new Date(2026, 10, 18).toDateString(),
      new Date(2026, 10, 19).toDateString(),
    ])
  })

  test("os horários do dia em que o serviço inteiro cabe, de meia em meia hora", () => {
    const agora = new Date(2026, 10, 14, 15, 10)
    const horas = horariosParaAgendar({
      dia: new Date(2026, 10, 14),
      duracaoMin: 120,
      horarios: SALAO,
      capacidade: 2,
      agora,
    }).map((inicio) => `${inicio.getHours()}:${String(inicio.getMinutes()).padStart(2, "0")}`)
    expect(horas).toEqual(["15:30", "16:00", "16:30", "17:00"])
  })
})

describe("textoDoHorario", () => {
  test("o dia por extenso e a hora do atendimento", () => {
    expect(textoDoHorario(new Date(2026, 10, 14, 10, 0).toISOString())).toBe(
      "sábado, 14/11, às 10:00",
    )
  })
})
