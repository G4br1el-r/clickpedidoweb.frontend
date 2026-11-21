import { render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { AGORA_DE_TESTE, pedidoDeTeste } from "@/lib/admin/regras/pedidos-de-teste"
import { AbaClientes } from "./aba-clientes"

const regiao = (nome: string) => within(screen.getByRole("region", { name: nome }))
const fato = (onde: ReturnType<typeof regiao>, rotulo: string) =>
  onde.getByText(rotulo, { selector: "dt" }).closest("[data-indicador]")

const LOJA = { nome: "Casa da Pizza", telefone: "1239998888" }

const pedido = (id: number, dia: Date, total: number, nome: string, telefone: string) =>
  pedidoDeTeste(id, dia, total, { cliente: { nome, telefone } })

/** Ana voltou há pouco; Bia sumiu (2 pedidos, o último em 10/09); Caio é novo. */
const PEDIDOS: Pedido[] = [
  pedido(1, new Date(2026, 8, 1, 20), 50, "Ana Souza", "12991234567"),
  pedido(2, new Date(2026, 10, 10, 20), 30, "Ana Souza", "12991234567"),
  pedido(3, new Date(2026, 7, 20, 20), 70, "Bia Lima", "12988887777"),
  pedido(4, new Date(2026, 8, 10, 20), 80, "Bia Lima", "12988887777"),
  pedido(5, new Date(2026, 10, 12, 20), 40, "Caio", "12977776666"),
  pedido(6, new Date(2026, 10, 13, 19), 25, "Venda no balcão", LOJA.telefone),
]

function renderizar(mudancas: Partial<ComponentProps<typeof AbaClientes>> = {}) {
  return render(
    <AbaClientes
      pedidos={PEDIDOS}
      agora={AGORA_DE_TESTE}
      segmento="pizzaria"
      loja={LOJA}
      linkDaLoja="https://loja.exemplo/"
      {...mudancas}
    />,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA_DE_TESTE)
  return () => vi.useRealTimers()
})

describe("AbaClientes", () => {
  test("a régua conta os clientes dos últimos 90 dias, sem a venda no balcão", () => {
    renderizar()
    const regua = regiao("Clientes")
    expect(fato(regua, "Clientes")).toHaveTextContent("3")
    expect(fato(regua, "Novos")).toHaveTextContent("1")
    expect(fato(regua, "Novos")).toHaveTextContent("primeiro pedido nos últimos 30 dias")
    expect(fato(regua, "Voltaram")).toHaveTextContent("67%")
    expect(fato(regua, "Pedidos por cliente")).toHaveTextContent("1,7")
  })
})

describe("AbaClientes: melhores e sumidos", () => {
  test("os melhores clientes, de quem mais gastou, cada um levando aos pedidos dele", () => {
    renderizar()
    const melhores = regiao("Melhores clientes")
    const itens = melhores.getAllByRole("listitem")
    expect(itens.map((item) => item.querySelector("a")?.textContent)).toEqual([
      "Bia Lima",
      "Ana Souza",
      "Caio",
    ])
    expect(itens[0]).toHaveTextContent("2 pedidos · último em 10/09")
    expect(itens[0]).toHaveTextContent("R$ 150,00")
    expect(melhores.getByRole("link", { name: "Bia Lima" })).toHaveAttribute(
      "href",
      "/admin/pedidos?cliente=12988887777",
    )
  })

  test("o sumido tem o botão do WhatsApp com a mensagem pronta, para a pessoa revisar e enviar", () => {
    renderizar()
    const sumidos = regiao("Sumidos")
    expect(sumidos.getAllByRole("listitem")).toHaveLength(1)
    expect(sumidos.getByRole("listitem")).toHaveTextContent("2 pedidos · há 64 dias")
    const mensagem =
      "Oi, Bia! Faz um tempinho que você não pede na Casa da Pizza. Bateu saudade? Dá uma olhada no que tem hoje: https://loja.exemplo/"
    expect(sumidos.getByRole("link", { name: "Chamar Bia Lima no WhatsApp" })).toHaveAttribute(
      "href",
      `https://wa.me/5512988887777?text=${encodeURIComponent(mensagem)}`,
    )
  })

  test("sem sumido, a seção explica quem entraria nela", () => {
    renderizar({ pedidos: PEDIDOS.filter((item) => item.id !== 3) })
    expect(
      regiao("Sumidos").getByText(
        "Ninguém sumiu: quem pediu 2 vezes ou mais voltou nos últimos 30 dias.",
      ),
    ).toBeInTheDocument()
  })
})
