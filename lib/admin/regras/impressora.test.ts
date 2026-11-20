import { describe, expect, test } from "vitest"
import { situacaoDaImpressora, textoDaImpressora } from "./impressora"

describe("situacaoDaImpressora", () => {
  test("o navegador está sempre pronto; o agente depende de estar ligado; sem impressora, nada sai", () => {
    expect(situacaoDaImpressora({ impressora: "navegador", agenteLigado: false })).toBe("online")
    expect(situacaoDaImpressora({ impressora: "agente", agenteLigado: true })).toBe("online")
    expect(situacaoDaImpressora({ impressora: "agente", agenteLigado: false })).toBe("offline")
    expect(situacaoDaImpressora({ impressora: "nenhuma", agenteLigado: true })).toBe(
      "sem-impressora",
    )
  })

  test("o texto da barra", () => {
    expect(textoDaImpressora("online")).toBe("Impressora online")
    expect(textoDaImpressora("offline")).toBe("Impressora offline")
    expect(textoDaImpressora("sem-impressora")).toBe("Sem impressora")
  })
})
