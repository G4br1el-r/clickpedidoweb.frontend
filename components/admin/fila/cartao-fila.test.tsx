import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Pedido } from "@/lib/admin/dados/tipos"
import { AGORA_DE_TESTE as AGORA, PEDIDOS_DE_TESTE } from "@/lib/admin/regras/pedidos-de-teste"
import { CartaoFila } from "./cartao-fila"

const TEMPOS = { tempoEntrega: "40–60 min", tempoRetirada: "20 min" }

/** Entrega em preparo que chegou às 20:00; agora são 20:30. */
const PEDIDO: Pedido = {
  ...PEDIDOS_DE_TESTE[2],
  tipo: "entrega",
  status: "em-preparo",
  criadoEm: new Date(2026, 10, 13, 20, 0).toISOString(),
}

function renderizar(pedido: Pedido, agora = AGORA) {
  const nada = () => {}
  return render(
    <TooltipProvider>
      <CartaoFila
        pedido={pedido}
        agora={agora}
        tempos={TEMPOS}
        motoboys={[]}
        novo={false}
        ocupado={false}
        limiteAceiteMin={5}
        aoAceitar={nada}
        aoRecusar={nada}
        aoCancelar={nada}
        aoAvancar={nada}
        aoAbrir={nada}
        aoImprimir={nada}
      />
    </TooltipProvider>,
  )
}

describe("CartaoFila: prazo prometido", () => {
  test("mostra até quando entregar e quanto falta", () => {
    renderizar(PEDIDO)
    expect(screen.getByText("até 21:00 · 30 min")).toBeInTheDocument()
    expect(screen.getByText("Entregar até 21:00, faltam 30 min")).toBeInTheDocument()
  })

  test("passou do prazo: mostra quanto atrasou", () => {
    renderizar(PEDIDO, new Date(2026, 10, 13, 21, 12))
    expect(screen.getByText("até 21:00 · +12 min")).toBeInTheDocument()
  })
})
