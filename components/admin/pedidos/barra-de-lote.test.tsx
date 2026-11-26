import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { BarraDeLote } from "./barra-de-lote"

function pedido(id: number, status: Pedido["status"]) {
  return { id, numero: 400 + id, status, tipo: "entrega" } as Pedido
}

const novo = pedido(1, "recebido")
const emPreparo = pedido(2, "em-preparo")
const concluido = pedido(3, "concluido")

function renderizar(
  selecionados: Pedido[],
  extras: Partial<Parameters<typeof BarraDeLote>[0]> = {},
) {
  const aoAvancar = vi.fn()
  const aoLimpar = vi.fn()
  render(
    <BarraDeLote
      selecionados={selecionados}
      aoAvancar={aoAvancar}
      aoLimpar={aoLimpar}
      {...extras}
    />,
  )
  return { aoAvancar, aoLimpar }
}

describe("BarraDeLote", () => {
  it("sem pedidos marcados, não aparece", () => {
    renderizar([])
    expect(screen.queryByRole("region", { name: "Ações em lote" })).not.toBeInTheDocument()
  })

  it("diz quantos pedidos estão marcados", () => {
    renderizar([novo, emPreparo])
    expect(screen.getByRole("region", { name: "Ações em lote" })).toHaveTextContent(
      "2 pedidos selecionados",
    )
  })

  it("o botão avança os pedidos que têm próxima etapa", async () => {
    const { aoAvancar } = renderizar([novo, emPreparo])
    await userEvent.click(screen.getByRole("button", { name: "Avançar 2 pedidos" }))
    expect(aoAvancar).toHaveBeenCalledWith([novo, emPreparo])
  })

  it("com um só pedido avançável, o botão fala no singular", () => {
    renderizar([novo])
    expect(screen.getByRole("button", { name: "Avançar 1 pedido" })).toBeInTheDocument()
  })

  it("avisa quantos marcados não têm próxima etapa e não os manda avançar", async () => {
    const { aoAvancar } = renderizar([novo, concluido])
    expect(screen.getByText("1 sem próxima etapa")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Avançar 1 pedido" }))
    expect(aoAvancar).toHaveBeenCalledWith([novo])
  })

  it("se nenhum avança, o botão fica desligado", () => {
    renderizar([concluido])
    expect(screen.getByRole("button", { name: "Avançar 0 pedidos" })).toBeDisabled()
  })

  it("limpa a seleção", async () => {
    const { aoLimpar } = renderizar([novo])
    await userEvent.click(screen.getByRole("button", { name: "Limpar seleção" }))
    expect(aoLimpar).toHaveBeenCalledOnce()
  })

  it("enquanto avança, mostra o carregamento e não aceita outro clique", async () => {
    const { aoAvancar } = renderizar([novo, emPreparo], { avancando: true })
    expect(screen.getByRole("status", { name: "Avançando os pedidos" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Avançar 2 pedidos/ }))
    expect(aoAvancar).not.toHaveBeenCalled()
  })
})
