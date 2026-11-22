import { act, render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { useLojaAtual } from "@/lib/loja-atual"
import { TemaDaLoja } from "./tema-da-loja"

const caminho = vi.hoisted(() => ({ atual: "/" }))
vi.mock("next/navigation", () => ({ usePathname: () => caminho.atual }))

beforeEach(() => {
  caminho.atual = "/"
  useLojaAtual.setState(useLojaAtual.getInitialState(), true)
  delete document.documentElement.dataset.loja
  document.title = "Casa da Pizza · Cardápio"
})

describe("TemaDaLoja", () => {
  test("veste a página com a loja escolhida e troca junto com o seletor", () => {
    useLojaAtual.setState({ id: "drogaria-bem-estar", hidratada: true })
    render(<TemaDaLoja />)
    expect(document.documentElement.dataset.loja).toBe("drogaria-bem-estar")
    expect(document.title).toBe("Drogaria Bem Estar · Cardápio")

    act(() => useLojaAtual.getState().escolher("casa-da-pizza"))
    expect(document.documentElement.dataset.loja).toBeUndefined()
    expect(document.title).toBe("Casa da Pizza · Cardápio")
  })

  test("se o Next escrever o título depois, a aba continua com o nome da loja escolhida", async () => {
    useLojaAtual.setState({ id: "drogaria-bem-estar", hidratada: true })
    render(<TemaDaLoja />)
    document.title = "Casa da Pizza · Cardápio"
    await waitFor(() => expect(document.title).toBe("Drogaria Bem Estar · Cardápio"))
  })

  test("no painel, a loja não muda as cores", () => {
    caminho.atual = "/admin/pedidos"
    useLojaAtual.setState({ id: "drogaria-bem-estar", hidratada: true })
    render(<TemaDaLoja />)
    expect(document.documentElement.dataset.loja).toBeUndefined()
  })

  test("na vitrine da mesa, quem veste a página é a loja da mesa: a escolhida não mexe", () => {
    caminho.atual = "/mesa"
    document.documentElement.dataset.loja = "adega-da-vila"
    document.title = "Pedido na mesa"
    useLojaAtual.setState({ id: "drogaria-bem-estar", hidratada: true })
    render(<TemaDaLoja />)
    expect(document.documentElement.dataset.loja).toBe("adega-da-vila")
    expect(document.title).toBe("Pedido na mesa")
  })
})
