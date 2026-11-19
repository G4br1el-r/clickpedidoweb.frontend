import { format, isSameDay } from "date-fns"
import { describe, expect, test } from "vitest"
import { diferencaDinheiro, errosDoFechamento, resumoDoTurno } from "@/lib/admin/regras/caixa"
import { catalogoDeTeste as catalogo } from "./catalogo-de-teste"
import { EQUIPE_DEMO } from "./equipe-demo"
import { gerarPedidos } from "./gerar-pedidos"
import { gerarTurnos } from "./gerar-turnos"

/** Sexta, 13/11/2026, 20:30 em São Paulo (o fuso dos testes). */
const AGORA = new Date(2026, 10, 13, 20, 30)
const pedidos = gerarPedidos({
  catalogo: catalogo(),
  segmento: "pizzaria",
  de: new Date(2026, 9, 14),
  agora: AGORA,
})
const gerado = gerarTurnos({ pedidos, agora: AGORA })
const doPdv = gerado.pedidos.filter((pedido) => pedido.origem === "pdv")

describe("gerarTurnos", () => {
  test("a equipe de demonstração", () => {
    expect(
      EQUIPE_DEMO.map(({ id, nome, perfil, pin, ativo }) => [id, nome, perfil, pin, ativo]),
    ).toEqual([
      ["eq-dono", "Carla N.", "dono", "1234", true],
      ["eq-gerente", "Rafael M.", "gerente", "2580", true],
      ["eq-marina", "Marina S.", "caixa", "1111", true],
      ["eq-joao", "João P.", "caixa", "2222", true],
    ])
  })

  test("mesmo dia gera os mesmos turnos", () => {
    expect(gerarTurnos({ pedidos, agora: AGORA })).toEqual(gerado)
  })

  test("um turno por dia com venda do PDV, Marina nos dias pares e João nos ímpares", () => {
    const dias = new Set(doPdv.map((pedido) => format(new Date(pedido.criadoEm), "yyyyMMdd")))
    expect(dias.size).toBeGreaterThan(10)
    expect(gerado.turnos.map((turno) => turno.id).sort()).toEqual(
      [...dias].sort().map((dia) => `turno-${dia}`),
    )
    for (const turno of gerado.turnos) {
      const par = Number(turno.id.slice(-2)) % 2 === 0
      expect(turno.abertoPor).toBe(par ? "eq-marina" : "eq-joao")
      expect(turno.fundo).toBe(100)
    }
  })

  test("todo pedido do PDV de dias anteriores pertence a um turno fechado", () => {
    expect(doPdv.length).toBeGreaterThan(0)
    for (const pedido of doPdv) {
      const turno = gerado.turnos.find((item) => item.id === pedido.turnoId)
      expect(turno?.fechadoEm).toBeDefined()
      expect(pedido.operadorId).toBe(turno?.abertoPor)
      expect(new Date(pedido.criadoEm).getTime()).toBeGreaterThan(
        new Date(turno?.abertoEm ?? 0).getTime(),
      )
      expect(new Date(pedido.criadoEm).getTime()).toBeLessThan(
        new Date(turno?.fechadoEm ?? 0).getTime(),
      )
    }
    expect(gerado.pedidos.filter((pedido) => pedido.origem !== "pdv" && pedido.turnoId)).toEqual([])
  })

  test("nenhum turno hoje", () => {
    expect(gerado.turnos.some((turno) => isSameDay(new Date(turno.abertoEm), AGORA))).toBe(false)
  })

  test("a gaveta nunca passa de R$ 500 depois de uma venda", () => {
    for (const turno of gerado.turnos) {
      for (const venda of doPdv.filter((pedido) => pedido.turnoId === turno.id)) {
        const ate = venda.criadoEm
        const resumo = resumoDoTurno(
          { ...turno, movimentos: turno.movimentos.filter((m) => m.criadoEm <= ate) },
          doPdv.filter((pedido) => pedido.criadoEm <= ate),
        )
        expect(resumo.dinheiroNaGaveta).toBeLessThanOrEqual(500)
      }
    }
  })

  test("gaveta acima de R$ 500 ganha uma sangria do gerente que deixa R$ 100", () => {
    const base = doPdv[0]
    const em = (hora: number, total: number, id: number) => ({
      ...base,
      id,
      turnoId: undefined,
      operadorId: undefined,
      pagamento: "dinheiro" as const,
      status: "concluido" as const,
      total,
      criadoEm: new Date(2026, 10, 11, hora).toISOString(),
    })
    const { turnos } = gerarTurnos({
      pedidos: [em(10, 300, 9001), em(11, 305, 9002), em(12, 40, 9003)],
      agora: AGORA,
    })
    expect(turnos[0].movimentos.filter((m) => m.tipo === "sangria")).toEqual([
      {
        id: "turno-20261111-m1",
        tipo: "sangria",
        valor: 600,
        motivo: "Retirada para o cofre",
        feitoPor: "eq-gerente",
        criadoEm: new Date(2026, 10, 11, 11).toISOString(),
      },
    ])
    expect(turnos[0].conferencia?.esperado.dinheiro).toBe(145)
  })

  test("alguns dias abrem com suprimento de moedas", () => {
    const suprimentos = gerado.turnos.flatMap((turno) =>
      turno.movimentos.filter((m) => m.tipo === "suprimento"),
    )
    expect(suprimentos.length).toBeGreaterThan(0)
    for (const suprimento of suprimentos) {
      expect(suprimento).toMatchObject({ valor: 50, motivo: "Reforço de moedas" })
    }
  })

  test("diferença só com justificativa", () => {
    const fechados = gerado.turnos.map((turno) => turno.conferencia)
    const comDiferenca = fechados.filter((c) => c && diferencaDinheiro(c) !== 0)
    expect(comDiferenca.length).toBeGreaterThan(0)
    for (const conferencia of fechados) {
      expect(conferencia).toBeDefined()
      if (!conferencia) continue
      expect(errosDoFechamento(conferencia)).toBeUndefined()
      const diferenca = diferencaDinheiro(conferencia)
      expect(diferenca === 0 || (diferenca <= -2 && diferenca >= -10)).toBe(true)
    }
    for (const conferencia of comDiferenca) {
      expect(conferencia?.justificativa).toBe("Troco dado a mais")
    }
  })
})
