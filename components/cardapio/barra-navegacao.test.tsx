import { render, screen } from "@testing-library/react"
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

describe("BarraNavegacao", () => {
  // Abas de texto: a ativa ganha só o sublinhado na cor da loja, nenhuma leva foto.
  test("nenhuma categoria leva foto, nem a ativa", () => {
    abrir("tradicionais")

    expect(screen.getByRole("button", { name: "Tradicionais" }).querySelector("img")).toBeNull()
    expect(screen.getByRole("button", { name: "Bebidas" }).querySelector("img")).toBeNull()
  })

  test("o texto do botão é só o nome da categoria", () => {
    abrir("tradicionais")

    expect(screen.getByRole("button", { name: "Tradicionais" })).toHaveTextContent(/^Tradicionais$/)
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
