import { describe, expect, test } from "vitest"
import { PEDIDOS_DE_TESTE } from "../regras/pedidos-de-teste"
import { mesasSeCruzam } from "../regras/salao"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { type BaseLojaV3, CONFIG_SALAO_PADRAO, migrarDaVersao3 } from "./migracao"
import type { Pedido } from "./tipos"

const mesaDe = (id: number, garcom: string): Pedido => {
  const pedido = PEDIDOS_DE_TESTE.find((candidato) => candidato.id === id)
  if (!pedido) throw new Error(`pedido ${id} não existe nos pedidos de teste`)
  return { ...pedido, tipo: "mesa", mesa: { id: `mesa-${id}`, numero: id, garcom } }
}

function baseV2(): BaseLojaV3 {
  const { mesas: _mesas, ...catalogo } = catalogoDeTeste()
  return {
    ...catalogo,
    mesas: [1, 2, 3, 4, 5, 6, 7].map((numero) => ({
      id: `mesa-${numero}`,
      numero,
      nome: `Mesa ${numero}`,
      status: numero === 2 ? ("ocupada" as const) : ("livre" as const),
      ...(numero === 2 ? { pedidoAtivoId: 7, clienteNome: "Cliente 7" } : {}),
    })),
    pedidos: [mesaDe(7, "Paula"), mesaDe(2, "Bia"), mesaDe(1, "Paula")],
    movimentosEstoque: [],
  }
}

/** Base antiga só com mesas livres, para testar o espaço do mapa. */
function baseV2ComMesas(quantidade: number): BaseLojaV3 {
  return {
    ...baseV2(),
    mesas: Array.from({ length: quantidade }, (_, indice) => ({
      id: `mesa-${indice + 1}`,
      numero: indice + 1,
      nome: `Mesa ${indice + 1}`,
      status: "livre" as const,
    })),
  }
}

describe("migrarDaVersao3", () => {
  test("toda mesa vai para a área Salão, com 4 lugares e forma quadrada", () => {
    const { mesas, salao } = migrarDaVersao3(baseV2())
    expect(salao.areas).toEqual([{ id: "area-salao", nome: "Salão", ordem: 1 }])
    for (const mesa of mesas)
      expect(mesa).toMatchObject({ areaId: "area-salao", lugares: 4, forma: "quadrada" })
  })

  test("posições em fileiras de 6, a cada 4 células", () => {
    expect(migrarDaVersao3(baseV2()).mesas.map((mesa) => mesa.posicao)).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 8, y: 0 },
      { x: 12, y: 0 },
      { x: 16, y: 0 },
      { x: 20, y: 0 },
      { x: 0, y: 4 },
    ])
  })

  test("taxa, couvert e limpeza começam desligados", () => {
    const { salao } = migrarDaVersao3(baseV2())
    expect(salao.taxaServico).toEqual({ ativa: false, percentual: 10 })
    expect(salao.couvert).toEqual({ ativo: false, porPessoa: 0 })
    expect(salao.limpeza).toBe(false)
    expect(salao.funcoes).toEqual({ mapa: false, reservas: false, qr: false })
  })

  test("alertas, reservas e QR começam com os valores padrão", () => {
    const { salao } = migrarDaVersao3(baseV2())
    expect(salao.alertas).toEqual({
      semPedidoMin: 15,
      contaPedidaMin: 10,
      servirMin: 10,
      abertaMin: 150,
    })
    expect(salao.reservas).toEqual({ antecedenciaMin: 30, toleranciaMin: 15 })
    expect(salao.qr).toEqual({ aceite: "garcom", abrirMesaPeloQr: true })
  })

  test("os garçons saem das comandas, sem repetir, em ordem alfabética", () => {
    const { garcons } = migrarDaVersao3(baseV2()).salao
    expect(garcons.map((garcom) => garcom.nome)).toEqual(["Bia", "Paula"])
    expect(garcons).toEqual([
      { id: "garcom-bia", nome: "Bia", ativo: true },
      { id: "garcom-paula", nome: "Paula", ativo: true },
    ])
  })

  test("o id do garçom não leva acento nem espaço", () => {
    const base = baseV2()
    base.pedidos = [mesaDe(7, "Maria José")]
    expect(migrarDaVersao3(base).salao.garcons).toEqual([
      { id: "garcom-maria-jose", nome: "Maria José", ativo: true },
    ])
  })

  test("o mesmo garçom escrito de jeitos diferentes vira um só, com a primeira grafia", () => {
    const base = baseV2()
    base.pedidos = [mesaDe(7, "Bia"), mesaDe(2, "bia "), mesaDe(1, "Bía")]
    expect(migrarDaVersao3(base).salao.garcons).toEqual([
      { id: "garcom-bia", nome: "Bia", ativo: true },
    ])
  })

  test("com mais de 24 mesas, a 25ª cai no primeiro lugar livre do mapa, sem cruzar outra", () => {
    const { mesas, salao } = migrarDaVersao3(baseV2ComMesas(25))
    expect(salao.areas).toEqual([{ id: "area-salao", nome: "Salão", ordem: 1 }])
    expect(mesas[24]).toMatchObject({ areaId: "area-salao", posicao: { x: 2, y: 0 } })
    for (const [i, a] of mesas.entries())
      for (const b of mesas.slice(i + 1)) expect(mesasSeCruzam(a, b)).toBe(false)
  })

  test("quando o Salão enche, a mesa seguinte vai para o Salão 2", () => {
    const { mesas, salao } = migrarDaVersao3(baseV2ComMesas(97))
    expect(salao.areas).toEqual([
      { id: "area-salao", nome: "Salão", ordem: 1 },
      { id: "area-salao-2", nome: "Salão 2", ordem: 2 },
    ])
    expect(mesas[95]?.areaId).toBe("area-salao")
    expect(mesas[96]).toMatchObject({ areaId: "area-salao-2", posicao: { x: 0, y: 0 } })
  })

  test("a mesa ocupada continua com a mesma comanda", () => {
    expect(migrarDaVersao3(baseV2()).mesas[1]).toMatchObject({
      status: "ocupada",
      pedidoAtivoId: 7,
      clienteNome: "Cliente 7",
    })
  })

  test("pedidos, produtos e estoque não mudam; reservas, espera e chamados começam vazios", () => {
    const base = baseV2()
    const migrada = migrarDaVersao3(base)
    expect(migrada.pedidos).toEqual(base.pedidos)
    expect(migrada.produtos).toEqual(base.produtos)
    expect(migrada.movimentosEstoque).toEqual(base.movimentosEstoque)
    expect([migrada.reservas, migrada.espera, migrada.chamados]).toEqual([[], [], []])
  })

  test("a configuração padrão não tem áreas nem garçons", () => {
    expect(CONFIG_SALAO_PADRAO.areas).toEqual([])
    expect(CONFIG_SALAO_PADRAO.garcons).toEqual([])
  })
})
