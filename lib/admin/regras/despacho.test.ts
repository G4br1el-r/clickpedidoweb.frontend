import { describe, expect, test } from "vitest"
import type { Motoboy, Pedido, StatusPedido } from "../dados/tipos"
import {
  entregasParaAgrupar,
  entregasPorBairro,
  motoboySugerido,
  situacaoDosMotoboys,
} from "./despacho"
import { AGORA_DE_TESTE as AGORA, PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const motoboy = (id: string, ativo = true): Motoboy => ({
  id,
  nome: `Moto ${id}`,
  telefone: "12991230000",
  ativo,
})
const MOTOBOYS = [motoboy("a"), motoboy("b"), motoboy("c"), motoboy("d", false)]

/** Entrega do motoboy, atualizada `minutosAtras` antes de AGORA (20:30). */
function entrega(
  id: number,
  motoboyId: string,
  status: StatusPedido,
  minutosAtras: number,
): Pedido {
  const em = new Date(AGORA.getTime() - minutosAtras * 60_000).toISOString()
  return {
    ...PEDIDOS_DE_TESTE[2],
    id,
    tipo: "entrega",
    status,
    motoboyId,
    criadoEm: em,
    atualizadoEm: em,
  }
}

describe("situacaoDosMotoboys", () => {
  test("em rota com quantas entregas, disponível desde a última volta, ou ausente", () => {
    const pedidos = [
      entrega(1, "a", "saiu-para-entrega", 10),
      entrega(2, "a", "saiu-para-entrega", 10),
      entrega(3, "b", "concluido", 40),
      entrega(4, "b", "concluido", 25),
    ]
    const situacao = situacaoDosMotoboys(MOTOBOYS, pedidos)
    expect(situacao.map((item) => [item.motoboy.id, item.situacao, item.emRota.length])).toEqual([
      ["a", "em-rota", 2],
      ["b", "disponivel", 0],
      ["c", "disponivel", 0],
      ["d", "ausente", 0],
    ])
    expect(situacao[1].livreDesde).toBe(pedidos[3].atualizadoEm)
    expect(situacao[2].livreDesde).toBeNull()
  })
})

describe("motoboySugerido", () => {
  test("o disponível livre há mais tempo; quem não saiu hoje vem primeiro", () => {
    const pedidos = [entrega(3, "b", "concluido", 40), entrega(5, "c", "concluido", 5)]
    expect(motoboySugerido(situacaoDosMotoboys(MOTOBOYS, pedidos))?.id).toBe("a")
    const todosSairam = [...pedidos, entrega(6, "a", "concluido", 2)]
    expect(motoboySugerido(situacaoDosMotoboys(MOTOBOYS, todosSairam))?.id).toBe("b")
  })

  test("ninguém disponível, sem sugestão", () => {
    const pedidos = ["a", "b", "c"].map((id, indice) => entrega(indice, id, "saiu-para-entrega", 5))
    expect(motoboySugerido(situacaoDosMotoboys(MOTOBOYS, pedidos))).toBeNull()
  })
})

describe("entregasParaAgrupar", () => {
  const noBairro = (id: number, bairro: string, status: StatusPedido = "pronto"): Pedido => ({
    ...entrega(id, "", status, 5),
    motoboyId: undefined,
    endereco: { cep: "12630-000", logradouro: "Rua", numero: "1", bairro, cidade: "Lorena" },
  })

  test("as outras entregas prontas do mesmo bairro, sem ligar para acento e maiúscula", () => {
    const atual = noBairro(1, "Jardim Esplanada")
    const fila = [
      atual,
      noBairro(2, "jardim esplanada"),
      noBairro(3, "Centro"),
      noBairro(4, "Jardim Esplanada", "em-preparo"),
      { ...noBairro(5, "Jardim Esplanada"), tipo: "retirada" as const },
    ]
    expect(entregasParaAgrupar(atual, fila).map((pedido) => pedido.id)).toEqual([2])
  })
})

describe("entregasPorBairro", () => {
  const em = (
    id: number,
    bairro: string,
    status: StatusPedido,
    tipo: Pedido["tipo"] = "entrega",
  ): Pedido => ({
    ...entrega(id, "", status, 5),
    tipo,
    endereco: { cep: "12630-000", logradouro: "Rua", numero: "1", bairro, cidade: "Lorena" },
  })

  test("só entregas em andamento, do bairro com mais ao com menos", () => {
    const fila = [
      em(1, "Centro", "pronto"),
      em(2, "Vila Nunes", "recebido"),
      em(3, "Centro", "saiu-para-entrega"),
      em(4, "Centro", "concluido"),
      em(5, "Vila Nunes", "em-preparo"),
      em(6, "Centro", "em-preparo"),
      em(7, "Centro", "pronto", "retirada"),
    ]
    expect(
      entregasPorBairro(fila).map(({ bairro, pedidos }) => [bairro, pedidos.map((p) => p.id)]),
    ).toEqual([
      ["Centro", [1, 3, 6]],
      ["Vila Nunes", [2, 5]],
    ])
  })
})
