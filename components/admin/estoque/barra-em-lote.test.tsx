import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { BarraEmLote } from "./barra-em-lote"

describe("BarraEmLote", () => {
  it("sem nada marcado, não aparece", () => {
    render(
      <BarraEmLote aberta={false} texto="2 produtos selecionados" aoLimpar={() => {}}>
        <button type="button">Fazer</button>
      </BarraEmLote>,
    )
    expect(screen.queryByRole("region", { name: "Ações em lote" })).not.toBeInTheDocument()
  })

  it("com itens marcados, diz quantos são e mostra as ações", () => {
    render(
      <BarraEmLote aberta texto="2 produtos selecionados" nota="1 sem controle" aoLimpar={() => {}}>
        <button type="button">Fazer</button>
      </BarraEmLote>,
    )
    const barra = screen.getByRole("region", { name: "Ações em lote" })
    expect(barra).toHaveTextContent("2 produtos selecionados")
    expect(barra).toHaveTextContent("1 sem controle")
    expect(screen.getByRole("button", { name: "Fazer" })).toBeInTheDocument()
  })

  it("limpar seleção avisa quem chamou", async () => {
    const aoLimpar = vi.fn()
    render(
      <BarraEmLote aberta texto="1 lote selecionado" aoLimpar={aoLimpar}>
        <button type="button">Fazer</button>
      </BarraEmLote>,
    )
    await userEvent.click(screen.getByRole("button", { name: "Limpar seleção" }))
    expect(aoLimpar).toHaveBeenCalledOnce()
  })

  it("no celular, os botões têm 44 px de altura para o dedo", () => {
    render(
      <BarraEmLote aberta texto="1 lote selecionado" aoLimpar={() => {}}>
        <button type="button">Fazer</button>
      </BarraEmLote>,
    )
    expect(screen.getByRole("button", { name: "Limpar seleção" }).className).toContain(
      "max-md:h-11",
    )
  })
})
