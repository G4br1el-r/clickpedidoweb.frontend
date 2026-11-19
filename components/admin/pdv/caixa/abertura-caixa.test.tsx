import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores, servidorDo } from "@/lib/admin/dados/consultas"
import { useSegmentoAtual } from "@/lib/admin/segmento-atual"
import { useUsuarioSalvo } from "@/lib/admin/usuario-atual"
import { PaginaPdv } from "../pagina-pdv"
import { ContagemCedulas } from "./contagem-cedulas"

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
      <PaginaPdv />
    </Provedores>,
  )
  await screen.findByRole("heading", { level: 1, name: "Abrir o caixa" }, { timeout: 8000 })
  return usuario
}

const abertura = () => within(screen.getByRole("region", { name: "Abrir o caixa" }))

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  localStorage.clear()
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
  useUsuarioSalvo.setState(useUsuarioSalvo.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("ContagemCedulas", () => {
  test("uma linha por cédula e moeda, com o subtotal", async () => {
    const usuario = userEvent.setup()
    const aoMudar = vi.fn()
    const quantidades = [0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    render(<ContagemCedulas quantidades={quantidades} aoMudar={aoMudar} />)
    expect(screen.getAllByRole("spinbutton")).toHaveLength(12)
    expect(screen.getByLabelText("R$ 50")).toHaveValue(2)
    expect(screen.getByLabelText("R$ 0,05")).toHaveValue(0)
    expect(screen.getByText("R$ 100,00")).toBeInTheDocument()
    await usuario.type(screen.getByLabelText("R$ 20"), "3")
    expect(aoMudar).toHaveBeenLastCalledWith([0, 0, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0])
  })
})

describe("AberturaCaixa", () => {
  test("sem caixa aberto, o PDV mostra Abrir o caixa", async () => {
    await abrir()
    expect(screen.queryByRole("searchbox", { name: "Buscar no cardápio" })).not.toBeInTheDocument()
    expect(abertura().getByRole("button", { name: /Abrir caixa/ })).toBeDisabled()
  })

  test("o fundo começa no sugerido", async () => {
    await abrir()
    expect(abertura().getByLabelText("Fundo de troco")).toHaveValue("R$ 100,00")
  })

  test("a contagem preenche o fundo", async () => {
    const usuario = await abrir()
    const contagem = within(screen.getByRole("region", { name: "Contagem da gaveta" }))
    await usuario.type(contagem.getByLabelText("R$ 50"), "2")
    await usuario.type(contagem.getByLabelText("R$ 20"), "1")
    expect(abertura().getByLabelText("Fundo de troco")).toHaveValue("R$ 120,00")
  })

  test("Marina + 1111 abre e mostra a venda", async () => {
    const usuario = await abrir()
    await usuario.click(abertura().getByRole("radio", { name: "Marina S. Caixa" }))
    await usuario.type(abertura().getByLabelText("PIN de Marina S."), "1111")
    await usuario.click(abertura().getByRole("button", { name: /Abrir caixa/ }))

    expect(
      await screen.findByRole("searchbox", { name: "Buscar no cardápio" }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(await servidorDo("pizzaria").caixa.atual()).toMatchObject({
      abertoPor: "eq-marina",
      fundo: 100,
    })
    expect(useUsuarioSalvo.getState().porSegmento.pizzaria).toBe("eq-marina")
  })

  test("PIN errado mostra o erro", async () => {
    const usuario = await abrir()
    await usuario.click(abertura().getByRole("radio", { name: "João P. Caixa" }))
    await usuario.type(abertura().getByLabelText("PIN de João P."), "1111{Enter}")
    expect(await abertura().findByText("PIN errado.")).toBeInTheDocument()
    expect(abertura().getByLabelText("PIN de João P.")).toHaveValue("")
    expect(await servidorDo("pizzaria").caixa.atual()).toBeNull()
  })
})
