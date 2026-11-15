import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Toaster } from "sonner"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { type ItemSacola, useSacola } from "@/lib/sacola"
import { ConteudoSacola } from "./sacola-sheet"

const FOTO = {
  src: "/foto.jpg",
  width: 800,
  height: 533,
  blurDataURL: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
}

function item(parcial: Partial<ItemSacola> & Pick<ItemSacola, "chave" | "nome">): ItemSacola {
  return {
    produtoId: parcial.chave,
    imagem: FOTO,
    precoUnitario: 15,
    quantidade: 1,
    resumo: [],
    ...parcial,
  }
}

const COLA = item({ chave: "cola", nome: "Refrigerante de cola 2L", quantidade: 2 })
const GUARANA = item({ chave: "guarana", nome: "Refrigerante de guaraná 2L", precoUnitario: 13 })

function abrir(itens: ItemSacola[]) {
  useSacola.setState({ itens, hidratada: true })
  const aoContinuar = vi.fn()
  const usuario = userEvent.setup()
  render(
    <TooltipProvider>
      <ConteudoSacola aoContinuar={aoContinuar} />
      <Toaster />
    </TooltipProvider>,
  )
  return { usuario, aoContinuar }
}

const linha = (nome: string) =>
  screen
    .getAllByRole("listitem")
    .find((elemento) => within(elemento).queryByText(nome, { exact: true })) as HTMLElement

describe("ConteudoSacola", () => {
  beforeEach(() => {
    useSacola.setState(useSacola.getInitialState(), true)
  })

  test("cada item é uma linha com nome, quantidade e o total da linha", () => {
    abrir([COLA, GUARANA])

    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    const cola = linha("Refrigerante de cola 2L")
    expect(within(cola).getByText("R$ 30,00")).toBeInTheDocument()
    expect(
      within(cola).getByRole("group", { name: "Quantidade de Refrigerante de cola 2L" }),
    ).toHaveTextContent("2")
  })

  test("com mais de uma unidade, mostra o preço de cada uma", () => {
    abrir([COLA, GUARANA])

    expect(within(linha("Refrigerante de cola 2L")).getByText("2 × R$ 15,00")).toBeInTheDocument()
    expect(within(linha("Refrigerante de guaraná 2L")).queryByText(/×/)).not.toBeInTheDocument()
  })

  test("mostra a opção escolhida e a observação de cada item", () => {
    abrir([
      item({
        chave: "pizza",
        nome: "Pizza meio a meio",
        resumo: ["Calabresa", "Borda de catupiry"],
        observacao: "Bem assada",
      }),
    ])

    const pizza = linha("Pizza meio a meio")
    expect(within(pizza).getByText("Calabresa · Borda de catupiry")).toBeInTheDocument()
    expect(within(pizza).getByText("Observação: Bem assada")).toBeInTheDocument()
  })

  test("soma o total dos itens; a entrega fica para o próximo passo", () => {
    abrir([COLA, GUARANA])

    expect(screen.getByText("Total").nextElementSibling).toHaveTextContent("R$ 43,00")
    expect(screen.getByText("No próximo passo")).toBeInTheDocument()
  })

  test("aumentar a quantidade atualiza a linha e o total", async () => {
    const { usuario } = abrir([GUARANA])

    await usuario.click(
      screen.getByRole("button", { name: "Aumentar quantidade de Refrigerante de guaraná 2L" }),
    )

    expect(useSacola.getState().itens[0].quantidade).toBe(2)
    expect(within(linha("Refrigerante de guaraná 2L")).getByText("R$ 26,00")).toBeInTheDocument()
  })

  describe("pedido mínimo", () => {
    test("abaixo do mínimo, diz quanto falta e mostra o progresso", () => {
      abrir([GUARANA])

      expect(screen.getByText("Faltam R$ 17,00 para o pedido mínimo")).toBeInTheDocument()
      expect(
        screen.getByRole("progressbar", { name: "Progresso até o pedido mínimo" }),
      ).toBeInTheDocument()
    })

    test("abaixo do mínimo, continuar não avança e avisa o leitor de tela", async () => {
      const { usuario, aoContinuar } = abrir([GUARANA])

      await usuario.click(screen.getByRole("button", { name: "Continuar" }))

      expect(aoContinuar).not.toHaveBeenCalled()
      expect(screen.getAllByText("Faltam R$ 17,00 para o pedido mínimo").length).toBeGreaterThan(1)
    })

    test("com o mínimo atingido, continuar avança", async () => {
      const { usuario, aoContinuar } = abrir([COLA])

      expect(screen.getByText("Pedido mínimo atingido")).toBeInTheDocument()
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
      await usuario.click(screen.getByRole("button", { name: "Continuar" }))

      expect(aoContinuar).toHaveBeenCalledOnce()
    })
  })

  test("remover tira o item, avisa e deixa desfazer", async () => {
    const { usuario } = abrir([COLA, GUARANA])

    await usuario.click(screen.getByRole("button", { name: "Remover Refrigerante de guaraná 2L" }))

    expect(useSacola.getState().itens.map(({ chave }) => chave)).toEqual(["cola"])
    expect(
      await screen.findAllByText("Refrigerante de guaraná 2L saiu da sacola"),
    ).not.toHaveLength(0)
    await usuario.click(await screen.findByRole("button", { name: "Desfazer" }))
    expect(useSacola.getState().itens.map(({ chave }) => chave)).toEqual(["cola", "guarana"])
  })

  test("vazia, convida a escolher no cardápio", () => {
    abrir([])

    expect(screen.getByText("Sua sacola está vazia")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Continuar" })).not.toBeInTheDocument()
  })
})
