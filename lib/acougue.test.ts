import { describe, expect, test } from "vitest"
import { PESOS_EM_GRAMAS, precoDoPeso, rotuloDoPeso } from "./acougue"

describe("açougue", () => {
  test("os pesos que a pessoa escolhe, de 250 g a 3 kg", () => {
    expect(PESOS_EM_GRAMAS).toEqual([250, 500, 750, 1000, 1500, 2000, 3000])
  })

  test("o peso em texto curto", () => {
    expect(rotuloDoPeso(250)).toBe("250 g")
    expect(rotuloDoPeso(1000)).toBe("1 kg")
    expect(rotuloDoPeso(1500)).toBe("1,5 kg")
  })

  test("o preço estimado do peso, em centavos redondos", () => {
    expect(precoDoPeso(89.9, 500)).toBe(44.95)
    expect(precoDoPeso(52.9, 750)).toBe(39.68)
    expect(precoDoPeso(16.5, 3000)).toBe(49.5)
  })
})
