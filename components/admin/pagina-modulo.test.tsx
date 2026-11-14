import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test } from "vitest"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaModulo } from "./pagina-modulo"

beforeEach(() => {
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

describe("PaginaModulo", () => {
  test("não avisa nada antes de carregar o segmento salvo neste navegador", () => {
    useSegmentoAtual.setState({ segmento: "salao", hidratado: false })
    render(<PaginaModulo id="mesas" />)

    expect(screen.queryByText(/não faz parte/)).not.toBeInTheDocument()
  })

  test("avisa quando o módulo não faz parte do segmento e leva para a visão geral", () => {
    useSegmentoAtual.setState({ segmento: "salao", hidratado: true })
    render(<PaginaModulo id="mesas" />)

    expect(screen.getByText("Mesas não faz parte de Salão de beleza")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ir para a visão geral" })).toHaveAttribute(
      "href",
      "/admin",
    )
  })

  test("no segmento que tem o módulo, mostra a página dele", () => {
    useSegmentoAtual.setState({ segmento: "adega", hidratado: true })
    // A página de Mesas lê os dados da loja: precisa do cliente do React Query.
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PaginaModulo id="mesas" />
      </QueryClientProvider>,
    )

    expect(screen.queryByText(/não faz parte/)).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: "Mesas" })).toBeInTheDocument()
  })
})

describe("módulos da farmácia", () => {
  test.each([
    ["receitas", "Receitas"],
    ["controlados", "Controlados"],
    ["validade", "Lotes e validade"],
  ] as const)("%s abre a tela própria na farmácia", (id, titulo) => {
    useSegmentoAtual.setState({ segmento: "farmacia", hidratado: true })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PaginaModulo id={id} />
      </QueryClientProvider>,
    )
    expect(screen.queryByText("Em construção")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1, name: titulo })).toBeInTheDocument()
  })

  test("na pizzaria, receitas não faz parte do segmento", () => {
    useSegmentoAtual.setState({ segmento: "pizzaria", hidratado: true })
    render(<PaginaModulo id="receitas" />)
    expect(screen.getByText("Receitas não faz parte de Pizzaria")).toBeInTheDocument()
  })
})

describe("estoque", () => {
  test("abre a tela de Estoque", async () => {
    useSegmentoAtual.setState({ segmento: "pizzaria", hidratado: true })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PaginaModulo id="estoque" />
      </QueryClientProvider>,
    )
    expect(screen.queryByText("Em construção")).not.toBeInTheDocument()
    expect(
      await screen.findByRole("heading", { level: 1, name: "Estoque" }, { timeout: 8000 }),
    ).toBeInTheDocument()
  })
})
