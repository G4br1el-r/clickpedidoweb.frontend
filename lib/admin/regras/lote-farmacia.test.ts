import { describe, expect, it } from "vitest"
import type { DadosMedicamento, Lote, Produto, Receita } from "../dados/tipos"
import {
  destinoDoLote,
  divisaoDosLotes,
  notaDasReceitas,
  notaDosLotes,
  planoDeAprovacao,
  retidaNaAprovacao,
  textoDaDecisao,
  textoDasReceitas,
  textoDoDestino,
  textoDosLotes,
} from "./lote-farmacia"

const AGORA = new Date(2026, 10, 13, 20, 30)

function lote(id: string, validade: string, quantidade = 10, minimo = 2): Lote {
  return { id, produtoId: "p", codigo: id.toUpperCase(), validade, quantidade, minimo }
}

describe("destinoDoLote", () => {
  it("vencido vai para o descarte", () => {
    expect(destinoDoLote("vencido")).toBe("descarte")
  })

  it("vence em 30 dias volta para o distribuidor", () => {
    expect(destinoDoLote("vence-em-30")).toBe("devolucao")
  })

  it("o resto ainda não pede nada", () => {
    expect(destinoDoLote("vence-em-90")).toBeNull()
    expect(destinoDoLote("em-dia")).toBeNull()
  })
})

describe("divisaoDosLotes", () => {
  it("separa o que descarta, o que devolve e o que não tem destino", () => {
    const { descartar, devolver, semDestino } = divisaoDosLotes(
      [
        lote("a", "2026-11-07"),
        lote("b", "2026-12-10"),
        lote("c", "2027-06-01"),
        lote("d", "2026-11-13"),
      ],
      AGORA,
    )
    expect(descartar.map((item) => item.id)).toEqual(["a"])
    expect(devolver.map((item) => item.id)).toEqual(["b", "d"])
    expect(semDestino.map((item) => item.id)).toEqual(["c"])
  })

  it("lote vazio não tem nada para tratar", () => {
    expect(divisaoDosLotes([], AGORA)).toEqual({ descartar: [], devolver: [], semDestino: [] })
  })
})

describe("textoDosLotes", () => {
  it("um lote", () => {
    expect(textoDosLotes(1)).toBe("1 lote selecionado")
  })

  it("vários lotes", () => {
    expect(textoDosLotes(3)).toBe("3 lotes selecionados")
  })
})

describe("textoDasReceitas", () => {
  it("uma receita", () => {
    expect(textoDasReceitas(1)).toBe("1 receita selecionada")
  })

  it("várias receitas", () => {
    expect(textoDasReceitas(2)).toBe("2 receitas selecionadas")
  })
})

const medicamento = (dados: Partial<DadosMedicamento>): DadosMedicamento => ({
  tarja: "vermelha",
  tipo: "generico",
  principioAtivo: "x",
  apresentacao: "x",
  laboratorio: "x",
  registroMs: "1",
  ...dados,
})

const produtos: Produto[] = [
  {
    id: "amox",
    nome: "Amoxicilina",
    medicamento: medicamento({ tarja: "vermelha-retencao", lista: "antimicrobiano" }),
  },
  { id: "losartana", nome: "Losartana", medicamento: medicamento({}) },
] as Produto[]

function receita(id: string, tipo: Receita["tipo"], produtoId: string, emitidaEm: string) {
  return {
    id,
    tipo,
    emitidaEm,
    itens: [{ produtoId, quantidade: 1, posologia: "" }],
    prescritor: { nome: "Dr. X", conselho: "CRM", numero: "143278", uf: "SP" },
  } as Receita
}

describe("planoDeAprovacao", () => {
  const boa = receita("r1", "antimicrobiano", "amox", "2026-11-11")
  const simples = receita("r2", "simples", "losartana", "2026-11-12")
  const vencida = receita("r3", "antimicrobiano", "amox", "2026-10-01")

  it("só aprova as que não têm pendência", () => {
    const plano = planoDeAprovacao([boa, simples, vencida], produtos, AGORA)
    expect(plano.aprovaveis.map((item) => item.id)).toEqual(["r1", "r2"])
    expect(plano.comPendencia.map((item) => item.id)).toEqual(["r3"])
  })

  it("conta as que pedem a via retida", () => {
    expect(planoDeAprovacao([boa, simples], produtos, AGORA).comRetencao).toBe(1)
    expect(planoDeAprovacao([simples], produtos, AGORA).comRetencao).toBe(0)
  })

  it("receita com pendência não conta como retenção", () => {
    expect(planoDeAprovacao([vencida], produtos, AGORA).comRetencao).toBe(0)
  })
})

describe("retidaNaAprovacao", () => {
  it("só marca a via como retida quando o tipo exige e a pessoa confirmou", () => {
    const retem = receita("r1", "antimicrobiano", "amox", "2026-11-11")
    const livre = receita("r2", "simples", "losartana", "2026-11-11")
    expect(retidaNaAprovacao(retem, true)).toBe(true)
    expect(retidaNaAprovacao(retem, false)).toBe(false)
    expect(retidaNaAprovacao(livre, true)).toBe(false)
  })
})

describe("textos do resultado", () => {
  it("lotes separados para descarte", () => {
    expect(textoDoDestino("descarte", 1)).toBe("1 lote separado para descarte.")
    expect(textoDoDestino("descarte", 2)).toBe("2 lotes separados para descarte.")
  })

  it("lotes separados para devolução", () => {
    expect(textoDoDestino("devolucao", 4)).toBe("4 lotes separados para devolução.")
  })

  it("receitas aprovadas e recusadas", () => {
    expect(textoDaDecisao("aprovada", 1)).toBe("1 receita aprovada.")
    expect(textoDaDecisao("aprovada", 2)).toBe("2 receitas aprovadas.")
    expect(textoDaDecisao("recusada", 2)).toBe("2 receitas recusadas.")
  })
})

describe("notas da barra em lote", () => {
  it("lotes sem ação", () => {
    expect(notaDosLotes(0)).toBeUndefined()
    expect(notaDosLotes(1)).toBe("1 sem ação: fica como está")
    expect(notaDosLotes(3)).toBe("3 sem ação: ficam como estão")
  })

  it("receitas com pendência", () => {
    expect(notaDasReceitas(0)).toBeUndefined()
    expect(notaDasReceitas(1)).toBe("1 com pendência: fica de fora")
    expect(notaDasReceitas(2)).toBe("2 com pendência: ficam de fora")
  })
})
