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
import { useFarmacia } from "@/lib/admin/farmacia-estado"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { PaginaControlados } from "./pagina-controlados"

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
      <PaginaControlados />
    </Provedores>,
  )
  await screen.findByRole("table", { name: "Saldo por medicamento" }, { timeout: 8000 })
  return usuario
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  localStorage.clear()
  reiniciarServidores()
  useSegmentoAtual.setState({ segmento: "farmacia", hidratado: true })
  useFarmacia.setState(useFarmacia.getInitialState(), true)
})

const saldo = () => within(screen.getByRole("table", { name: "Saldo por medicamento" }))
const linhaSaldo = (nome: string) => within(saldo().getByRole("row", { name: new RegExp(nome) }))

describe("PaginaControlados", () => {
  test("mostra o saldo de cada controlado e antimicrobiano pela escrituração", async () => {
    await abrir()
    expect(screen.getByRole("heading", { level: 1, name: "Controlados" })).toBeInTheDocument()
    expect(saldo().getAllByRole("row")).toHaveLength(9)
    expect(linhaSaldo("Clonazepam 2 mg").getByText("B1")).toBeInTheDocument()
    expect(linhaSaldo("Clonazepam 2 mg").getByText("28")).toBeInTheDocument()
    expect(linhaSaldo("Fluoxetina 20 mg").getByText("23")).toBeInTheDocument()
    expect(linhaSaldo("Amoxicilina 500 mg").getByText("ATM")).toBeInTheDocument()
  })

  test("a receita aprovada entra como saída e baixa o saldo", async () => {
    useFarmacia.setState({
      decisoes: {
        "rec-1002": { situacao: "aprovada", em: "2026-11-13T23:20:00.000Z", retida: true },
      },
    })
    await abrir()
    expect(linhaSaldo("Clonazepam 2 mg").getByText("27")).toBeInTheDocument()
    const movimentos = within(screen.getByRole("table", { name: "Movimentações" }))
    const saida = within(movimentos.getByRole("row", { name: /Bruno Carvalho/ }))
    expect(saida.getByText("Saída")).toBeInTheDocument()
    expect(saida.getByText("Notificação de receita B rec-1002")).toBeInTheDocument()
  })

  test("gera o arquivo do SNGPC", async () => {
    const usuario = await abrir()
    await usuario.click(screen.getByRole("button", { name: "Exportar para o SNGPC" }))
    expect(await screen.findByText(/Arquivo do SNGPC gerado/)).toBeInTheDocument()
  })
})
