import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { useLojaAtual } from "@/lib/loja-atual"
import { CarregamentoEnvio, DURACAO_ENVIO_MS } from "./carregamento-envio"

describe("CarregamentoEnvio", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useLojaAtual.setState({ ...useLojaAtual.getInitialState(), id: "adega-da-vila" }, true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("anuncia o envio, com a loja, a primeira mensagem do nicho e o andamento", () => {
    render(<CarregamentoEnvio itens={[]} />)

    const envio = screen.getByRole("status", { name: "Enviando seu pedido" })
    expect(envio).toHaveTextContent("Recebendo seu pedido")
    expect(envio).toHaveTextContent("Adega da Vila")
    expect(screen.getByRole("progressbar", { name: "Andamento do envio" })).toBeInTheDocument()
    expect(screen.getByText("Etapa 1 de 4")).toBeInTheDocument()
  })

  test("troca a mensagem e a etapa a cada quarto do tempo", () => {
    render(<CarregamentoEnvio itens={[]} />)

    act(() => vi.advanceTimersByTime(DURACAO_ENVIO_MS / 4))
    expect(screen.getByText("Separando as bebidas")).toBeInTheDocument()
    expect(screen.getByText("Etapa 2 de 4")).toBeInTheDocument()

    act(() => vi.advanceTimersByTime((DURACAO_ENVIO_MS / 4) * 2))
    expect(screen.getByText("Saindo gelado!")).toBeInTheDocument()
    expect(screen.getByText("Etapa 4 de 4")).toBeInTheDocument()
  })
})
