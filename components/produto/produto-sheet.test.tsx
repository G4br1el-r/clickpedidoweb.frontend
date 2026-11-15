import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLojaAtual } from "@/lib/loja-atual"
import { cardapioCasaDaPizza } from "@/lib/mock/casa-da-pizza"
import { cardapioDrogariaBemEstar } from "@/lib/mock/drogaria-bem-estar"
import { useSacola } from "@/lib/sacola"
import type { Produto } from "@/lib/tipos"
import { useVoos } from "@/lib/voo"
import { ProdutoSheet } from "./produto-sheet"

const produto = (id: string) => {
  const achado = cardapioDrogariaBemEstar
    .flatMap((categoria) => categoria.produtos)
    .find((item) => item.id === id)
  if (!achado) throw new Error(`Produto ${id} não existe`)
  return achado
}

function abrir(id: string) {
  render(
    <TooltipProvider>
      <ProdutoSheet produto={produto(id)} aberto aoMudar={() => {}} />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  useLojaAtual.setState({ id: "drogaria-bem-estar", hidratada: true })
  useSacola.setState({ ...useSacola.getInitialState(), hidratada: true }, true)
  useVoos.setState({ voos: [] })
})

describe("ProdutoSheet na farmácia", () => {
  test("mostra a ficha do remédio e leva para a sacola marcado para pedir a receita", async () => {
    abrir("amoxicilina-500")
    expect(await screen.findByText("Amoxicilina tri-hidratada")).toBeInTheDocument()
    expect(screen.getByText("Retém a receita")).toBeInTheDocument()
    await userEvent.setup().click(screen.getByTestId("cta-adicionar"))
    expect(useSacola.getState().itens[0]).toMatchObject({
      produtoId: "amoxicilina-500",
      venda: "receita-retida",
    })
  })

  test("a etiqueta da vitrine vem logo abaixo do nome: a embalagem e o preço", async () => {
    abrir("amoxicilina-500")
    const etiqueta = await screen.findByTestId("etiqueta-folha")
    expect(within(etiqueta).getByText("500 mg, 21 cápsulas")).toBeInTheDocument()
    expect(within(etiqueta).getByText("R$ 27,90")).toBeInTheDocument()
  })

  test("ao adicionar, a etiqueta com o total sai do preço do botão rumo à sacola", async () => {
    abrir("amoxicilina-500")
    const preco = await screen.findByTestId("preco-folha")
    vi.spyOn(preco, "getBoundingClientRect").mockReturnValue(new DOMRect(300, 700, 80, 20))
    await userEvent.setup().click(screen.getByTestId("cta-adicionar"))
    expect(useVoos.getState().voos).toHaveLength(1)
    expect(useVoos.getState().voos[0]).toMatchObject({
      // O Intl separa o símbolo do valor com espaço não separável.
      rotulo: "R$ 27,90",
      de: { x: 340, y: 710 },
    })
  })

  test("controlado não tem como adicionar", async () => {
    abrir("clonazepam-2")
    expect(await screen.findByText(/a lei não permite venda pela internet/)).toBeInTheDocument()
    expect(screen.getByTestId("cta-adicionar")).toBeDisabled()
    expect(screen.getByTestId("cta-adicionar")).toHaveTextContent("Só no balcão")
  })
})

describe("ProdutoSheet no açougue", () => {
  const picanha = {
    id: "picanha",
    tipo: "produto",
    nome: "Picanha",
    descricao: "Peça com capa de gordura.",
    preco: 89.9,
    unidade: "kg",
    imagem: {
      src: "/mock/acougue/picanha.jpg",
      width: 800,
      height: 533,
      blurDataURL: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    },
    grupos: [],
  } as Produto

  test("escolhe o peso, vê o estimado e leva para a sacola com o peso", async () => {
    useLojaAtual.setState({ id: "acougue-sabor-da-carne", hidratada: true })
    const usuario = userEvent.setup()
    render(
      <TooltipProvider>
        <ProdutoSheet produto={picanha} aberto aoMudar={() => {}} />
      </TooltipProvider>,
    )
    expect(await screen.findByTestId("etiqueta-folha")).toHaveTextContent(/R\$\s89,90\s*o quilo/)
    const pesos = screen.getByRole("radiogroup", { name: "Peso" })
    expect(within(pesos).getByRole("radio", { name: "500 g" })).toBeChecked()

    await usuario.click(within(pesos).getByRole("radio", { name: "1 kg" }))
    expect(screen.getByTestId("cta-adicionar")).toHaveTextContent("R$ 89,90")
    expect(
      screen.getByText("O valor final sai na balança e pode variar um pouco."),
    ).toBeInTheDocument()

    await usuario.click(screen.getByTestId("cta-adicionar"))
    expect(useSacola.getState().itens[0]).toMatchObject({
      produtoId: "picanha",
      pesoGramas: 1000,
      precoUnitario: 89.9,
      resumo: ["1 kg"],
    })
  })
})

describe("ProdutoSheet com adicionais (várias escolhas)", () => {
  const lanche = {
    id: "x-burger",
    tipo: "produto",
    nome: "X-Burger",
    descricao: "Pão, carne e queijo.",
    preco: 20,
    imagem: {
      src: "/mock/lanchonete/x-burger.jpg",
      width: 800,
      height: 533,
      blurDataURL: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    },
    grupos: [
      {
        id: "adicionais",
        tipo: "opcao",
        nome: "Adicionais",
        titulo: "Adicionais",
        obrigatorio: false,
        maximo: 2,
        gratisAte: 0,
        itens: [
          { id: "bacon", nome: "Bacon", extra: 4 },
          { id: "ovo", nome: "Ovo", extra: 2 },
          { id: "cheddar", nome: "Cheddar", extra: 3 },
        ],
      },
    ],
  } as Produto

  test("marca até o limite, soma os acréscimos e leva cada adicional para a sacola", async () => {
    useLojaAtual.setState({ id: "quiosque-do-mineiro", hidratada: true })
    const usuario = userEvent.setup()
    render(
      <TooltipProvider>
        <ProdutoSheet produto={lanche} aberto aoMudar={() => {}} />
      </TooltipProvider>,
    )
    const grupo = await screen.findByRole("group", { name: "Adicionais" })
    expect(within(grupo).getByText("Escolha até 2")).toBeInTheDocument()

    await usuario.click(within(grupo).getByRole("checkbox", { name: "Bacon" }))
    await usuario.click(within(grupo).getByRole("checkbox", { name: "Ovo" }))
    // No limite, o que falta marcar fica desligado.
    expect(within(grupo).getByRole("checkbox", { name: "Cheddar" })).toBeDisabled()
    expect(screen.getByTestId("cta-adicionar")).toHaveTextContent("R$ 26,00")

    await usuario.click(screen.getByTestId("cta-adicionar"))
    expect(useSacola.getState().itens[0]).toMatchObject({
      produtoId: "x-burger",
      precoUnitario: 26,
      resumo: ["Bacon", "Ovo"],
    })
  })
})

describe("ProdutoSheet no açougue com preparo", () => {
  const moida = {
    id: "moida",
    tipo: "produto",
    nome: "Carne Moída",
    descricao: "Patinho moído na hora.",
    preco: 38.9,
    unidade: "kg",
    imagem: {
      src: "/mock/acougue/moida.jpg",
      width: 800,
      height: 533,
      blurDataURL: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    },
    grupos: [
      {
        id: "moagem",
        tipo: "opcao",
        nome: "Moagem",
        titulo: "Moagem",
        obrigatorio: true,
        maximo: 1,
        gratisAte: 0,
        itens: [{ id: "uma-vez", nome: "Moída 1 vez", extra: 0 }],
      },
    ],
  } as Produto

  test("o corte com preparo também mostra o preço do quilo e pede o peso", async () => {
    useLojaAtual.setState({ id: "acougue-sabor-da-carne", hidratada: true })
    const usuario = userEvent.setup()
    render(
      <TooltipProvider>
        <ProdutoSheet produto={moida} aberto aoMudar={() => {}} />
      </TooltipProvider>,
    )
    expect(await screen.findByTestId("etiqueta-folha")).toHaveTextContent(/R\$\s38,90\s*o quilo/)
    await usuario.click(screen.getByRole("radio", { name: "Moída 1 vez" }))
    const pesos = screen.getByRole("radiogroup", { name: "Peso" })
    await usuario.click(within(pesos).getByRole("radio", { name: "1 kg" }))
    await usuario.click(screen.getByTestId("cta-adicionar"))
    expect(useSacola.getState().itens[0]).toMatchObject({
      pesoGramas: 1000,
      precoUnitario: 38.9,
      resumo: ["1 kg", "Moída 1 vez"],
    })
  })
})

describe("ProdutoSheet na pizzaria", () => {
  const meioAMeio = cardapioCasaDaPizza
    .flatMap((categoria) => categoria.produtos)
    .find((item) => item.id === "meio-a-meio") as Produto

  test("quem monta com opções pagas lê na etiqueta o preço de partida", async () => {
    useLojaAtual.setState({ id: "casa-da-pizza", hidratada: true })
    render(
      <TooltipProvider>
        <ProdutoSheet produto={meioAMeio} aberto aoMudar={() => {}} />
      </TooltipProvider>,
    )
    const etiqueta = await screen.findByTestId("etiqueta-folha")
    expect(within(etiqueta).getByText("8 fatias")).toBeInTheDocument()
    expect(within(etiqueta).getByText("A partir de")).toBeInTheDocument()
    expect(within(etiqueta).getByText("R$ 58,00")).toBeInTheDocument()
  })
})
