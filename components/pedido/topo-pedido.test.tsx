import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLojaAtual } from "@/lib/loja-atual"
import { TopoPedido } from "./topo-pedido"

beforeEach(() => {
  useLojaAtual.setState({ id: "casa-da-pizza", hidratada: true })
})

describe("TopoPedido", () => {
  test("leva de volta ao cardápio, diz a loja e mostra o que vier do lado", () => {
    render(
      <TooltipProvider>
        <TopoPedido>
          <span>Pedido nº 2234</span>
        </TopoPedido>
      </TooltipProvider>,
    )
    expect(screen.getByRole("link", { name: "Voltar ao cardápio" })).toHaveAttribute("href", "/")
    expect(screen.getByText("Casa da Pizza")).toBeInTheDocument()
    expect(screen.getByText("Pedido nº 2234")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Alternar tema claro e escuro" })).toBeInTheDocument()
  })
})
