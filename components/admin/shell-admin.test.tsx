import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useConfig } from "@/lib/admin/config"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { ShellAdmin } from "./shell-admin"

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/fila" }))

function renderizar() {
  return render(
    // No app, o TooltipProvider e o React Query vêm dos provedores da raiz.
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <ShellAdmin>
          <h1>Fila de pedidos</h1>
        </ShellAdmin>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useConfig.setState(useConfig.getInitialState(), true)
})

describe("ShellAdmin", () => {
  test("a barra lateral com os módulos fica ao lado do conteúdo da página", async () => {
    renderizar()
    expect(screen.getByRole("heading", { level: 1, name: "Fila de pedidos" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Fila de pedidos" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("textbox", { name: "Buscar configuração" })).toBeInTheDocument()
  })

  test("abre no segmento guardado neste navegador", async () => {
    localStorage.setItem(
      "clickpedido-admin-segmento",
      JSON.stringify({ state: { segmento: "salao" }, version: 1 }),
    )
    renderizar()
    expect(await screen.findByText("Empório das Deusas")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Agendamentos" })).toBeInTheDocument()
  })

  test("na pizzaria, a marca usa o nome guardado em Personalizar loja", async () => {
    const config = useConfig.getState().config
    useConfig.setState({
      config: { ...config, identidade: { ...config.identidade, nome: "Pizzaria do Bairro" } },
    })
    renderizar()
    const marca = screen.getByRole("link", { name: /Pizzaria do Bairro/ })
    expect(
      within(marca).getByRole("img", { name: "Logo de Pizzaria do Bairro" }),
    ).toBeInTheDocument()
  })
})

describe("cores do painel", () => {
  test("todo segmento usa a mesma cor do painel; o menu troca junto com o segmento", async () => {
    useSegmentoAtual.setState({ segmento: "farmacia", hidratado: true })
    renderizar()
    expect(document.documentElement).not.toHaveAttribute("data-segmento")
    expect(document.head.querySelector("style[data-tema-segmento]")).toBeNull()
    expect(screen.getByRole("link", { name: "Receitas" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Produtos" })).toBeInTheDocument()

    act(() => useSegmentoAtual.getState().escolher("pizzaria"))
    expect(document.documentElement).not.toHaveAttribute("data-segmento")
    expect(document.head.querySelector("style[data-tema-segmento]")).toBeNull()
    expect(screen.queryByRole("link", { name: "Receitas" })).not.toBeInTheDocument()
  })
})
