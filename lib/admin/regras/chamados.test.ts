import { describe, expect, test } from "vitest"
import type { Chamado, PedidoQr } from "../dados/tipos"
import { chamadosAbertos, seloDaMesa, tempoMedioDeAtendimento, textoDoChamado } from "./chamados"
import { urlDaMesa } from "./qr"

const em = (hora: number, minuto: number, dia = 13) =>
  new Date(2026, 10, dia, hora, minuto).toISOString()

const chamado = (id: string, criadoEm: string, atendidoEm?: string): Chamado => ({
  id,
  mesaId: "mesa-1",
  tipo: "garcom",
  criadoEm,
  ...(atendidoEm ? { atendidoEm } : {}),
})

const AGORA = new Date(2026, 10, 13, 20, 30)

test("urlDaMesa leva a loja e o id da mesa para a vitrine em modo mesa", () => {
  expect(urlDaMesa("https://loja.app", "pizzaria", "mesa-7")).toBe(
    "https://loja.app/mesa?loja=pizzaria&mesa=mesa-7",
  )
})

describe("chamados", () => {
  test("abertos, do mais antigo para o mais novo; o atendido fica de fora", () => {
    const lista = [
      chamado("b", em(20, 20)),
      chamado("a", em(20, 10)),
      chamado("c", em(20, 5), em(20, 8)),
    ]
    expect(chamadosAbertos(lista).map((item) => item.id)).toEqual(["a", "b"])
  })

  test("o texto de cada tipo", () => {
    expect(textoDoChamado("garcom")).toBe("Chamou o garçom")
    expect(textoDoChamado("conta")).toBe("Chamou para a conta")
  })

  test("tempo médio de atendimento dos atendidos hoje, em minutos arredondados", () => {
    const lista = [
      chamado("a", em(20, 0), em(20, 2)),
      chamado("b", em(20, 10), em(20, 15)),
      // Aberto e de ontem: não contam.
      chamado("c", em(20, 20)),
      chamado("d", em(20, 0, 12), em(20, 30, 12)),
    ]
    expect(tempoMedioDeAtendimento(lista, AGORA)).toBe(4)
  })

  test("o selo da mesa: o pedido pelo QR, depois a conta, depois o garçom", () => {
    const pedido = { id: "p" } as PedidoQr
    const conta: Chamado = { ...chamado("c", em(20, 0)), tipo: "conta" }
    expect(seloDaMesa([chamado("a", em(20, 0)), conta], [pedido])).toBe("Pedido pelo QR")
    expect(seloDaMesa([chamado("a", em(20, 0)), conta], [])).toBe("Chamou para a conta")
    expect(seloDaMesa([chamado("a", em(20, 0))], undefined)).toBe("Chamou o garçom")
    expect(seloDaMesa([chamado("a", em(20, 0), em(20, 1))], [])).toBeNull()
    expect(seloDaMesa(undefined, undefined)).toBeNull()
  })

  test("sem chamado atendido hoje, não há tempo médio", () => {
    expect(tempoMedioDeAtendimento([chamado("a", em(20, 20))], AGORA)).toBeNull()
  })
})
