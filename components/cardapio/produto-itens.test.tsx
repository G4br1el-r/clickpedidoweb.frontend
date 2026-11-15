import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cardapioDrogariaBemEstar } from "@/lib/mock/drogaria-bem-estar"
import { useSacola } from "@/lib/sacola"
import type { Produto } from "@/lib/tipos"
import { useVoos } from "@/lib/voo"
import { ProdutoLinha } from "./produto-itens"

const produto = (id: string) =>
  cardapioDrogariaBemEstar.flatMap((categoria) => categoria.produtos).find((item) => item.id === id)

beforeEach(() => {
  useSacola.setState({ ...useSacola.getInitialState(), hidratada: true }, true)
})

describe("ProdutoLinha na farmácia", () => {
  test("o cartão do remédio mostra a tarja e se pede receita", () => {
    const amoxicilina = produto("amoxicilina-500")
    const protetor = produto("protetor-50")
    if (!amoxicilina || !protetor) throw new Error("produto não existe")
    render(
      <TooltipProvider>
        <ProdutoLinha produto={amoxicilina} aoAbrir={() => {}} />
        <ProdutoLinha produto={protetor} aoAbrir={() => {}} />
      </TooltipProvider>,
    )
    const remedio = within(screen.getByTestId("produto-amoxicilina-500"))
    expect(remedio.getByText("Tarja vermelha")).toBeInTheDocument()
    expect(remedio.getByText("Retém a receita")).toBeInTheDocument()
    expect(
      within(screen.getByTestId("produto-protetor-50")).queryByText(/Tarja|receita/),
    ).not.toBeInTheDocument()
  })
})

describe("etiqueta do produto", () => {
  test("na farmácia, a etiqueta traz a apresentação e o preço", () => {
    const amoxicilina = produto("amoxicilina-500")
    if (!amoxicilina) throw new Error("produto não existe")
    render(
      <TooltipProvider>
        <ProdutoLinha produto={amoxicilina} aoAbrir={() => {}} />
      </TooltipProvider>,
    )
    const etiqueta = within(screen.getByTestId("etiqueta-amoxicilina-500"))
    expect(etiqueta.getByText("500 mg, 21 cápsulas")).toBeInTheDocument()
    expect(etiqueta.getByText("R$ 27,90")).toBeInTheDocument()
  })

  test("no salão, a etiqueta traz quanto o serviço dura", () => {
    const escova = {
      id: "escova",
      nome: "Escova",
      descricao: "",
      preco: 60,
      tipo: "produto",
      duracaoMin: 90,
      imagem: {
        src: "/e.jpg",
        width: 1,
        height: 1,
        blurDataURL: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      },
    } as Produto
    render(
      <TooltipProvider>
        <ProdutoLinha produto={escova} aoAbrir={() => {}} />
      </TooltipProvider>,
    )
    const etiqueta = within(screen.getByTestId("etiqueta-escova"))
    expect(etiqueta.getByText("1h30")).toBeInTheDocument()
    expect(etiqueta.getByText("R$ 60,00")).toBeInTheDocument()
  })
})

describe("ProdutoLinha no açougue", () => {
  test("o preço do corte por quilo diz que é o do quilo", () => {
    const picanha = {
      id: "picanha",
      nome: "Picanha",
      descricao: "",
      preco: 89.9,
      tipo: "produto",
      unidade: "kg",
      imagem: {
        src: "/p.jpg",
        width: 1,
        height: 1,
        blurDataURL: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      },
    } as Produto
    render(
      <TooltipProvider>
        <ProdutoLinha produto={picanha} aoAbrir={() => {}} />
      </TooltipProvider>,
    )
    expect(within(screen.getByTestId("rodape-picanha")).getByText("o kg")).toBeInTheDocument()
  })
})

describe("assinatura: a etiqueta desliza até a sacola", () => {
  test("ao adicionar, o que voa sai da própria etiqueta do produto, com o preço", async () => {
    useVoos.setState(useVoos.getInitialState(), true)
    const omega = produto("omega-3")
    if (!omega) throw new Error("produto não existe")
    render(
      <TooltipProvider>
        <ProdutoLinha produto={omega} aoAbrir={() => {}} />
      </TooltipProvider>,
    )
    const etiqueta = screen.getByTestId("etiqueta-omega-3")
    etiqueta.getBoundingClientRect = () =>
      ({ left: 120, top: 400, width: 100, height: 40 }) as DOMRect

    await userEvent.setup().click(screen.getByTestId("adicionar-omega-3"))

    expect(useVoos.getState().voos).toEqual([
      expect.objectContaining({ de: { x: 170, y: 420 }, rotulo: expect.stringContaining("R$") }),
    ])
  })
})
