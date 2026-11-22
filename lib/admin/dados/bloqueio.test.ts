import { expect, test } from "vitest"
import { exclusivo } from "./bloqueio"

test("uma chamada por vez, na ordem; a que falha não segura a próxima", async () => {
  const ordem: string[] = []
  let soltar = () => {}
  const primeira = exclusivo("base", async () => {
    ordem.push("primeira começa")
    await new Promise<void>((pronto) => (soltar = pronto))
    ordem.push("primeira acaba")
    throw new Error("Falhou")
  })
  const segunda = exclusivo("base", async () => {
    ordem.push("segunda")
    return 2
  })
  // Outra base não espera a vez desta.
  expect(await exclusivo("outra", async () => "outra")).toBe("outra")
  expect(ordem).toEqual(["primeira começa"])

  soltar()
  await expect(primeira).rejects.toThrow("Falhou")
  expect(await segunda).toBe(2)
  expect(ordem).toEqual(["primeira começa", "primeira acaba", "segunda"])
})
