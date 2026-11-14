import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test } from "vitest"
import { useLojaAtual } from "@/lib/loja-atual"
import { useSacola } from "@/lib/sacola"
import { SeletorLoja } from "./seletor-loja"

const pizza = {
  produtoId: "calabresa",
  nome: "Calabresa",
  imagem: { src: "/calabresa.jpg", width: 1, height: 1 },
  precoUnitario: 46,
  quantidade: 1,
  resumo: [],
}

beforeEach(() => {
  useLojaAtual.setState({ ...useLojaAtual.getInitialState(), hidratada: true }, true)
  useSacola.setState({ ...useSacola.getInitialState(), hidratada: true }, true)
})

async function escolherFarmacia() {
  const usuario = userEvent.setup()
  render(<SeletorLoja />)
  await usuario.click(screen.getByRole("button", { name: "Loja: Casa da Pizza" }))
  expect(screen.getAllByRole("menuitemradio").map((opcao) => opcao.textContent)).toEqual([
    "Casa da PizzaPizzaria",
    "Drogaria Bem EstarFarmácia",
    "Adega da VilaAdega",
    "Açougue Sabor da CarneAçougue",
    "Empório das DeusasSalão de beleza",
    "Quiosque do MineiroLanchonete",
  ])
  await usuario.click(screen.getByRole("menuitemradio", { name: /Drogaria Bem Estar/ }))
  return usuario
}

describe("SeletorLoja", () => {
  test("com a sacola vazia, troca a loja na hora", async () => {
    await escolherFarmacia()
    expect(useLojaAtual.getState().id).toBe("drogaria-bem-estar")
    expect(screen.getByRole("button", { name: "Loja: Drogaria Bem Estar" })).toBeInTheDocument()
  })

  test("com itens na sacola, avisa que esvazia; cancelar mantém tudo", async () => {
    useSacola.getState().adicionar(pizza)
    const usuario = await escolherFarmacia()
    const aviso = await screen.findByRole("alertdialog", {
      name: "Trocar para Drogaria Bem Estar?",
    })
    expect(within(aviso).getByText(/1 item da Casa da Pizza sai da sacola/)).toBeInTheDocument()

    await usuario.click(within(aviso).getByRole("button", { name: "Continuar na Casa da Pizza" }))
    expect(useLojaAtual.getState().id).toBe("casa-da-pizza")
    expect(useSacola.getState().itens).toHaveLength(1)
  })

  test("confirmar esvazia a sacola e troca a loja", async () => {
    useSacola.getState().adicionar(pizza)
    const usuario = await escolherFarmacia()
    const aviso = await screen.findByRole("alertdialog")
    await usuario.click(within(aviso).getByRole("button", { name: "Esvaziar e trocar" }))
    expect(useLojaAtual.getState().id).toBe("drogaria-bem-estar")
    expect(useSacola.getState().itens).toEqual([])
  })
})
