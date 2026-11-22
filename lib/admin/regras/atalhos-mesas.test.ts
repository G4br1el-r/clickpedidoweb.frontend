import { describe, expect, it } from "vitest"
import { lerTecla } from "./atalhos-mesas"

const livre = { emCampo: false, comModificador: false, janelaAberta: false }
const tecla = (key: string, extra: Partial<typeof livre> = {}) => ({ key, ...livre, ...extra })

describe("lerTecla", () => {
  it("acumula dígitos e o Enter abre a mesa e zera o digitado", () => {
    const a = lerTecla("", tecla("1"))
    expect(a).toEqual({ digitado: "1", acao: { tipo: "nenhuma" } })
    const b = lerTecla(a.digitado, tecla("2"))
    expect(b).toEqual({ digitado: "12", acao: { tipo: "nenhuma" } })
    expect(lerTecla(b.digitado, tecla("Enter"))).toEqual({
      digitado: "",
      acao: { tipo: "abrir-mesa", numero: 12 },
    })
  })
})

describe("lerTecla: limites e comandos", () => {
  it("ignora o quarto dígito", () => {
    expect(lerTecla("123", tecla("4"))).toEqual({ digitado: "123", acao: { tipo: "nenhuma" } })
  })

  it("Enter sem dígitos não faz nada", () => {
    expect(lerTecla("", tecla("Enter"))).toEqual({ digitado: "", acao: { tipo: "nenhuma" } })
  })

  it("Escape zera os dígitos", () => {
    expect(lerTecla("12", tecla("Escape"))).toEqual({ digitado: "", acao: { tipo: "nenhuma" } })
  })

  it.each([
    ["/", { tipo: "buscar" }],
    ["n", { tipo: "nova-mesa" }],
    ["N", { tipo: "nova-mesa" }],
    ["?", { tipo: "ajuda" }],
    ["m", { tipo: "alternar-vista" }],
    ["M", { tipo: "alternar-vista" }],
  ])("%s dispara a ação e zera os dígitos", (key, acao) => {
    expect(lerTecla("12", tecla(key))).toEqual({ digitado: "", acao })
  })

  it.each([
    ["em campo", { emCampo: true }],
    ["com modificador", { comModificador: true }],
    ["com janela aberta", { janelaAberta: true }],
  ])("%s, nenhuma tecla faz nada e os dígitos ficam", (_nome, extra) => {
    for (const key of ["1", "Enter", "Escape", "/", "n", "N", "?", "m", "M"]) {
      expect(lerTecla("12", tecla(key, extra))).toEqual({
        digitado: "12",
        acao: { tipo: "nenhuma" },
      })
    }
  })

  it("outras teclas não fazem nada", () => {
    expect(lerTecla("12", tecla("a"))).toEqual({ digitado: "12", acao: { tipo: "nenhuma" } })
  })
})

describe("lerTecla: atalhos de uma tecla desligados (WCAG 2.1.4)", () => {
  it("nenhuma tecla de caractere faz nada, e o Enter não abre a mesa", () => {
    for (const key of ["1", "/", "n", "N", "?", "m", "M", "Enter"]) {
      expect(lerTecla("12", { ...tecla(key), ligados: false })).toEqual({
        digitado: "12",
        acao: { tipo: "nenhuma" },
      })
    }
  })

  it("o Escape ainda zera os dígitos", () => {
    expect(lerTecla("12", { ...tecla("Escape"), ligados: false })).toEqual({
      digitado: "",
      acao: { tipo: "nenhuma" },
    })
  })
})
