import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, test, vi } from "vitest"
import { TecladoPin } from "./teclado-pin"

function Campo({ aoConfirmar = () => {} }: { aoConfirmar?: () => void }) {
  const [pin, setPin] = useState("")
  return <TecladoPin id="pin" rotulo="PIN" valor={pin} aoMudar={setPin} aoConfirmar={aoConfirmar} />
}

describe("TecladoPin", () => {
  test("o teclado da tela e o do computador digitam o PIN", async () => {
    const usuario = userEvent.setup()
    render(<Campo />)
    const campo = screen.getByLabelText("PIN")
    expect(campo).toHaveAttribute("type", "password")
    expect(campo).toHaveAttribute("inputmode", "numeric")

    await usuario.click(screen.getByRole("button", { name: "1" }))
    await usuario.click(screen.getByRole("button", { name: "2" }))
    await usuario.type(campo, "34")
    expect(campo).toHaveValue("1234")

    await usuario.click(screen.getByRole("button", { name: "Apagar" }))
    expect(campo).toHaveValue("123")
    await usuario.click(screen.getByRole("button", { name: "Limpar" }))
    expect(campo).toHaveValue("")
  })

  test("letras não entram no PIN e ele para em 6 números", async () => {
    const usuario = userEvent.setup()
    render(<Campo />)
    const campo = screen.getByLabelText("PIN")
    await usuario.type(campo, "1a2b")
    expect(campo).toHaveValue("12")
    await usuario.type(campo, "345678")
    expect(campo).toHaveValue("123456")
    await usuario.click(screen.getByRole("button", { name: "9" }))
    expect(campo).toHaveValue("123456")
  })

  test("Enter confirma", async () => {
    const usuario = userEvent.setup()
    const aoConfirmar = vi.fn()
    render(<Campo aoConfirmar={aoConfirmar} />)
    await usuario.type(screen.getByLabelText("PIN"), "1111{Enter}")
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
  })
})
