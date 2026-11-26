import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { MarcadorDaLinha } from "./marcador-de-linha"

describe("MarcadorDaLinha", () => {
  it("tem o nome que a lista pede e avisa o que a pessoa escolheu", async () => {
    const aoMudar = vi.fn()
    render(<MarcadorDaLinha rotulo="Selecionar o produto Skol" checked={false} aoMudar={aoMudar} />)
    await userEvent.click(screen.getByRole("checkbox", { name: "Selecionar o produto Skol" }))
    expect(aoMudar).toHaveBeenCalledWith(true)
  })

  it("desmarca quando já estava marcado", async () => {
    const aoMudar = vi.fn()
    render(<MarcadorDaLinha rotulo="Selecionar" checked aoMudar={aoMudar} />)
    await userEvent.click(screen.getByRole("checkbox", { name: "Selecionar" }))
    expect(aoMudar).toHaveBeenCalledWith(false)
  })

  it("desativado, não aceita o toque", async () => {
    const aoMudar = vi.fn()
    render(<MarcadorDaLinha rotulo="Selecionar" checked={false} disabled aoMudar={aoMudar} />)
    await userEvent.click(screen.getByRole("checkbox", { name: "Selecionar" }))
    expect(aoMudar).not.toHaveBeenCalled()
  })

  it("no celular, o alvo de toque tem 44 px", () => {
    render(<MarcadorDaLinha rotulo="Selecionar" checked={false} aoMudar={() => {}} />)
    expect(screen.getByRole("checkbox").parentElement?.className).toContain("size-11")
  })
})
