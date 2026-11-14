import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { CabecalhoAdmin } from "./cabecalho-admin"

beforeEach(() => {
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

const renderizar = () =>
  render(
    <TooltipProvider>
      <SidebarProvider>
        <CabecalhoAdmin trilha={[{ titulo: "Cardápio", modulo: "cardapio" }]} />
      </SidebarProvider>
    </TooltipProvider>,
  )

describe("CabecalhoAdmin", () => {
  test("a trilha usa o nome do módulo no segmento escolhido", () => {
    useSegmentoAtual.setState({ segmento: "farmacia", hidratado: true })
    renderizar()
    expect(screen.getByText("Produtos")).toHaveAttribute("aria-current", "page")
  })

  test("na pizzaria continua Cardápio", () => {
    renderizar()
    expect(screen.getByText("Cardápio")).toHaveAttribute("aria-current", "page")
  })
})
