import { colord, extend } from "colord"
import a11yPlugin from "colord/plugins/a11y"
import { describe, expect, test } from "vitest"
import {
  corDaBarra,
  garantirContraste,
  temaParaCss,
  textoSobre,
  variaveisClaras,
  variaveisEscuras,
} from "./tema"

extend([a11yPlugin])

const TINTA = "#14202E"
const FUNDO = "#FBF8F2"
const MARCAS = ["#0B4F9C", "#D49419", "#F5C24D", "#C8321F", "#16A34A", "#FFFFFF", "#111318"]

describe("tema por cliente", () => {
  for (const marca of MARCAS) {
    test(`a cor ${marca} sempre gera botão legível`, () => {
      const texto = textoSobre(marca, TINTA)
      expect(colord(marca).contrast(texto)).toBeGreaterThanOrEqual(4.5)
    })

    test(`a cor ${marca} vira texto legível sobre o fundo`, () => {
      const texto = garantirContraste(marca, FUNDO, TINTA)
      expect(colord(texto).contrast(FUNDO)).toBeGreaterThanOrEqual(4.5)
    })
  }

  for (const [nome, gerar] of [
    ["claro", variaveisClaras],
    ["escuro", variaveisEscuras],
  ] as const) {
    for (const marca of MARCAS) {
      test(`no tema ${nome}, a marca ${marca} mantém todo texto legível`, () => {
        const v = gerar({ primaria: marca, acento: "#C8321F", fundo: FUNDO, tinta: TINTA })
        const pares = [
          ["--foreground", "--background"],
          ["--card-foreground", "--card"],
          ["--muted-foreground", "--muted"],
          ["--muted-foreground", "--background"],
          ["--muted-foreground", "--card"],
          ["--primary-foreground", "--primary"],
          ["--marca-texto", "--card"],
          ["--accent-foreground", "--accent"],
          ["--marca-acento-texto", "--card"],
        ] as const
        for (const [texto, fundo] of pares) {
          expect(
            colord(v[texto]).contrast(v[fundo]),
            `${texto} sobre ${fundo}`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }

  test("a barra do navegador usa a cor da marca no claro e o fundo escuro no escuro", () => {
    expect(
      corDaBarra({ primaria: "#0B4F9C", acento: "#C8321F", fundo: FUNDO, tinta: TINTA }),
    ).toEqual({ clara: "#0B4F9C", escura: "#0f151c" })
  })

  test("o CSS traz os dois temas", () => {
    const css = temaParaCss({ primaria: "#0B4F9C", acento: "#C8321F", fundo: FUNDO, tinta: TINTA })
    expect(css).toMatch(/^:root\{--background:/)
    expect(css).toContain(".dark{--background:")
  })
})
