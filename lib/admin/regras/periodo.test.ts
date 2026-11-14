import { describe, expect, test } from "vitest"
import { normalizarPeriodo, periodoAnterior, periodoDoAtalho } from "./periodo"

/** Sexta, 13/11/2026, 20:30. */
const AGORA = new Date(2026, 10, 13, 20, 30)
const dia = (data: Date) => data.toLocaleDateString("pt-BR")

describe("periodoDoAtalho", () => {
  test("cada atalho vira um intervalo de dias que termina hoje", () => {
    const casos = {
      hoje: ["13/11/2026", "13/11/2026"],
      ontem: ["12/11/2026", "12/11/2026"],
      "7d": ["07/11/2026", "13/11/2026"],
      "15d": ["30/10/2026", "13/11/2026"],
      "30d": ["15/10/2026", "13/11/2026"],
      mes: ["01/11/2026", "13/11/2026"],
    } as const
    for (const [atalho, [de, ate]] of Object.entries(casos)) {
      const periodo = periodoDoAtalho(atalho as keyof typeof casos, AGORA)
      expect([dia(periodo.de), dia(periodo.ate)]).toEqual([de, ate])
    }
  })
})

describe("periodoAnterior", () => {
  test("tem o mesmo tamanho e termina na véspera", () => {
    const anterior = periodoAnterior(periodoDoAtalho("7d", AGORA))
    expect([dia(anterior.de), dia(anterior.ate)]).toEqual(["31/10/2026", "06/11/2026"])
  })
})

describe("normalizarPeriodo", () => {
  test("sem datas, são os últimos 7 dias", () => {
    const periodo = normalizarPeriodo({}, AGORA)
    expect([dia(periodo.de), dia(periodo.ate)]).toEqual(["07/11/2026", "13/11/2026"])
    expect(periodo.atalho).toBe("7d")
  })

  test("lê as datas do endereço e reconhece o atalho", () => {
    const periodo = normalizarPeriodo({ de: "2026-11-01", ate: "2026-11-13" }, AGORA)
    expect([dia(periodo.de), dia(periodo.ate)]).toEqual(["01/11/2026", "13/11/2026"])
    expect(periodo.atalho).toBe("mes")

    const livre = normalizarPeriodo({ de: "2026-11-02", ate: "2026-11-05" }, AGORA)
    expect(livre.atalho).toBeUndefined()
  })

  test("datas inválidas ou invertidas voltam aos últimos 7 dias", () => {
    for (const datas of [
      { de: "ontem", ate: "2026-11-13" },
      { de: "2026-11-10", ate: "2026-11-02" },
    ]) {
      expect(dia(normalizarPeriodo(datas, AGORA).de)).toBe("07/11/2026")
    }
  })

  test("não passa de hoje nem de 90 dias", () => {
    const futuro = normalizarPeriodo({ de: "2026-11-10", ate: "2026-12-25" }, AGORA)
    expect(dia(futuro.ate)).toBe("13/11/2026")

    const longo = normalizarPeriodo({ de: "2026-01-01", ate: "2026-11-13" }, AGORA)
    expect([dia(longo.de), dia(longo.ate)]).toEqual(["16/08/2026", "13/11/2026"])
  })
})
