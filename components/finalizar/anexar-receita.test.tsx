import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, test, vi } from "vitest"
import { AnexarReceita, type ReceitaAnexada } from "./anexar-receita"

function Envolvido({ invalida = false }: { invalida?: boolean }) {
  const [receita, setReceita] = useState<ReceitaAnexada | null>(null)
  return (
    <AnexarReceita
      exigida={{ itens: ["Losartana 50 mg", "Amoxicilina 500 mg"], retida: true }}
      receita={receita}
      aoMudar={setReceita}
      invalida={invalida}
    />
  )
}

describe("AnexarReceita", () => {
  test("lista os remédios, avisa da via retida e recebe a foto", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => "blob:receita",
      revokeObjectURL: () => {},
    })
    const usuario = userEvent.setup()
    render(<Envolvido />)

    expect(screen.getByRole("heading", { name: "Receita médica" })).toBeInTheDocument()
    expect(screen.getByText("Losartana 50 mg, Amoxicilina 500 mg")).toBeInTheDocument()
    expect(
      screen.getByText("Tenha a via original em mãos: o entregador recolhe na entrega."),
    ).toBeInTheDocument()

    const foto = new File(["x"], "receita.jpg", { type: "image/jpeg" })
    await usuario.upload(screen.getByLabelText("Foto da receita"), foto)

    expect(screen.getByRole("img", { name: "Receita anexada" })).toHaveAttribute(
      "src",
      "blob:receita",
    )
    expect(screen.getByText("receita.jpg")).toBeInTheDocument()

    await usuario.click(screen.getByRole("button", { name: "Trocar a foto da receita" }))
    expect(screen.queryByRole("img", { name: "Receita anexada" })).not.toBeInTheDocument()
  })

  test("sem a foto na hora de enviar, avisa o que falta", () => {
    render(<Envolvido invalida />)
    expect(screen.getByRole("alert")).toHaveTextContent("Anexe a foto da receita para enviar.")
  })
})
