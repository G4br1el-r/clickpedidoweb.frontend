import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { clear } from "idb-keyval"
import { beforeEach, describe, expect, test } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { CabecalhoAdmin } from "./cabecalho-admin"

beforeEach(async () => {
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

const renderizar = () =>
  render(
    // No app, o React Query vem dos provedores da raiz.
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <SidebarProvider>
          <CabecalhoAdmin trilha={[{ titulo: "Cardápio", modulo: "cardapio" }]} />
        </SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  )

describe("CabecalhoAdmin", () => {
  test("a trilha usa o nome do módulo no segmento escolhido", () => {
    useSegmentoAtual.setState({ segmento: "farmacia", hidratado: true })
    renderizar()
    expect(screen.getByText("Produtos")).toHaveAttribute("aria-current", "page")
  })

  test("o topo mostra quem está usando o painel", async () => {
    renderizar()
    expect(
      await screen.findByRole("button", { name: /Carla N. · Dono/ }, { timeout: 5000 }),
    ).toBeInTheDocument()
  })

  test("na pizzaria continua Cardápio", () => {
    renderizar()
    expect(screen.getByText("Cardápio")).toHaveAttribute("aria-current", "page")
  })
})
