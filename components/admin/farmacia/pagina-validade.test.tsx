import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaValidade } from "./pagina-validade"

function Provedores({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={cliente}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

async function abrir() {
  const usuario = userEvent.setup()
  render(
    <Provedores>
      <PaginaValidade />
    </Provedores>,
  )
  await screen.findByRole("table", { name: "Lotes" }, { timeout: 8000 })
  return usuario
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  localStorage.clear()
  reiniciarServidores()
  useSegmentoAtual.setState({ segmento: "farmacia", hidratado: true })
})

const lotes = () => within(screen.getByRole("table", { name: "Lotes" }))

describe("PaginaValidade", () => {
  test("resume vencidos, o que vence logo e o estoque baixo", async () => {
    await abrir()
    expect(screen.getByRole("heading", { level: 1, name: "Lotes e validade" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Todos 24" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Vencidos 2" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Vencem em 30 dias 4" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Vencem em 90 dias 4" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Estoque baixo 5" })).toBeInTheDocument()
  })

  test("o mais perto de vencer vem primeiro, e a insulina avisa a geladeira", async () => {
    await abrir()
    const linhas = lotes().getAllByRole("row").slice(1)
    expect(within(linhas[0]).getByText("DP25K09")).toBeInTheDocument()
    expect(within(linhas[0]).getByText("Vencido há 6 dias")).toBeInTheDocument()
    const insulina = within(lotes().getByRole("row", { name: /Insulina humana NPH/ }))
    expect(insulina.getByText("Vence em 28 dias")).toBeInTheDocument()
    expect(insulina.getByLabelText("Guardar na geladeira")).toBeInTheDocument()
  })

  test("a situação do lote é um traço no tom e o texto ao lado", async () => {
    await abrir()
    const vencido = lotes().getByRole("row", { name: /DP25K09/ })
    expect(vencido.querySelector("[data-traco]")).toHaveAttribute("data-tom", "cancelado")
    const insulina = lotes().getByRole("row", { name: /Insulina humana NPH/ })
    expect(insulina.querySelector("[data-traco]")).toHaveAttribute("data-tom", "preparo")
  })

  test("filtra pela situação", async () => {
    const usuario = await abrir()
    await usuario.click(screen.getByRole("radio", { name: "Vencidos 2" }))
    const linhas = lotes().getAllByRole("row").slice(1)
    expect(linhas.map((linha) => within(linha).getAllByRole("cell")[1].textContent)).toEqual([
      "DP25K09",
      "CF25M01",
    ])
  })
})
