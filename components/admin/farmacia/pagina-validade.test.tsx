import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { clear } from "idb-keyval"
import { type ReactNode, useState } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { reiniciarServidores } from "@/lib/admin/dados/consultas"
import { useFarmacia } from "@/lib/admin/farmacia-estado"
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
  useFarmacia.setState(useFarmacia.getInitialState(), true)
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
    // Os lotes que saem do filtro desaparecem com um fade curto; depois sobram só os vencidos.
    await waitFor(() => expect(lotes().getAllByRole("row")).toHaveLength(3))
    const linhas = lotes().getAllByRole("row").slice(1)
    expect(linhas.map((linha) => within(linha).getAllByRole("cell")[1].textContent)).toEqual([
      "DP25K09",
      "CF25M01",
    ])
  })
})

describe("PaginaValidade: carregamento e lote", () => {
  test("enquanto carrega, mostra o esqueleto da lista", async () => {
    render(
      <Provedores>
        <PaginaValidade />
      </Provedores>,
    )
    const aviso = screen.getByRole("status", { name: "Carregando os lotes" })
    expect(within(aviso).getAllByTestId("esqueleto-linha").length).toBeGreaterThan(0)
    await screen.findByRole("table", { name: "Lotes" }, { timeout: 8000 })
    expect(screen.queryByRole("status", { name: "Carregando os lotes" })).not.toBeInTheDocument()
  })

  test("separa todos os vencidos para descarte de uma vez e dá para desfazer", async () => {
    const usuario = await abrir()
    expect(screen.queryByRole("region", { name: "Ações em lote" })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole("radio", { name: "Vencidos 2" }))
    await waitFor(() => expect(lotes().getAllByRole("row")).toHaveLength(3))
    await usuario.click(
      screen.getByRole("checkbox", { name: "Selecionar todos os lotes da lista" }),
    )

    const barra = await screen.findByRole("region", { name: "Ações em lote" })
    expect(barra).toHaveTextContent("2 lotes selecionados")
    expect(within(barra).getByRole("button", { name: "Devolver 0 lotes" })).toBeDisabled()
    await usuario.click(within(barra).getByRole("button", { name: "Descartar 2 vencidos" }))

    expect(await screen.findByText("2 lotes separados para descarte.")).toBeInTheDocument()
    expect(lotes().getAllByText("Separado para descarte")).toHaveLength(2)
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Ações em lote" })).not.toBeInTheDocument(),
    )

    await usuario.click(await screen.findByRole("button", { name: "Desfazer" }))
    await waitFor(() =>
      expect(lotes().queryByText("Separado para descarte")).not.toBeInTheDocument(),
    )
  })

  test("lote que ainda não pede nada fica de fora e a barra avisa", async () => {
    const usuario = await abrir()
    const caixas = lotes().getAllByRole("checkbox")
    // A primeira caixa é a do cabeçalho; a segunda é do lote vencido há mais tempo.
    await usuario.click(caixas[1])
    await usuario.click(caixas[caixas.length - 1])
    const barra = await screen.findByRole("region", { name: "Ações em lote" })
    expect(barra).toHaveTextContent("2 lotes selecionados")
    expect(barra).toHaveTextContent("1 sem ação: fica como está")
    expect(within(barra).getByRole("button", { name: "Descartar 1 vencido" })).toBeEnabled()
  })

  test("o que foi separado continua separado ao voltar para a página", async () => {
    const usuario = await abrir()
    await usuario.click(screen.getByRole("radio", { name: "Vencidos 2" }))
    await waitFor(() => expect(lotes().getAllByRole("row")).toHaveLength(3))
    await usuario.click(
      screen.getByRole("checkbox", { name: "Selecionar todos os lotes da lista" }),
    )
    const barra = await screen.findByRole("region", { name: "Ações em lote" })
    await usuario.click(within(barra).getByRole("button", { name: "Descartar 2 vencidos" }))
    expect(lotes().getAllByText("Separado para descarte")).toHaveLength(2)

    cleanup()
    await abrir()
    expect(lotes().getAllByText("Separado para descarte")).toHaveLength(2)
  })

  test("devolve ao distribuidor os que vencem em 30 dias", async () => {
    const usuario = await abrir()
    await usuario.click(screen.getByRole("radio", { name: "Vencem em 30 dias 4" }))
    await waitFor(() => expect(lotes().getAllByRole("row")).toHaveLength(5))
    await usuario.click(
      screen.getByRole("checkbox", { name: "Selecionar todos os lotes da lista" }),
    )
    const barra = await screen.findByRole("region", { name: "Ações em lote" })
    await usuario.click(within(barra).getByRole("button", { name: "Devolver 4 lotes" }))
    expect(await screen.findByText("4 lotes separados para devolução.")).toBeInTheDocument()
    expect(lotes().getAllByText("Separado para devolução")).toHaveLength(4)
  })
})
