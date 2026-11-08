import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { StaticImageData } from "next/image"
import { describe, expect, test, vi } from "vitest"
import type { Produto } from "@/lib/tipos"
import { BarraNavegacao } from "./barra-navegacao"

const foto = (arquivo: string) =>
  ({ src: `/fotos/${arquivo}`, width: 10, height: 10 }) as StaticImageData

const produto = (id: string, arquivo: string) =>
  ({ id, nome: id, descricao: "", preco: 40, tipo: "pizza", imagem: foto(arquivo) }) as Produto

const CATEGORIAS = [
  {
    id: "tradicionais",
    nome: "Tradicionais",
    produtos: [produto("calabresa", "calabresa.jpg"), produto("mussarela", "mussarela.jpg")],
  },
  { id: "bebidas", nome: "Bebidas", produtos: [produto("cola", "refrigerante.jpg")] },
  { id: "novidades", nome: "Novidades", produtos: [] },
]

function abrir(ativa: string | null = "tradicionais") {
  const aoEscolher = vi.fn()
  render(
    <BarraNavegacao
      categorias={CATEGORIAS}
      ativa={ativa}
      aoEscolher={aoEscolher}
      buscando={false}
      aoAlternarBusca={() => {}}
      termo=""
      aoBuscar={() => {}}
      aoVerDetalhes={() => {}}
      aoRecolherBusca={() => {}}
    />,
  )
  return { aoEscolher, usuario: userEvent.setup() }
}

const fotoDo = (botao: HTMLElement) =>
  decodeURIComponent(botao.querySelector("img")?.getAttribute("src") ?? "")

describe("BarraNavegacao", () => {
  // Seis categorias com foto não cabem na coluna central (640 px); só a ativa ganha a foto.
  test("a categoria ativa mostra a foto do primeiro produto dela", () => {
    abrir("tradicionais")

    expect(fotoDo(screen.getByRole("button", { name: "Tradicionais" }))).toContain(
      "/fotos/calabresa.jpg",
    )
  })

  test("as outras categorias ficam só com o nome", () => {
    abrir("tradicionais")

    expect(screen.getByRole("button", { name: "Bebidas" }).querySelector("img")).toBeNull()
  })

  test("a foto acompanha a categoria ativa", () => {
    abrir("bebidas")

    expect(fotoDo(screen.getByRole("button", { name: "Bebidas" }))).toContain(
      "/fotos/refrigerante.jpg",
    )
    expect(screen.getByRole("button", { name: "Tradicionais" }).querySelector("img")).toBeNull()
  })

  test("a foto é decorativa: o nome do botão e o texto continuam só o da categoria", () => {
    abrir()
    const botao = screen.getByRole("button", { name: "Tradicionais" })

    expect(within(botao).queryByRole("img")).not.toBeInTheDocument()
    expect(botao).toHaveTextContent(/^Tradicionais$/)
  })

  test("categoria ativa sem produtos fica só com o nome", () => {
    abrir("novidades")

    expect(screen.getByRole("button", { name: "Novidades" }).querySelector("img")).toBeNull()
  })

  test("marca a categoria ativa e avisa qual foi escolhida", async () => {
    const { aoEscolher, usuario } = abrir("tradicionais")

    expect(screen.getByRole("button", { name: "Tradicionais" })).toHaveAttribute(
      "aria-current",
      "true",
    )
    expect(screen.getByRole("button", { name: "Bebidas" })).not.toHaveAttribute("aria-current")

    await usuario.click(screen.getByRole("button", { name: "Bebidas" }))

    expect(aoEscolher).toHaveBeenCalledWith("bebidas")
  })
})
