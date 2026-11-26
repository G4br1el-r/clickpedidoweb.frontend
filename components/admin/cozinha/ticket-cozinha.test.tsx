import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { PEDIDOS_DE_TESTE } from "@/lib/admin/regras/pedidos-de-teste"
import { TicketCozinha } from "./ticket-cozinha"

const emPreparo = PEDIDOS_DE_TESTE.find((pedido) => pedido.status === "em-preparo") as Pedido

function renderizar(ocupado: boolean) {
  render(
    <TicketCozinha
      pedido={emPreparo}
      agora={new Date(emPreparo.criadoEm)}
      ocupado={ocupado}
      aoAvancar={vi.fn()}
    />,
  )
}

describe("TicketCozinha", () => {
  it("parado, o botão de avançar fica pronto para o toque", () => {
    renderizar(false)
    expect(screen.getByRole("button", { name: "Marcar pronto" })).toBeEnabled()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("enquanto o pedido avança, mostra o carregamento e desliga o botão", () => {
    renderizar(true)
    expect(screen.getByRole("status", { name: "Avançando o pedido" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Marcar pronto/ })).toBeDisabled()
  })
})
