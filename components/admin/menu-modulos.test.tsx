import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { clear } from "idb-keyval"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { MenuModulos } from "./menu-modulos"

const caminho = vi.hoisted(() => ({ atual: "/admin" }))
vi.mock("next/navigation", () => ({ usePathname: () => caminho.atual }))

function renderizar() {
  return render(
    // No app, o TooltipProvider e o React Query vêm dos provedores da raiz.
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <SidebarProvider>
          <MenuModulos />
        </SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  caminho.atual = "/admin"
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})
describe("MenuModulos", () => {
  test("no salão aparece Agendamentos e somem mesas, garçom, cozinha e entrega", () => {
    useSegmentoAtual.setState({ segmento: "salao" })
    renderizar()

    expect(screen.getByRole("link", { name: "Agendamentos" })).toHaveAttribute(
      "href",
      "/admin/agendamentos",
    )
    for (const fora of ["Mesas", "Garçom", "Cozinha", "Motoboys", "Bairros e taxas"]) {
      expect(screen.queryByRole("link", { name: fora })).not.toBeInTheDocument()
    }
    expect(screen.queryByText("Entrega")).not.toBeInTheDocument()
  })

  test("na adega aparecem mesas e entrega, e não Agendamentos", () => {
    useSegmentoAtual.setState({ segmento: "adega" })
    renderizar()

    expect(screen.getByRole("link", { name: "Mesas" })).toHaveAttribute("href", "/admin/mesas")
    expect(screen.getByRole("link", { name: "Motoboys" })).toBeInTheDocument()
    expect(screen.getByText("Entrega")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Agendamentos" })).not.toBeInTheDocument()
  })

  test("marca a página em que você está", () => {
    caminho.atual = "/admin/fila"
    renderizar()

    expect(screen.getByRole("link", { name: "Fila de pedidos" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("link", { name: "Visão geral" })).not.toHaveAttribute("aria-current")
  })
})

describe("aviso do estoque no menu", () => {
  test("sem nada para repor, o Estoque fica sem número", async () => {
    useSegmentoAtual.setState({ segmento: "salao" })
    // O salão não controla estoque na demonstração.
    await servidorDo("salao").produtos.listar()
    renderizar()
    expect(screen.getByRole("link", { name: "Estoque" })).toBeInTheDocument()
    expect(screen.queryByText("para repor", { exact: false })).not.toBeInTheDocument()
  })

  test("conta os produtos no mínimo, zerados ou negativos", async () => {
    useSegmentoAtual.setState({ segmento: "salao" })
    const [produto] = await servidorDo("salao").produtos.listar()
    await servidorDo("salao").estoque.configurar(produto.id, {
      controlar: true,
      minimo: 2,
      esgotarAoZerar: false,
    })
    renderizar()
    expect(await screen.findByText("1 produto para repor")).toBeInTheDocument()
  })
})
