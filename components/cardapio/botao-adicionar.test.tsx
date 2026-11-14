import { act, render, renderHook, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { StaticImageData } from "next/image"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useSacola } from "@/lib/sacola"
import type { Produto } from "@/lib/tipos"
import { BotaoAdicionar, useQuantidadeNaSacola } from "./botao-adicionar"

const IMAGEM = { src: "/pizza.jpg", width: 1, height: 1 } as StaticImageData

function adicionar(produtoId: string, quantidade: number, resumo: string[] = []) {
  useSacola.getState().adicionar({
    produtoId,
    nome: produtoId,
    imagem: IMAGEM,
    precoUnitario: 40,
    quantidade,
    resumo,
  })
}

beforeEach(() => {
  useSacola.setState(useSacola.getInitialState(), true)
})

describe("useQuantidadeNaSacola", () => {
  test("antes de ler a sacola salva, mostra zero", () => {
    adicionar("calabresa", 2)
    const { result } = renderHook(() => useQuantidadeNaSacola("calabresa"))

    expect(result.current).toBe(0)
  })

  test("soma todas as montagens do mesmo produto e ignora os outros", () => {
    useSacola.setState({ hidratada: true })
    adicionar("calabresa", 2)
    adicionar("calabresa", 1, ["Borda catupiry"])
    adicionar("mussarela", 5)
    const { result } = renderHook(() => useQuantidadeNaSacola("calabresa"))

    expect(result.current).toBe(3)
  })

  test("acompanha a sacola quando um item entra", () => {
    useSacola.setState({ hidratada: true })
    const { result } = renderHook(() => useQuantidadeNaSacola("calabresa"))
    expect(result.current).toBe(0)

    act(() => adicionar("calabresa", 1))

    expect(result.current).toBe(1)
  })
})

describe("BotaoAdicionar na farmácia", () => {
  const remedio = (id: string, nome: string, medicamento: Produto["medicamento"]): Produto =>
    ({
      id,
      nome,
      descricao: "",
      preco: 20,
      tipo: "medicamento",
      imagem: IMAGEM,
      medicamento,
    }) as Produto
  const dados = {
    tipo: "generico",
    principioAtivo: "x",
    apresentacao: "x",
    laboratorio: "x",
    registroMs: "1",
  } as const

  test("remédio de receita entra na sacola marcado para pedir a receita no fim", async () => {
    useSacola.setState({ hidratada: true })
    const losartana = remedio("losartana-50", "Losartana 50 mg", { ...dados, tarja: "vermelha" })
    render(
      <TooltipProvider>
        <BotaoAdicionar produto={losartana} aoAbrir={() => {}} />
      </TooltipProvider>,
    )
    await userEvent.setup().click(screen.getByRole("button", { name: "Adicionar Losartana 50 mg" }))
    expect(useSacola.getState().itens[0]).toMatchObject({
      produtoId: "losartana-50",
      venda: "receita",
    })
  })

  test("controlado não vai para a sacola: o botão explica que é só no balcão", async () => {
    useSacola.setState({ hidratada: true })
    const aoAbrir = vi.fn()
    const clonazepam = remedio("clonazepam-2", "Clonazepam 2 mg", {
      ...dados,
      tarja: "preta",
      lista: "B1",
    })
    render(
      <TooltipProvider>
        <BotaoAdicionar produto={clonazepam} aoAbrir={aoAbrir} />
      </TooltipProvider>,
    )
    expect(screen.queryByRole("button", { name: /^Adicionar/ })).not.toBeInTheDocument()
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Clonazepam 2 mg: só no balcão" }))
    expect(aoAbrir).toHaveBeenCalled()
    expect(useSacola.getState().itens).toEqual([])
  })
})
