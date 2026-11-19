import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { clear } from "idb-keyval"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { useUsuarioSalvo } from "@/lib/admin/usuario-atual"
import { LayoutConfiguracoes } from "./layout-configuracoes"

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/configuracoes/cores" }))

beforeEach(async () => {
  await clear()
  reiniciarServidores()
  localStorage.clear()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useUsuarioSalvo.setState(useUsuarioSalvo.getInitialState(), true)
})

function abrir() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <SidebarProvider>
          <LayoutConfiguracoes>
            <h1>Cores</h1>
          </LayoutConfiguracoes>
        </SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

describe("LayoutConfiguracoes por perfil", () => {
  test("o caixa não abre a aparência da loja", async () => {
    useUsuarioSalvo.getState().entrar("pizzaria", "eq-marina")
    abrir()
    expect(
      await screen.findByText("Sem acesso a Personalizar loja", {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Cores" })).not.toBeInTheDocument()
  })

  test("o dono abre", () => {
    abrir()
    expect(screen.getByRole("heading", { name: "Cores" })).toBeInTheDocument()
  })
})
