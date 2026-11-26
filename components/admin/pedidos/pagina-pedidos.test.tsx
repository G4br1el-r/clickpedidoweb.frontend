import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaPedidos } from "./pagina-pedidos"

function Provedores({
  children,
  busca,
}: {
  children: ReactNode
  busca: string | Record<string, string>
}) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <NuqsTestingAdapter hasMemory searchParams={busca}>
      <QueryClientProvider client={cliente}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

function renderizar(busca: string) {
  return render(
    <Provedores busca={busca}>
      <PaginaPedidos />
    </Provedores>,
  )
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("PaginaPedidos", () => {
  test("mostra o esqueleto e depois a lista do período", async () => {
    renderizar("")
    expect(screen.getByRole("heading", { level: 1, name: "Pedidos" })).toBeInTheDocument()
    expect(screen.getByRole("status", { name: "Carregando pedidos" })).toBeInTheDocument()
    expect(await screen.findByRole("table", {}, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /07\/11 a 13\/11 · 7 dias/ })).toBeInTheDocument()
  })

  test("vindo do gráfico da visão geral, mostra só o dia escolhido", async () => {
    renderizar("?data=2026-11-12")
    expect(await screen.findByRole("button", { name: /12\/11 · 1 dia/ })).toBeInTheDocument()
  })
})

describe("PaginaPedidos em lote", () => {
  test("marcar todos os pedidos em preparo e avançar tira todos do filtro", async () => {
    const usuario = userEvent.setup({ advanceTimers: () => {} })
    renderizar("?status=em-preparo&periodo=30d")
    await screen.findByRole("table", {}, { timeout: 8000 })
    await usuario.click(screen.getByRole("checkbox", { name: "Selecionar todos desta página" }))
    await usuario.click(screen.getByRole("button", { name: /^Avançar \d+ pedidos?$/ }))
    expect(
      await screen.findByText("Nenhum pedido com esses filtros", {}, { timeout: 8000 }),
    ).toBeInTheDocument()
  })
})
